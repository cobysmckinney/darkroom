import React, { useEffect, useState } from 'react'
import { Check, Download } from 'lucide-react'
import ContractDocument from './ContractDocument.jsx'
import { displayDate } from './format.js'
import { money } from './invoice.js'
import { downloadDocument } from './pdf.js'
import { usePublicLink } from './publicLink.js'

const longDate = value => new Date(value).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function SignContract() {
  const { token, data, setData, error, request } = usePublicLink('sign')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => { if (data) document.title = `${data.contract.title} — ${data.studio.name}` }, [data])

  const sign = async event => {
    event.preventDefault()
    setBusy(true); setFormError('')
    try {
      const result = await request(`/api/sign/${encodeURIComponent(token)}`, { name, consent })
      setData(previous => ({ ...previous, signature: result.signature }))
    } catch (cause) { setFormError(cause.message) }
    finally { setBusy(false) }
  }
  const download = () => downloadDocument('Contracts', { ...data.contract, signature: data.signature || undefined }, data.studio.name, data.studio).catch(() => setFormError('The PDF could not be generated.'))

  if (error) return <ClientPage kicker="PRIVATE AGREEMENT"><main className="shared-gallery-error"><h1>Agreement unavailable</h1><p>{error}</p><p>Ask your photographer for a new link.</p></main></ClientPage>
  if (!data) return <ClientPage kicker="PRIVATE AGREEMENT"><main className="shared-gallery-error"><h1>Opening agreement…</h1></main></ClientPage>
  const { contract, studio, signature } = data
  return <ClientPage kicker="PRIVATE AGREEMENT">
    <main className="client-document">
      <div className="shared-gallery-heading"><p>From {studio.name}</p><h1>{contract.title}</h1><span>Prepared for {contract.client} · Event date {displayDate(contract.eventDate) || 'to be confirmed'} · Fee {contract.fee ? money(contract.fee, studio.currency) : 'to be agreed'}</span></div>
      <div className="client-document-body">
        <section><span className="client-label">SERVICES</span><p>{contract.service || 'Photography services'}</p><span className="client-label">AGREEMENT</span><ContractDocument content={contract.document} legacyTerms={contract.terms}/></section>
        <aside className="client-panel">
          {signature ? <div className="client-confirmation"><Check size={22}/><h2>Signed</h2><p>{signature.name} signed this agreement on {longDate(signature.signedAt)}.</p><p className="client-fine">A copy is on file with {studio.name}.</p></div>
            : <form onSubmit={sign}><h2>Sign this agreement</h2><p className="client-fine">Read the full agreement before signing. Contact {studio.name}{studio.businessEmail ? ` at ${studio.businessEmail}` : ''} with any questions.</p><label>Your full name<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} autoComplete="name" placeholder={contract.client}/></label><label className="check-label client-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/> I agree to sign electronically, and my typed name is my signature.</label>{name.trim() && <div className="client-signature-preview" aria-hidden="true">{name.trim()}</div>}{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary" disabled={busy || !consent || name.trim().length < 2}>{busy ? 'Signing…' : 'Sign agreement'}</button><p className="client-fine">Signing as {data.recipient}. This link expires {new Date(data.expiresAt).toLocaleDateString()}.</p></form>}
          <button className="secondary" onClick={download}><Download size={16}/> Download {signature ? 'signed ' : ''}PDF</button>
        </aside>
      </div>
    </main>
  </ClientPage>
}

export function ClientPage({ kicker, children }) {
  return <div className="shared-gallery"><header className="shared-gallery-top"><span>darkroom</span><small>{kicker}</small></header>{children}</div>
}
