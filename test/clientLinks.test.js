import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, createProject, registerStudio, startServer } from './helpers.js'
import { verifyStripeSignature } from '../server/payments.js'
import { invoiceTotals } from '../src/invoice.js'

// Minimal Stripe stand-in: remembers created checkout sessions and lets tests mark them paid.
const stripe = { sessions: new Map(), requests: [] }
const stripeFetch = async (url, { method, headers, body }) => {
  stripe.requests.push({ url, method, headers, body: body ? new URLSearchParams(body) : null })
  const path = new URL(url).pathname
  if (method === 'POST' && path === '/v1/checkout/sessions') {
    const form = new URLSearchParams(body)
    const session = { id: `cs_test_${stripe.sessions.size + 1}`, url: `https://checkout.stripe.test/${stripe.sessions.size + 1}`, amount_total: Number(form.get('line_items[0][price_data][unit_amount]')), currency: form.get('line_items[0][price_data][currency]'), payment_status: 'unpaid', metadata: { studio_id: form.get('metadata[studio_id]'), invoice_id: form.get('metadata[invoice_id]'), link: form.get('metadata[link]') } }
    stripe.sessions.set(session.id, session)
    return Response.json(session)
  }
  const session = stripe.sessions.get(path.split('/').pop())
  return session ? Response.json(session) : Response.json({ error: { message: 'No such session' } }, { status: 404 })
}

let server
beforeAll(async () => { server = await startServer({ stripeFetch }) })
afterAll(() => server.close())

async function studioWithEmail({ payments = false } = {}) {
  const owner = await registerStudio(server.origin)
  await owner.put('/api/studios/current/settings', { name: 'Light & Co', smtpHost: 'smtp.example.com', smtpFrom: 'Studio <hello@example.com>', ...(payments ? { stripeSecretKey: 'sk_test_abc123', stripeWebhookSecret: 'whsec_secret123' } : {}) })
  const project = await createProject(owner)
  return { owner, project }
}
const pdf = { filename: 'document.pdf', content: Buffer.from('%PDF-1.4 test').toString('base64') }
const linkFrom = (message, kind) => message.text.match(new RegExp(`/${kind}/([A-Za-z0-9_-]{43})`))?.[1]

async function sendDocument(owner, project, type, item) {
  await owner.put(`/api/records/${type}`, item)
  const result = await owner.post('/api/email/send', { to: 'jamie@example.com', subject: 'Documents', body: 'Please review.', projectId: project.id, attachments: [pdf], attachmentRefs: [{ type, id: item.id }] })
  expect(result.status).toBe(200)
  return result
}

