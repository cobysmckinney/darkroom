import express from 'express'
import nodemailer from 'nodemailer'
import { randomUUID } from 'node:crypto'
import { authRoutes, checkOrigin, loadSession, requireCsrf, requireEditor, requireSession } from './auth.js'
import { getEmailAttachment, importWorkspace, listEmailAttachments, recordFor, removeRecord, saveEmailAttachments, saveRecord, sections, workspaceFor } from './database.js'
import { smtpForStudio, studioRoutes } from './studios.js'
import { emailHtml, plainText, textDocument } from '../src/richText.js'
import { createGalleryShare, galleryForEmail, galleryHtml, galleryMessage, galleryRoutes, revokeGalleryShare } from './galleries.js'
import { linkErrors, linksHtml, linksMessage, revokeClientLinks } from './clientLinks.js'
import { signingLinkFor, signingRoutes } from './signing.js'
import { paymentLinkFor, paymentRoutes, stripeFor, stripeWebhookRoute } from './payments.js'

export const smtpTransport = smtp => nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure || smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined, requireTLS: !(smtp.secure || smtp.port === 465) })

// Signing and payment links for the invoices and contracts attached to an email.
const documentLinks = (studioId, refs, recipient, request) => refs.map(ref => {
  const item = recordFor(studioId, ref.type, ref.id)
  if (!item) return null
  return ref.type === 'Contracts' ? signingLinkFor(studioId, item, recipient, request) : paymentLinkFor(studioId, item, recipient, request)
}).filter(Boolean)

