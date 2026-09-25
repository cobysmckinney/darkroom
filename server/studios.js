import { createHash, randomBytes } from 'node:crypto'
import { addMember, createStudioForUser, db, deleteInvite, getInvite, getStudioSettings, getUserByEmail, insertInvite, listInvites, listMembers, memberFor, removeMember, studiosForUser, updateStudioSettings } from './database.js'
import { decrypt, encrypt } from './secrets.js'
import { requireAdmin, requireCsrf, requireSession, setSession } from './auth.js'

const hash = value => createHash('sha256').update(value).digest('hex')
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const allowedRoles = ['admin', 'editor', 'viewer']
const viewSettings = (row, role) => ({
  name: row.name, businessEmail: row.business_email || '', businessAddress: row.business_address || '', phone: row.phone || '', website: row.website || '', taxId: row.tax_id || '', currency: row.currency || 'USD', paymentTerms: row.payment_terms || '', invoiceNotes: row.invoice_notes || '',
  ...(role === 'owner' || role === 'admin' ? { smtpHost: row.smtp_host || '', smtpPort: row.smtp_port || 587, smtpSecure: Boolean(row.smtp_secure), smtpUser: row.smtp_user || '', smtpFrom: row.smtp_from || '', smtpPasswordSet: Boolean(row.smtp_password) } : {}),
})

export function smtpForStudio(studioId) {
  const row = getStudioSettings.get(studioId)
  if (row?.smtp_host && row?.smtp_from) return { host: row.smtp_host, port: row.smtp_port, secure: Boolean(row.smtp_secure), user: row.smtp_user, pass: decrypt(row.smtp_password), from: row.smtp_from }
  return null
}

