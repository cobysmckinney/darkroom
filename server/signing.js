import { rateLimited } from './auth.js'
import { contractFingerprint, db, getStudioSettings, recordFor, saveRecord } from './database.js'
import { createClientLink, findClientLink } from './clientLinks.js'

const signingLifetime = 30 * 24 * 60 * 60 * 1000
const signatureForLink = db.prepare('SELECT signer_name, signer_email, signed_at, document_hash FROM contract_signatures WHERE link_hash = ?')
const insertSignature = db.prepare('INSERT INTO contract_signatures (studio_id, contract_id, link_hash, document_hash, snapshot, signer_name, signer_email, signer_ip, signer_agent, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
const contractTerms = contract => ({ title: contract.title, client: contract.client, email: contract.email, service: contract.service, eventDate: contract.eventDate, fee: contract.fee, document: contract.document ?? null, terms: contract.terms ?? null })

export function publicStudio(studioId) {
  const row = getStudioSettings.get(studioId)
  return { name: row?.name || 'Studio', businessEmail: row?.business_email || '', businessAddress: row?.business_address || '', phone: row?.phone || '', website: row?.website || '', taxId: row?.tax_id || '', currency: row?.currency || 'USD' }
}

// Returns null when the current terms are already signed, so reminders don't ask twice.
export function signingLinkFor(studioId, contract, recipient, request) {
  if (contract.signature) return null
  const link = createClientLink({ studioId, kind: 'sign', recordId: contract.id, recipient, lifetime: signingLifetime, documentHash: contractFingerprint(contract), snapshot: contractTerms(contract), request })
  return { ...link, label: 'Review and sign your agreement' }
}

function signingState(link) {
  const contract = recordFor(link.studio_id, 'Contracts', link.record_id)
  if (!contract) return { error: [404, 'This signing link is expired or unavailable.'] }
  const row = signatureForLink.get(link.token_hash)
  const signature = row ? { name: row.signer_name, email: row.signer_email, signedAt: new Date(row.signed_at).toISOString(), documentHash: row.document_hash }
    : contract.signature?.documentHash === link.document_hash ? { name: contract.signature.name, email: contract.signature.email, signedAt: contract.signature.signedAt, documentHash: contract.signature.documentHash } : null
  if (!signature && contractFingerprint(contract) !== link.document_hash) return { error: [409, 'This agreement changed after it was sent. Ask your photographer for a new link.'] }
  return { contract, signature }
}

export function signingRoutes(app) {
  app.get('/api/sign/:token', (request, response) => {
    const link = findClientLink('sign', request.params.token)
    if (!link) return response.status(404).json({ error: 'This signing link is expired or unavailable.' })
    const state = signingState(link)
    if (state.error) return response.status(state.error[0]).json({ error: state.error[1] })
    response.json({ studio: publicStudio(link.studio_id), contract: link.snapshot, recipient: link.recipient, expiresAt: new Date(link.expires_at).toISOString(), signature: state.signature })
  })

  app.post('/api/sign/:token', (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.replace(/\s+/g, ' ').trim() : ''
    if (name.length < 2 || name.length > 120 || /[\x00-\x1f\x7f]/.test(name)) return response.status(400).json({ error: 'Type your full name to sign.' })
    if (request.body?.consent !== true) return response.status(400).json({ error: 'Confirm that you agree to sign electronically.' })
    if (rateLimited(`sign:${request.ip}`)) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
    const link = findClientLink('sign', request.params.token)
    if (!link) return response.status(404).json({ error: 'This signing link is expired or unavailable.' })
    db.exec('BEGIN IMMEDIATE')
    try {
      const state = signingState(link)
      if (state.error) { db.exec('ROLLBACK'); return response.status(state.error[0]).json({ error: state.error[1] }) }
      if (state.signature) { db.exec('ROLLBACK'); return response.status(409).json({ error: 'This agreement is already signed.' }) }
      const signedAt = Date.now()
      insertSignature.run(link.studio_id, link.record_id, link.token_hash, link.document_hash, JSON.stringify(link.snapshot), name, link.recipient, request.ip || '', String(request.get('User-Agent') || '').slice(0, 300), signedAt)
      saveRecord(link.studio_id, 'Contracts', { ...state.contract, status: 'Signed', signedDate: new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })
      db.exec('COMMIT')
      response.status(201).json({ signature: { name, email: link.recipient, signedAt: new Date(signedAt).toISOString(), documentHash: link.document_hash } })
    } catch (error) {
      db.exec('ROLLBACK')
      console.error('Signing failed:', error)
      response.status(500).json({ error: 'The agreement could not be signed. Please try again.' })
    }
  })
}
