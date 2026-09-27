import React, { useEffect, useState } from 'react'
import { Check, Download, Lock } from 'lucide-react'
import { displayDate } from './format.js'
import { money } from './invoice.js'
import { downloadDocument } from './pdf.js'
import { usePublicLink } from './publicLink.js'
import { ClientPage } from './SignContract.jsx'

// Returning from Stripe Checkout: confirm the session before showing the balance.
const confirmReturn = async (request, token) => {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  if (!sessionId) return
  window.history.replaceState({}, '', window.location.pathname)
  await request(`/api/pay/${encodeURIComponent(token)}/confirm`, { sessionId }).catch(() => {})
}

export default function PayInvoice() {
  const { token, data, error, request, load } = usePublicLink('pay', confirmReturn)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  useEffect(() => { if (data) document.title = `${data.invoice.title} — ${data.studio.name}` }, [data])

  const pay = async () => {
    setBusy(true); setActionError('')
    try { window.location.assign((await request(`/api/pay/${encodeURIComponent(token)}/checkout`, {})).url) }
    catch (cause) { setActionError(cause.message); setBusy(false) }
  }
  const download = () => downloadDocument('Invoices', data.invoice, data.studio.name, data.studio).catch(() => setActionError('The PDF could not be generated.'))

  if (error) return <ClientPage kicker="INVOICE"><main className="shared-gallery-error"><h1>Invoice unavailable</h1><p>{error}</p><p>Ask your photographer for a new link.</p></main></ClientPage>
  if (!data) return <ClientPage kicker="INVOICE"><main className="shared-gallery-error"><h1>Opening invoice…</h1></main></ClientPage>
  const { invoice, studio, totals } = data
  const currency = totals.currency
  return <ClientPage kicker="INVOICE">
    <main className="client-document">
      <div className="shared-gallery-heading"><p>From {studio.name}</p><h1>{invoice.title}</h1><span>Billed to {invoice.client} · Issued {displayDate(invoice.issued) || '—'} · Due {displayDate(invoice.due) || '—'}</span></div>
      <div className="client-document-body">
        <section>
          <div className="client-lines">{totals.lines.map((line, index) => <div key={index}><span>{line.description}<small>{line.quantity} × {money(line.unitPrice, currency)}</small></span><strong>{money(line.quantity * line.unitPrice, currency)}</strong></div>)}</div>
          <div className="client-totals">
            <div><span>Subtotal</span><span>{money(totals.subtotal, currency)}</span></div>
            {totals.discount > 0 && <div><span>Discount</span><span>−{money(totals.discount, currency)}</span></div>}
            {totals.tax > 0 && <div><span>Tax ({totals.taxRate}%)</span><span>{money(totals.tax, currency)}</span></div>}
            <div><strong>Total</strong><strong>{money(totals.total, currency)}</strong></div>
            {totals.paid > 0 && <div><span>Paid</span><span>−{money(totals.paid, currency)}</span></div>}
            <div className="client-balance"><strong>Balance due</strong><strong>{money(totals.balance, currency)}</strong></div>
          </div>
          {invoice.paymentTerms && <><span className="client-label">PAYMENT TERMS</span><p>{invoice.paymentTerms}</p></>}
          {invoice.notes && <><span className="client-label">NOTES</span><p>{invoice.notes}</p></>}
        </section>
        <aside className="client-panel">
          {totals.balance <= 0 ? <div className="client-confirmation"><Check size={22}/><h2>Paid in full</h2><p>Thank you. {studio.name} has received your payment.</p></div>
            : data.payable ? <div><h2>Pay {money(totals.balance, currency)}</h2><p className="client-fine">You will be taken to Stripe to pay securely by card.</p>{actionError && <p className="form-error" role="alert">{actionError}</p>}<button className="primary" onClick={pay} disabled={busy}><Lock size={15}/> {busy ? 'Opening checkout…' : 'Pay securely'}</button><p className="client-fine">Already paid? <button type="button" className="text-button" onClick={() => load().catch(cause => setActionError(cause.message))}>Refresh</button></p></div>
            : <div><h2>{money(totals.balance, currency)} due</h2><p className="client-fine">Online payment is not available for this invoice. Contact {studio.name}{studio.businessEmail ? ` at ${studio.businessEmail}` : ''} to arrange payment.</p></div>}
          <button className="secondary" onClick={download}><Download size={16}/> Download PDF</button>
        </aside>
      </div>
    </main>
  </ClientPage>
}
