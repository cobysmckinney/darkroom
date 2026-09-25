import express from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db, recordFor, saveRecord } from './database.js'
import { requireCsrf, requireEditor, requireSession } from './auth.js'

const maxPhotoBytes = 20 * 1024 * 1024
const maxGalleryPhotos = 150
const shareLifetime = 7 * 24 * 60 * 60 * 1000
const hashToken = token => createHash('sha256').update(token).digest('hex')
const photoList = db.prepare('SELECT id, filename, mime, size, created_at FROM gallery_photos WHERE studio_id = ? AND gallery_id = ? ORDER BY created_at, id')
const photoById = db.prepare('SELECT filename, mime, size, content FROM gallery_photos WHERE studio_id = ? AND gallery_id = ? AND id = ?')
const countPhotos = db.prepare('SELECT COUNT(*) AS count FROM gallery_photos WHERE studio_id = ? AND gallery_id = ?')
const shareByHash = db.prepare('SELECT * FROM gallery_shares WHERE token_hash = ? AND expires_at > ? AND revoked_at IS NULL')

const photoMime = bytes => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}
const safeFilename = input => String(input || 'photo').replace(/[\\/\x00-\x1f\x7f"<>]/g, '').trim().slice(0, 120) || 'photo'
const photoOutput = (response, row, download = false) => {
  if (!row) return response.status(404).json({ error: 'Photo not found.' })
  response.setHeader('Content-Type', row.mime)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  response.setHeader('Referrer-Policy', 'no-referrer')
  if (download) response.setHeader('Content-Disposition', `attachment; filename="${safeFilename(row.filename)}"`)
  response.send(row.content)
}
const validShare = token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const share = shareByHash.get(hashToken(token), Date.now())
  if (!share || !recordFor(share.studio_id, 'Galleries', share.gallery_id)) return null
  return share
}
const findRecipient = (studioId, gallery, project) => {
  if (gallery.email?.trim()) return gallery.email.trim().toLowerCase()
  if (project?.clientEmail?.trim()) return project.clientEmail.trim().toLowerCase()
  const clients = db.prepare("SELECT data FROM records WHERE studio_id = ? AND section = 'Clients'").all(studioId).map(row => JSON.parse(row.data))
  const matches = clients.filter(client => client.name?.trim().toLowerCase() === String(gallery.client || project?.client || '').trim().toLowerCase())
  return matches.length === 1 ? matches[0].email?.trim().toLowerCase() : null
}

export function galleryForEmail(studioId, galleryId, projectId, recipient) {
  if (!galleryId) return null
  const gallery = recordFor(studioId, 'Galleries', galleryId)
  const project = gallery && recordFor(studioId, 'Projects', gallery.projectId)
  if (!gallery || !project || String(gallery.projectId) !== String(projectId)) throw new Error('Gallery must belong to this project.')
  if (!countPhotos.get(studioId, String(gallery.id)).count) throw new Error('Upload photos before sharing this gallery.')
  const expected = findRecipient(studioId, gallery, project)
  if (!expected) throw new Error('Add the client email to this gallery before sharing.')
  if (expected !== String(recipient || '').trim().toLowerCase()) throw new Error('The recipient must match this gallery’s client email.')
  return gallery
}

export function createGalleryShare(studioId, gallery, recipient, request) {
  const base = process.env.PUBLIC_BASE_URL || request.get('Origin')
  if (!base) throw new Error('A public app URL is required to share galleries.')
  const parsed = new URL(base)
  if (!['https:', 'http:'].includes(parsed.protocol) || (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))) throw new Error('Gallery links require HTTPS.')
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  const expiresAt = now + shareLifetime
  db.prepare('INSERT INTO gallery_shares (token_hash, studio_id, gallery_id, recipient, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(hashToken(token), studioId, String(gallery.id), recipient.trim().toLowerCase(), expiresAt, now)
  return { token, galleryId: gallery.id, title: gallery.title, url: new URL(`/share/${token}`, parsed).toString(), expiresAt: new Date(expiresAt).toISOString() }
}
export function revokeGalleryShare(token) {
  if (token) db.prepare('UPDATE gallery_shares SET revoked_at = ? WHERE token_hash = ?').run(Date.now(), hashToken(token))
}
export function galleryMessage(text, share) {
  if (!share) return text
  return `${text.trim()}\n\nView your gallery: ${share.url}\nThis private link expires ${new Date(share.expiresAt).toLocaleDateString('en-US')}.`
}
export function galleryHtml(share) {
  return share ? `<p style="margin-top:24px"><a href="${share.url}" rel="noreferrer">View ${share.title.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])}</a><br><small>This private link expires ${new Date(share.expiresAt).toLocaleDateString('en-US')}.</small></p>` : ''
}

export function galleryRoutes(app) {
  app.get('/api/galleries/:id/photos', requireSession, (request, response) => {
    const gallery = recordFor(request.session.studio_id, 'Galleries', request.params.id)
    if (!gallery) return response.status(404).json({ error: 'Gallery not found.' })
    response.json(photoList.all(request.session.studio_id, String(gallery.id)).map(row => ({ id: row.id, filename: row.filename, mime: row.mime, size: row.size, createdAt: new Date(row.created_at).toISOString() })))
  })
  app.post('/api/galleries/:id/photos', requireEditor, requireCsrf, express.raw({ type: () => true, limit: maxPhotoBytes }), (request, response) => {
    const studioId = request.session.studio_id
    const gallery = recordFor(studioId, 'Galleries', request.params.id)
    if (!gallery?.projectId) return response.status(404).json({ error: 'Choose a project for this gallery first.' })
    const bytes = request.body
    const mime = Buffer.isBuffer(bytes) && bytes.length > 0 ? photoMime(bytes) : null
    if (!mime || bytes.length > maxPhotoBytes) return response.status(400).json({ error: 'Upload a JPEG, PNG, or WebP image up to 20 MB.' })
    if (countPhotos.get(studioId, String(gallery.id)).count >= maxGalleryPhotos) return response.status(400).json({ error: 'A gallery can hold up to 150 photos.' })
    let filename
    try { filename = safeFilename(request.get('X-Filename') ? decodeURIComponent(request.get('X-Filename')) : 'photo') }
    catch { return response.status(400).json({ error: 'Invalid photo filename.' }) }
    const id = randomUUID()
    db.prepare('INSERT INTO gallery_photos (studio_id, gallery_id, id, filename, mime, size, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(studioId, String(gallery.id), id, filename, mime, bytes.length, bytes, Date.now())
    const updated = saveRecord(studioId, 'Galleries', { ...gallery, updated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: gallery.status === 'Delivered' ? 'In progress' : gallery.status })
    response.status(201).json({ photo: { id, filename, mime, size: bytes.length }, gallery: updated })
  })
  app.get('/api/galleries/:id/photos/:photoId', requireSession, (request, response) => {
    const gallery = recordFor(request.session.studio_id, 'Galleries', request.params.id)
    if (!gallery) return response.status(404).json({ error: 'Gallery not found.' })
    photoOutput(response, photoById.get(request.session.studio_id, String(gallery.id), request.params.photoId), request.query.download === '1')
  })
  app.delete('/api/galleries/:id/photos/:photoId', requireEditor, requireCsrf, (request, response) => {
    const studioId = request.session.studio_id
    const gallery = recordFor(studioId, 'Galleries', request.params.id)
    if (!gallery) return response.status(404).json({ error: 'Gallery not found.' })
    const removed = db.prepare('DELETE FROM gallery_photos WHERE studio_id = ? AND gallery_id = ? AND id = ?').run(studioId, String(gallery.id), request.params.photoId).changes
    if (!removed) return response.status(404).json({ error: 'Photo not found.' })
    response.json({ removed: true, gallery: saveRecord(studioId, 'Galleries', { ...gallery, updated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }) })
  })
  app.get('/api/galleries/:id/shares', requireSession, (request, response) => {
    if (!recordFor(request.session.studio_id, 'Galleries', request.params.id)) return response.status(404).json({ error: 'Gallery not found.' })
    const rows = db.prepare('SELECT recipient, expires_at, created_at, revoked_at FROM gallery_shares WHERE studio_id = ? AND gallery_id = ? ORDER BY created_at DESC').all(request.session.studio_id, request.params.id)
    response.json(rows.map(row => ({ recipient: row.recipient, expiresAt: new Date(row.expires_at).toISOString(), createdAt: new Date(row.created_at).toISOString(), active: !row.revoked_at && row.expires_at > Date.now() })))
  })
  app.post('/api/galleries/:id/shares/revoke', requireEditor, requireCsrf, (request, response) => {
    if (!recordFor(request.session.studio_id, 'Galleries', request.params.id)) return response.status(404).json({ error: 'Gallery not found.' })
    const result = db.prepare('UPDATE gallery_shares SET revoked_at = ? WHERE studio_id = ? AND gallery_id = ? AND revoked_at IS NULL').run(Date.now(), request.session.studio_id, request.params.id)
    response.json({ revoked: result.changes })
  })
  app.get('/api/share/:token', (request, response) => {
    const share = validShare(request.params.token)
    if (!share) return response.status(404).json({ error: 'This gallery link is expired or unavailable.' })
    const gallery = recordFor(share.studio_id, 'Galleries', share.gallery_id)
    const studio = db.prepare('SELECT name FROM studios WHERE id = ?').get(share.studio_id)
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.json({ title: gallery.title, studioName: studio?.name || 'Studio', expiresAt: new Date(share.expires_at).toISOString(), photos: photoList.all(share.studio_id, share.gallery_id).map(row => ({ id: row.id, filename: row.filename, size: row.size })) })
  })
  app.get('/api/share/:token/photos/:photoId', (request, response) => {
    const share = validShare(request.params.token)
    if (!share) return response.status(404).json({ error: 'This gallery link is expired or unavailable.' })
    photoOutput(response, photoById.get(share.studio_id, share.gallery_id, request.params.photoId), request.query.download === '1')
  })
}
