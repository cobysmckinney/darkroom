import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { rateLimited } from './auth.js'
import { db, getStudioSettings, recordFor, saveRecord } from './database.js'
import { decrypt } from './secrets.js'
import { createClientLink, findClientLink, linkErrors, publicBase } from './clientLinks.js'
import { publicStudio } from './signing.js'
import { invoiceTotals, money } from '../src/invoice.js'

const paymentLifetime = 60 * 24 * 60 * 60 * 1000
const webhookTolerance = 5 * 60
const insertPayment = db.prepare('INSERT OR IGNORE INTO invoice_payments (provider_id, studio_id, invoice_id, provider, amount_cents, currency, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)')

export function stripeFor(studioId) {
  const row = getStudioSettings.get(studioId)
  return row?.stripe_secret_key ? { secretKey: decrypt(row.stripe_secret_key), webhookSecret: decrypt(row.stripe_webhook_secret || '') } : null
}

// Returns null when payments are off or nothing is owed, so the email simply has no payment link.
export function paymentLinkFor(studioId, invoice, recipient, request) {
  if (!stripeFor(studioId) || invoiceTotals(invoice, publicStudio(studioId).currency).balance <= 0) return null
  const link = createClientLink({ studioId, kind: 'pay', recordId: invoice.id, recipient, lifetime: paymentLifetime, request })
  return { ...link, label: `Pay ${invoice.title || 'your invoice'} online` }
}

// Stripe expects nested form fields such as line_items[0][price_data][currency].
function formBody(params, prefix = '', body = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (typeof value === 'object') formBody(value, name, body)
    else body.append(name, String(value))
  }
  return body
}

export function verifyStripeSignature(payload, header, secret, now = Math.floor(Date.now() / 1000)) {
  const parts = String(header || '').split(',').map(part => part.split('='))
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => Buffer.from(value || '', 'hex'))
  if (!secret || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > webhookTolerance) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest()
  return signatures.some(signature => signature.length === expected.length && timingSafeEqual(signature, expected))
}

// Idempotent: Stripe may report the same checkout through the webhook and the return page.
export function recordPayment(studioId, invoiceId, session) {
  const invoice = recordFor(studioId, 'Invoices', invoiceId)
  if (!invoice) return null
  const inserted = insertPayment.run(session.id, studioId, String(invoice.id), 'stripe', session.amount_total, session.currency, Date.now()).changes
  if (!inserted) return invoice
  const totals = invoiceTotals({ ...invoice, onlinePayments: [...(invoice.onlinePayments || []), { amount: session.amount_total / 100 }] }, publicStudio(studioId).currency)
  return saveRecord(studioId, 'Invoices', { ...invoice, status: totals.balance <= 0 ? 'Paid' : 'Partially paid', balanceDue: money(totals.balance, totals.currency) })
}

function paymentSummary(link) {
  const invoice = recordFor(link.studio_id, 'Invoices', link.record_id)
  if (!invoice) return null
  const studio = publicStudio(link.studio_id)
  const totals = invoiceTotals(invoice, studio.currency)
  const fields = ['title', 'invoiceNumber', 'client', 'email', 'clientAddress', 'issued', 'due', 'taxRate', 'discount', 'amountPaid', 'onlinePayments', 'paymentTerms', 'notes', 'status']
  return { studio, invoice: { ...Object.fromEntries(fields.map(field => [field, invoice[field]])), lineItems: totals.lines, currency: totals.currency }, totals, payable: Boolean(stripeFor(link.studio_id)) && totals.balance > 0 }
}