export function createApp({ host = '127.0.0.1', isProduction = false, mailTransport = smtpTransport, stripeFetch = fetch } = {}) {
  const app = express()
  const localOnly = ['127.0.0.1', 'localhost', '::1'].includes(host)
  app.use(['/share', '/sign', '/pay'], (_request, response, next) => { response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('X-Robots-Tag', 'noindex, nofollow'); next() })
  app.set('trust proxy', process.env.TRUST_PROXY === 'true')

  stripeWebhookRoute(app)
  app.use('/api', express.json({ limit: '18mb' }))
  app.use('/api', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    if (isProduction && !localOnly && !request.secure) return response.status(403).json({ error: 'HTTPS is required.' })
    next()
  }, checkOrigin, loadSession)
  authRoutes(app)
  studioRoutes(app)
  galleryRoutes(app)
  signingRoutes(app)
  paymentRoutes(app, { stripeFetch })

  app.get('/api/workspace', requireSession, (request, response) => response.json(workspaceFor(request.session.studio_id)))
  app.get('/api/workspace/export', requireSession, (request, response) => {
    const filename = `darkroom-${new Date().toISOString().slice(0, 10)}.json`
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    response.json({ studio: request.session.studio_name, exportedAt: new Date().toISOString(), records: workspaceFor(request.session.studio_id) })
  })
  app.post('/api/workspace/import', requireEditor, requireCsrf, (request, response) => {
    try { response.status(201).json(importWorkspace(request.session.studio_id, request.body)) }
    catch (error) { response.status(400).json({ error: error.message }) }
  })
  app.put('/api/records/:section', requireEditor, requireCsrf, (request, response) => {
    try {
      if (!sections.includes(request.params.section)) return response.status(404).json({ error: 'Unknown section.' })
      response.json(saveRecord(request.session.studio_id, request.params.section, request.body))
    } catch { response.status(400).json({ error: 'Record could not be saved.' }) }
  })
  app.delete('/api/records/Templates/:id', requireEditor, requireCsrf, (request, response) => response.json({ removed: removeRecord(request.session.studio_id, 'Templates', request.params.id) }))

  app.get('/api/email/status', requireSession, (request, response) => response.json({ configured: Boolean(smtpForStudio(request.session.studio_id)), paymentsConfigured: Boolean(stripeFor(request.session.studio_id)) }))
  app.get('/api/email/:id/attachments/:position', requireSession, (request, response) => {
    const email = recordFor(request.session.studio_id, 'Email', request.params.id)
    const attachment = email?.status === 'Sent' ? getEmailAttachment.get(request.session.studio_id, request.params.id, Number(request.params.position)) : null
    if (!attachment) return response.status(404).json({ error: 'Attachment not found.' })
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`)
    response.send(attachment.content)
  })
  app.post('/api/email/send', requireEditor, requireCsrf, async (request, response) => {
    const smtp = smtpForStudio(request.session.studio_id)
    if (!smtp) return response.status(503).json({ error: 'Email delivery is not configured.' })

    const { to, subject, body, bodyDocument, projectId, scope, attachments = [], attachmentRefs = [], draftId, galleryId } = request.body || {}
    const message = bodyDocument ? plainText(bodyDocument) : body
    const project = projectId === undefined || projectId === null ? null : recordFor(request.session.studio_id, 'Projects', projectId)
    if (!project && scope !== 'global') return response.status(400).json({ error: 'Choose a project before sending.' })
    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || typeof subject !== 'string' || !subject.trim() || typeof message !== 'string' || !message.trim() || message.length > 20_000) return response.status(400).json({ error: 'Recipient, subject, and message are required.' })
    if (bodyDocument && JSON.stringify(bodyDocument).length > 40_000) return response.status(400).json({ error: 'Message is too long.' })
    if (!Array.isArray(attachments) || attachments.length > 3 || attachments.some(file => typeof file.filename !== 'string' || !/^[a-z0-9-]+\.pdf$/i.test(file.filename) || typeof file.content !== 'string' || file.content.length > 5_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.content))) return response.status(400).json({ error: 'Only three PDF attachments of up to 3.7 MB each are allowed.' })
    if (!Array.isArray(attachmentRefs) || attachmentRefs.length !== attachments.length || (!project && attachmentRefs.length)) return response.status(400).json({ error: 'Attachments require a project.' })
    const attachedDocuments = attachmentRefs.map(ref => ['Invoices', 'Contracts'].includes(ref?.type) && ['string', 'number'].includes(typeof ref.id) ? recordFor(request.session.studio_id, ref.type, ref.id) : null)
    if (attachedDocuments.some(item => !item || String(item.projectId) !== String(projectId) || item.email?.trim().toLowerCase() !== to.trim().toLowerCase())) return response.status(400).json({ error: 'Attachments must belong to this project and match the recipient email.' })
    if (attachments.some(file => !Buffer.from(file.content, 'base64').subarray(0, 5).equals(Buffer.from('%PDF-')))) return response.status(400).json({ error: 'Attachment is not a PDF.' })
    const draft = draftId ? recordFor(request.session.studio_id, 'Email', draftId) : null
    if (draftId && (!draft || draft.status !== 'Draft' || String(draft.projectId || '') !== String(projectId || ''))) return response.status(400).json({ error: 'Email draft was not found in this project.' })
    let gallery
    try { gallery = galleryForEmail(request.session.studio_id, galleryId, projectId, to) }
    catch (error) { return response.status(400).json({ error: error.message }) }

    const transport = mailTransport(smtp)
    let share
    let links = []
    let delivered = false
    try {
      if (gallery) share = createGalleryShare(request.session.studio_id, gallery, to, request)
      links = documentLinks(request.session.studio_id, attachmentRefs, to, request)
      const sentBody = linksMessage(galleryMessage(message, share), links)
      const result = await transport.sendMail({
        from: smtp.from,
        to,
        subject: subject.trim().slice(0, 200),
        text: sentBody,
        html: bodyDocument || share || links.length ? emailHtml(bodyDocument || textDocument(message)) + galleryHtml(share) + linksHtml(links) : undefined,
        attachments: attachments.map(file => ({ filename: file.filename, content: Buffer.from(file.content, 'base64'), contentType: 'application/pdf' })),
        disableFileAccess: true,
        disableUrlAccess: true,
      })
      delivered = true
      const sentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const email = saveRecord(request.session.studio_id, 'Email', { id: draftId || randomUUID(), projectId: project?.id, scope: project ? 'project' : 'global', subject: subject.trim().slice(0, 200), recipient: to.trim(), from: smtp.from, body: sentBody, messageBody: message.trim(), bodyDocument: bodyDocument || null, galleryId: gallery?.id, galleryShare: share ? { galleryId: gallery.id, title: share.title, url: share.url, expiresAt: share.expiresAt } : undefined, attachmentRefs, attachmentMeta: attachments.map((file, position) => ({ filename: file.filename, title: attachedDocuments[position]?.title || file.filename })), status: 'Sent', date: sentDate, sentAt: new Date().toISOString(), messageId: result.messageId })
      saveEmailAttachments(request.session.studio_id, email.id, attachments)
      const updatedDocuments = attachmentRefs.map(ref => {
        const item = recordFor(request.session.studio_id, ref.type, ref.id)
        if (!item) return null
        const updated = { ...item, lastSentAt: email.sentAt, ...(item.status === 'Draft' ? { status: ref.type === 'Invoices' ? 'Open' : 'Awaiting signature', ...(ref.type === 'Contracts' ? { sent: sentDate } : {}) } : {}) }
        return { type: ref.type, item: saveRecord(request.session.studio_id, ref.type, updated) }
      }).filter(Boolean)
      const updatedGallery = gallery ? saveRecord(request.session.studio_id, 'Galleries', { ...gallery, status: 'Shared', updated: sentDate }) : null
      response.json({ sent: true, messageId: result.messageId, email, updatedDocuments, updatedGallery })
    } catch (error) {
      console.error('Email delivery failed:', error)
      if (!delivered) { revokeGalleryShare(share?.token); revokeClientLinks(links) }
      response.status(delivered ? 500 : 502).json({ error: delivered ? 'Email was sent, but its history could not be saved. Check the server before trying again.' : error.message === 'A public app URL is required to share galleries.' || error.message === 'Gallery links require HTTPS.' || linkErrors.has(error.message) ? error.message : 'Email delivery failed. Check the SMTP settings and try again.' })
    }
  })

  app.post('/api/email/:id/resend', requireEditor, requireCsrf, async (request, response) => {
    const original = recordFor(request.session.studio_id, 'Email', request.params.id)
    if (!original || original.status !== 'Sent' || (original.projectId && !recordFor(request.session.studio_id, 'Projects', original.projectId)) || original.scope === 'unassigned') return response.status(404).json({ error: 'Sent email is not available for resending.' })
    const smtp = smtpForStudio(request.session.studio_id)
    if (!smtp) return response.status(503).json({ error: 'Email delivery is not configured.' })
    const snapshots = listEmailAttachments.all(request.session.studio_id, String(original.id))
    if ((original.attachmentMeta?.length && snapshots.length !== original.attachmentMeta.length) || ((original.attachmentRefs || []).length && !original.attachmentMeta?.length)) return response.status(409).json({ error: 'A saved attachment is missing. Reuse this email as a draft instead.' })
    let gallery
    try { gallery = galleryForEmail(request.session.studio_id, original.galleryId, original.projectId, original.recipient) }
    catch (error) { return response.status(409).json({ error: error.message }) }
    let share
    let links = []
    let delivered = false
    try {
      if (gallery) share = createGalleryShare(request.session.studio_id, gallery, original.recipient, request)
      links = documentLinks(request.session.studio_id, (original.attachmentRefs || []).filter(ref => String(recordFor(request.session.studio_id, ref.type, ref.id)?.projectId) === String(original.projectId)), original.recipient, request)
      const messageBody = original.messageBody || (gallery ? original.body.split('\n\nView your gallery:')[0] : original.body)
      const sentBody = linksMessage(galleryMessage(messageBody, share), links)
      const result = await mailTransport(smtp).sendMail({ from: smtp.from, to: original.recipient, subject: original.subject, text: sentBody, html: original.bodyDocument || share || links.length ? emailHtml(original.bodyDocument || textDocument(messageBody)) + galleryHtml(share) + linksHtml(links) : undefined, attachments: snapshots.map(file => ({ filename: file.filename, content: file.content, contentType: 'application/pdf' })), disableFileAccess: true, disableUrlAccess: true })
      delivered = true
      const sentAt = new Date().toISOString()
      const email = saveRecord(request.session.studio_id, 'Email', { ...original, id: randomUUID(), from: smtp.from, body: sentBody, messageBody, galleryShare: share ? { galleryId: gallery.id, title: share.title, url: share.url, expiresAt: share.expiresAt } : undefined, date: new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), sentAt, messageId: result.messageId, resendOf: original.id, attachmentRefs: (original.attachmentRefs || []).filter(ref => String(recordFor(request.session.studio_id, ref.type, ref.id)?.projectId) === String(original.projectId)) })
      saveEmailAttachments(request.session.studio_id, email.id, snapshots.map(file => ({ filename: file.filename, content: file.content.toString('base64') })))
      response.json({ sent: true, email })
    } catch (error) { console.error('Email resend failed:', error); if (!delivered) { revokeGalleryShare(share?.token); revokeClientLinks(links) } response.status(delivered ? 500 : 502).json({ error: delivered ? 'Email was resent, but its history could not be saved.' : linkErrors.has(error.message) ? error.message : 'Email could not be resent. Check the SMTP settings.' }) }
  })
  return app
}
