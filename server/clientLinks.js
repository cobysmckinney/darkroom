import { createHash, randomBytes } from 'node:crypto'
import { db } from './database.js'

// Signing and payment links for clients without accounts. Only a hash of each token is stored.
export const linkErrors = new Set(['A public app URL is required to send client links.', 'Client links require HTTPS.'])
const hashToken = token => createHash('sha256').update(token).digest('hex')
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const findLink = db.prepare('SELECT * FROM client_links WHERE token_hash = ? AND kind = ? AND expires_at > ? AND revoked_at IS NULL')

export function publicBase(request) {
  const base = process.env.PUBLIC_BASE_URL || request.get('Origin')
  if (!base) throw new Error('A public app URL is required to send client links.')
  const parsed = new URL(base)
  if (!['https:', 'http:'].includes(parsed.protocol) || (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) throw new Error('Client links require HTTPS.')
  return parsed
}

export function createClientLink({ studioId, kind, recordId, recipient, lifetime, documentHash = null, snapshot = null, request }) {
  const base = publicBase(request)
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  db.prepare('INSERT INTO client_links (token_hash, studio_id, kind, record_id, recipient, document_hash, snapshot, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(hashToken(token), studioId, kind, String(recordId), recipient.trim().toLowerCase(), documentHash, snapshot ? JSON.stringify(snapshot) : null, now + lifetime, now)
  return { token, url: new URL(`/${kind}/${token}`, base).toString(), expiresAt: new Date(now + lifetime).toISOString() }
}

export function findClientLink(kind, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const link = findLink.get(hashToken(token), kind, Date.now())
  return link ? { ...link, snapshot: link.snapshot ? JSON.parse(link.snapshot) : null } : null
}

export function revokeClientLinks(links) {
  const revoke = db.prepare('UPDATE client_links SET revoked_at = ? WHERE token_hash = ?')
  for (const link of links) revoke.run(Date.now(), hashToken(link.token))
}

export function linksMessage(text, links) {
  if (!links.length) return text
  return [text.trim(), ...links.map(link => `${link.label}: ${link.url}\nThis private link expires ${new Date(link.expiresAt).toLocaleDateString('en-US')}.`)].join('\n\n')
}

export function linksHtml(links) {
  return links.map(link => `<p style="margin-top:24px"><a href="${link.url}" rel="noreferrer">${escapeHtml(link.label)}</a><br><small>This private link expires ${new Date(link.expiresAt).toLocaleDateString('en-US')}.</small></p>`).join('')
}