export function paymentRoutes(app, { stripeFetch = fetch } = {}) {
  const stripeRequest = async (secretKey, method, path, params) => {
    const response = await stripeFetch(`https://api.stripe.com${path}`, { method, headers: { Authorization: `Bearer ${secretKey}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: params ? formBody(params).toString() : undefined })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error?.message || 'Stripe request failed.')
    return result
  }

  app.get('/api/pay/:token', (request, response) => {
    const link = findClientLink('pay', request.params.token)
    const summary = link && paymentSummary(link)
    if (!summary) return response.status(404).json({ error: 'This payment link is expired or unavailable.' })
    response.json({ ...summary, expiresAt: new Date(link.expires_at).toISOString() })
  })

  app.post('/api/pay/:token/checkout', async (request, response) => {
    if (rateLimited(`pay:${request.ip}`)) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
    const link = findClientLink('pay', request.params.token)
    const summary = link && paymentSummary(link)
    if (!summary) return response.status(404).json({ error: 'This payment link is expired or unavailable.' })
    const stripe = stripeFor(link.studio_id)
    if (!stripe || !summary.payable) return response.status(409).json({ error: summary.totals.balance > 0 ? 'Online payment is not available for this invoice.' : 'This invoice is already paid.' })
    try {
      const base = publicBase(request)
      const payUrl = new URL(`/pay/${request.params.token}`, base).toString()
      const metadata = { studio_id: link.studio_id, invoice_id: link.record_id, link: link.token_hash }
      const session = await stripeRequest(stripe.secretKey, 'POST', '/v1/checkout/sessions', {
        mode: 'payment',
        customer_email: link.recipient,
        client_reference_id: link.record_id,
        line_items: [{ quantity: 1, price_data: { currency: summary.totals.currency.toLowerCase(), unit_amount: Math.round(summary.totals.balance * 100), product_data: { name: `${summary.invoice.title || 'Invoice'} · ${summary.studio.name}` } } }],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${payUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: payUrl,
      })
      response.json({ url: session.url })
    } catch (error) {
      console.error('Stripe checkout failed:', error)
      response.status(502).json({ error: linkErrors.has(error.message) ? error.message : 'Online payment is unavailable right now. Please try again later.' })
    }
  })

  // The return page confirms with Stripe directly, so payments are recorded even without a webhook.
  app.post('/api/pay/:token/confirm', async (request, response) => {
    const sessionId = request.body?.sessionId
    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{1,200}$/.test(sessionId)) return response.status(400).json({ error: 'Invalid payment session.' })
    if (rateLimited(`pay:${request.ip}`)) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
    const link = findClientLink('pay', request.params.token)
    const stripe = link && stripeFor(link.studio_id)
    if (!stripe) return response.status(404).json({ error: 'This payment link is expired or unavailable.' })
    try {
      const session = await stripeRequest(stripe.secretKey, 'GET', `/v1/checkout/sessions/${sessionId}`)
      if (session.metadata?.link !== link.token_hash || session.metadata?.studio_id !== link.studio_id) return response.status(404).json({ error: 'Payment session not found.' })
      if (session.payment_status === 'paid') recordPayment(link.studio_id, link.record_id, session)
      response.json({ paid: session.payment_status === 'paid' })
    } catch (error) {
      console.error('Stripe confirmation failed:', error)
      response.status(502).json({ error: 'We could not confirm the payment yet. Refresh this page in a moment.' })
    }
  })
}

// Registered before the JSON body parser: signature checks need the exact raw payload.
export function stripeWebhookRoute(app) {
  app.post('/api/stripe/webhook/:studioId', express.raw({ type: () => true, limit: '1mb' }), (request, response) => {
    const stripe = stripeFor(request.params.studioId)
    const payload = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : ''
    if (!stripe?.webhookSecret || !verifyStripeSignature(payload, request.get('Stripe-Signature'), stripe.webhookSecret)) return response.status(400).json({ error: 'Invalid signature.' })
    let event
    try { event = JSON.parse(payload) }
    catch { return response.status(400).json({ error: 'Invalid payload.' }) }
    const session = event.data?.object
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && session?.payment_status === 'paid' && session.metadata?.studio_id === request.params.studioId && session.metadata?.invoice_id) {
      recordPayment(request.params.studioId, session.metadata.invoice_id, session)
    }
    response.json({ received: true })
  })
}