export function studioRoutes(app) {
  app.get('/api/studios', requireSession, (request, response) => response.json(studiosForUser.all(request.session.user_id)))
  app.post('/api/studios', requireSession, requireCsrf, (request, response) => {
    const name = clean(request.body?.name, 80)
    if (!name) return response.status(400).json({ error: 'Studio name is required.' })
    const studio = createStudioForUser(request.session.user_id, name)
    const user = { id: request.session.user_id, studioId: studio.id, studioName: studio.name, role: studio.role, email: request.session.email, displayName: request.session.display_name }
    response.status(201).json(setSession(response, request, user))
  })
  app.post('/api/studios/:id/switch', requireSession, requireCsrf, (request, response) => {
    const membership = memberFor.get(request.params.id, request.session.user_id)
    if (!membership) return response.status(404).json({ error: 'Studio not found.' })
    const studio = db.prepare('SELECT name FROM studios WHERE id = ?').get(request.params.id)
    response.json(setSession(response, request, { id: request.session.user_id, studioId: request.params.id, studioName: studio.name, role: membership.role, email: request.session.email, displayName: request.session.display_name }))
  })
  app.get('/api/studios/current/settings', requireSession, (request, response) => response.json(viewSettings(getStudioSettings.get(request.session.studio_id), request.session.role)))
  app.put('/api/studios/current/settings', requireAdmin, requireCsrf, (request, response) => {
    const input = request.body || {}
    const current = getStudioSettings.get(request.session.studio_id)
    const name = clean(input.name, 80)
    const smtpHost = clean(input.smtpHost, 255)
    const smtpFrom = clean(input.smtpFrom, 255)
    const smtpPort = Number(input.smtpPort || 587)
    if (!name || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || (smtpHost && !smtpFrom)) return response.status(400).json({ error: 'Add a studio name and valid SMTP settings.' })
    const values = {
      name, smtp_host: smtpHost, smtp_port: smtpPort, smtp_secure: input.smtpSecure ? 1 : 0,
      smtp_user: clean(input.smtpUser, 255), smtp_password: input.smtpPassword ? encrypt(String(input.smtpPassword).slice(0, 1000)) : current.smtp_password || '', smtp_from: smtpFrom,
      business_email: clean(input.businessEmail, 255), business_address: clean(input.businessAddress, 500), phone: clean(input.phone, 80), website: clean(input.website, 255), tax_id: clean(input.taxId, 100),
      currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(input.currency) ? input.currency : 'USD', payment_terms: clean(input.paymentTerms, 500), invoice_notes: clean(input.invoiceNotes, 1000),
    }
    if (input.clearSmtpPassword) values.smtp_password = ''
    updateStudioSettings(request.session.studio_id, values)
    response.json(viewSettings(getStudioSettings.get(request.session.studio_id), request.session.role))
  })
  app.get('/api/studios/current/members', requireSession, (request, response) => response.json({ members: listMembers.all(request.session.studio_id), invites: request.session.role === 'owner' || request.session.role === 'admin' ? listInvites.all(request.session.studio_id, Date.now()) : [] }))
  app.post('/api/studios/current/invites', requireAdmin, requireCsrf, (request, response) => {
    const email = clean(request.body?.email, 255).toLowerCase()
    const role = request.body?.role
    if (!emailPattern.test(email) || !allowedRoles.includes(role)) return response.status(400).json({ error: 'Enter a valid email and role.' })
    if (listMembers.all(request.session.studio_id).some(member => member.email === email)) return response.status(409).json({ error: 'This person already belongs to the studio.' })
    const token = randomBytes(32).toString('base64url')
    insertInvite.run(hash(token), request.session.studio_id, email, role, Date.now() + 7 * 86400_000, Date.now())
    response.status(201).json({ inviteUrl: `${request.protocol}://${request.get('Host')}/?invite=${token}`, email, role })
  })
  app.delete('/api/studios/current/invites/:email', requireAdmin, requireCsrf, (request, response) => {
    db.prepare('DELETE FROM studio_invites WHERE studio_id = ? AND email = ?').run(request.session.studio_id, request.params.email.toLowerCase())
    response.json({ revoked: true })
  })
  app.patch('/api/studios/current/members/:id', requireAdmin, requireCsrf, (request, response) => {
    const role = request.body?.role
    const current = memberFor.get(request.session.studio_id, request.params.id)
    if (!current) return response.status(404).json({ error: 'Member not found.' })
    if (current.role === 'owner' || !allowedRoles.includes(role)) return response.status(403).json({ error: 'Owner role cannot be changed.' })
    addMember(request.session.studio_id, request.params.id, role)
    response.json({ updated: true })
  })
  app.delete('/api/studios/current/members/:id', requireAdmin, requireCsrf, (request, response) => {
    try { removeMember(request.session.studio_id, request.params.id); response.json({ removed: true }) }
    catch (error) { response.status(403).json({ error: error.message }) }
  })
  app.get('/api/invitations/:token', (request, response) => {
    const invite = getInvite.get(hash(request.params.token), Date.now())
    if (!invite) return response.status(404).json({ error: 'Invitation expired or not found.' })
    const studio = db.prepare('SELECT name FROM studios WHERE id = ?').get(invite.studio_id)
    response.json({ studioName: studio.name, email: invite.email, role: invite.role, existingAccount: Boolean(getUserByEmail.get(invite.email)) })
  })
  app.post('/api/invitations/:token/accept', requireSession, requireCsrf, (request, response) => {
    const invite = getInvite.get(hash(request.params.token), Date.now())
    if (!invite || invite.email !== request.session.email) return response.status(400).json({ error: 'This invitation does not match your account.' })
    addMember(invite.studio_id, request.session.user_id, invite.role)
    deleteInvite.run(invite.token_hash)
    const studio = db.prepare('SELECT name FROM studios WHERE id = ?').get(invite.studio_id)
    response.json(setSession(response, request, { id: request.session.user_id, studioId: invite.studio_id, studioName: studio.name, role: invite.role, email: request.session.email, displayName: request.session.display_name }))
  })
}