describe('contract signing', () => {
  const contract = project => ({ id: `c-${Math.random()}`, projectId: project.id, scope: 'project', title: 'Wedding agreement', client: 'Jamie Lee', email: 'jamie@example.com', service: 'Coverage', eventDate: '2026-10-12', fee: '3200', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Terms.' }] }] }, status: 'Draft', sent: 'Not sent' })

  it('emails a signing link that the client can use once', async () => {
    const { owner, project } = await studioWithEmail()
    const item = contract(project)
    const sent = await sendDocument(owner, project, 'Contracts', item)
    expect(sent.data.updatedDocuments[0].item.status).toBe('Awaiting signature')
    const token = linkFrom(server.sent.at(-1), 'sign')
    expect(server.sent.at(-1).html).toContain('Review and sign your agreement')

    const visitor = client(server.origin)
    const view = await visitor.get(`/api/sign/${token}`)
    expect(view.status).toBe(200)
    expect(view.data).toMatchObject({ studio: { name: 'Light & Co' }, contract: { title: 'Wedding agreement', fee: '3200' }, signature: null })

    expect((await visitor.post(`/api/sign/${token}`, { name: 'Jamie Lee' })).status).toBe(400)
    const signed = await visitor.post(`/api/sign/${token}`, { name: 'Jamie Lee', consent: true })
    expect(signed.status).toBe(201)
    expect((await visitor.post(`/api/sign/${token}`, { name: 'Jamie Lee', consent: true })).status).toBe(409)

    const saved = (await owner.get('/api/workspace')).data.Contracts.find(row => row.id === item.id)
    expect(saved.status).toBe('Signed')
    expect(saved.signature).toMatchObject({ name: 'Jamie Lee', email: 'jamie@example.com' })
    expect((await visitor.get(`/api/sign/${token}`)).data.signature.name).toBe('Jamie Lee')
  })

  it('does not let a studio editor forge or keep a signature on changed terms', async () => {
    const { owner, project } = await studioWithEmail()
    const item = contract(project)
    const forged = await owner.put('/api/records/Contracts', { ...item, signature: { name: 'Forged' } })
    expect(forged.data.signature).toBeUndefined()

    await sendDocument(owner, project, 'Contracts', item)
    await client(server.origin).post(`/api/sign/${linkFrom(server.sent.at(-1), 'sign')}`, { name: 'Jamie Lee', consent: true })
    const current = (await owner.get('/api/workspace')).data.Contracts.find(row => row.id === item.id)
    const edited = await owner.put('/api/records/Contracts', { ...current, fee: '9999' })
    expect(edited.data.signature).toBeUndefined()
  })

  it('refuses to sign terms that changed after sending', async () => {
    const { owner, project } = await studioWithEmail()
    const item = contract(project)
    await sendDocument(owner, project, 'Contracts', item)
    const token = linkFrom(server.sent.at(-1), 'sign')
    await owner.put('/api/records/Contracts', { ...item, fee: '100' })
    expect((await client(server.origin).post(`/api/sign/${token}`, { name: 'Jamie Lee', consent: true })).status).toBe(409)
  })

  it('rejects unknown tokens', async () => {
    expect((await client(server.origin).get(`/api/sign/${'a'.repeat(43)}`)).status).toBe(404)
  })
})

describe('invoice payments', () => {
  const invoice = project => ({ id: `i-${Math.random()}`, projectId: project.id, scope: 'project', title: 'Invoice #1001', invoiceNumber: '1001', client: 'Jamie Lee', email: 'jamie@example.com', lineItems: [{ description: 'Coverage', quantity: 2, unitPrice: 500 }], taxRate: 10, discount: 100, amountPaid: 90, currency: 'USD', status: 'Draft' })

  it('adds no payment link until Stripe is configured', async () => {
    const { owner, project } = await studioWithEmail()
    await sendDocument(owner, project, 'Invoices', invoice(project))
    expect(linkFrom(server.sent.at(-1), 'pay')).toBeUndefined()
  })

  it('charges the server-computed balance and records the payment once', async () => {
    const { owner, project } = await studioWithEmail({ payments: true })
    const item = invoice(project)
    await sendDocument(owner, project, 'Invoices', item)
    const token = linkFrom(server.sent.at(-1), 'pay')
    const visitor = client(server.origin)
    const view = await visitor.get(`/api/pay/${token}`)
    expect(view.data.totals).toMatchObject({ total: 990, balance: 900 })
    expect(view.data.payable).toBe(true)

    const checkout = await visitor.post(`/api/pay/${token}/checkout`, {})
    expect(checkout.status).toBe(200)
    const request = stripe.requests.at(-1)
    expect(request.headers.Authorization).toBe('Bearer sk_test_abc123')
    expect(request.body.get('line_items[0][price_data][unit_amount]')).toBe('90000')
    expect(request.body.get('customer_email')).toBe('jamie@example.com')

    const session = [...stripe.sessions.values()].at(-1)
    expect((await visitor.post(`/api/pay/${token}/confirm`, { sessionId: session.id })).data.paid).toBe(false)
    session.payment_status = 'paid'
    expect((await visitor.post(`/api/pay/${token}/confirm`, { sessionId: session.id })).data.paid).toBe(true)
    await visitor.post(`/api/pay/${token}/confirm`, { sessionId: session.id })

    const saved = (await owner.get('/api/workspace')).data.Invoices.find(row => row.id === item.id)
    expect(saved.status).toBe('Paid')
    expect(saved.onlinePayments).toHaveLength(1)
    expect(invoiceTotals(saved).balance).toBe(0)
    expect((await visitor.get(`/api/pay/${token}`)).data.payable).toBe(false)
    expect((await visitor.post(`/api/pay/${token}/checkout`, {})).status).toBe(409)
  })

  it('records payments from signed webhooks only', async () => {
    const { owner, project } = await studioWithEmail({ payments: true })
    const item = invoice(project)
    await owner.put('/api/records/Invoices', item)
    const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_hook', amount_total: 40000, currency: 'usd', payment_status: 'paid', metadata: { studio_id: owner.user.studioId, invoice_id: item.id } } } })
    const post = header => fetch(`${server.origin}/api/stripe/webhook/${owner.user.studioId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: event })
    const timestamp = Math.floor(Date.now() / 1000)
    expect((await post(`t=${timestamp},v1=${createHmac('sha256', 'wrong').update(`${timestamp}.${event}`).digest('hex')}`)).status).toBe(400)
    expect((await post(`t=${timestamp},v1=${createHmac('sha256', 'whsec_secret123').update(`${timestamp}.${event}`).digest('hex')}`)).status).toBe(200)

    const saved = (await owner.get('/api/workspace')).data.Invoices.find(row => row.id === item.id)
    expect(saved).toMatchObject({ status: 'Partially paid', balanceDue: '$500.00' })
    expect(saved.onlinePayments[0]).toMatchObject({ amount: 400, reference: 'cs_test_hook' })
    const forged = await owner.put('/api/records/Invoices', { ...saved, onlinePayments: [{ amount: 5000 }] })
    expect(forged.data.onlinePayments).toEqual(saved.onlinePayments)
  })

  it('rejects stale webhook signatures', () => {
    const payload = '{}'
    const old = 1_000_000
    const header = `t=${old},v1=${createHmac('sha256', 'whsec_x').update(`${old}.${payload}`).digest('hex')}`
    expect(verifyStripeSignature(payload, header, 'whsec_x', old + 10)).toBe(true)
    expect(verifyStripeSignature(payload, header, 'whsec_x', old + 3600)).toBe(false)
  })
})

describe('invoice totals', () => {
  it('handles legacy amount-only invoices', () => {
    expect(invoiceTotals({ amount: '$2,800.00', amountPaid: 800 })).toMatchObject({ total: 2800, balance: 2000 })
  })
  it('never reports a negative balance', () => {
    expect(invoiceTotals({ lineItems: [{ quantity: 1, unitPrice: 10 }], amountPaid: 50 }).balance).toBe(0)
  })
})
