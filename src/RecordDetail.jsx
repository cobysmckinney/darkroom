import React, { useState } from 'react'
import { ArrowRight, Check, Download, Mail } from 'lucide-react'
import ContractDocument from './ContractDocument.jsx'
import { displayDate } from './format.js'
import { invoiceTotals, money } from './invoice.js'

const dateTime = value => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function RecordDetail({ item, page, canEdit, projects, onAssign, onSaveTemplate, onBack, onEdit, onStatus, onDownload, onEmail }) {
  const [assignProject, setAssignProject] = useState('')
  const title = item.name || item.title || item.subject
  const isDocument = page === 'Invoices' || page === 'Contracts'
  const totals = page === 'Invoices' ? invoiceTotals(item) : null
  const lastSent = item.lastSentAt ? [['Last emailed', dateTime(item.lastSentAt)]] : []
  const rows = page === 'Projects' ? [['Client', item.client], ['Type', item.type], ['Date', displayDate(item.date)], ['Location', item.location], ['Status', item.status]]
    : page === 'Clients' ? [['Email', item.email], ['Phone', item.phone], ['Projects', item.projects]]
    : page === 'Galleries' ? [['Client', item.client], ['Photos', item.count], ['Last updated', item.updated], ['Status', item.status]]
    : page === 'Invoices' ? [['Client', item.client], ['Email', item.email], ['Amount', money(totals.total, totals.currency)], ['Balance due', money(totals.balance, totals.currency)], ['Due date', displayDate(item.due)], ['Status', item.status], ...lastSent]
    : page === 'Contracts' ? [['Client', item.client], ['Email', item.email], ['Services', item.service || 'Photography services'], ['Event date', displayDate(item.eventDate)], ['Fee', item.fee ? `$${Number(item.fee).toLocaleString('en-US')}` : 'To be agreed'], ['Status', item.status], ...lastSent]
    : [['Recipient', item.recipient], ['Date', item.date], ['Status', item.status], ['Attachments', item.attachmentRefs?.length ? `${item.attachmentRefs.length} PDF document${item.attachmentRefs.length === 1 ? '' : 's'}` : 'None']]
  const action = { Projects: ['Mark delivered', 'Delivered'], Galleries: ['Mark delivered', 'Delivered'], Invoices: ['Mark paid', 'Paid'], Contracts: ['Mark signed', 'Signed'] }[page]
  return <section className="detail">
    <button className="back-link" onClick={onBack}>← &nbsp; Back to {page.toLowerCase()}</button>
    <div className="detail-head"><div><span className="detail-kicker">{page === 'Email' ? 'EMAIL' : page.slice(0, -1).toUpperCase()}</span><h2>{title}</h2><p>{item.description || (page === 'Email' ? item.body || 'Email draft' : isDocument ? 'Your PDF is generated from these details.' : 'All the details in one place.')}</p></div></div>
    {page === 'Projects' && item.id === 1 && <div className="detail-image"><img src="/images/emma-daniel.png" alt="Emma and Daniel wedding portrait"/></div>}
    <div className="detail-content"><h3>Details</h3>{rows.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}
      {canEdit && !item.projectId && ['Galleries', 'Invoices', 'Contracts'].includes(page) && <div className="assign-project"><strong>Place in a project before sending</strong><select aria-label="Choose project for record" value={assignProject} onChange={event => setAssignProject(event.target.value)}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select><button className="secondary" disabled={!assignProject} onClick={() => onAssign(assignProject)}>Move to project</button></div>}
      {page === 'Contracts' && item.signature && <div className="signature-record"><strong>Signed electronically by {item.signature.name}</strong>{item.signature.email} · {dateTime(item.signature.signedAt)} · IP {item.signature.ip || 'unknown'}<br/><code>Document fingerprint {item.signature.documentHash}</code></div>}
      {page === 'Contracts' && <div className="contract-terms"><span>AGREEMENT</span><ContractDocument content={item.document} legacyTerms={item.terms}/></div>}
      {page === 'Invoices' && item.lineItems?.length > 0 && <div className="invoice-detail-lines"><h3>Line items</h3>{item.lineItems.map((line, index) => <div key={index}><span>{line.description} · {line.quantity} × {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(line.unitPrice)}</span><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(line.quantity * line.unitPrice)}</strong></div>)}</div>}
      {page === 'Invoices' && item.onlinePayments?.length > 0 && <div className="payment-record"><strong>Paid online</strong>{item.onlinePayments.map(payment => <div key={payment.reference}>{money(payment.amount, payment.currency)} · {dateTime(payment.paidAt)} · Stripe {payment.reference}</div>)}</div>}
      {page === 'Projects' && <div className="detail-progress"><span>Progress</span><strong>{item.progress}%</strong><div className="progress-line"><i style={{ width: `${item.progress}%` }}/></div></div>}
      <div className="detail-buttons">
        {isDocument && <><button className="secondary" onClick={onDownload}><Download size={16}/> Download PDF</button>{canEdit && <><button className="secondary" onClick={onEdit}>Edit {page === 'Invoices' ? 'invoice' : 'contract'}</button>{item.projectId && <button className="primary" onClick={onEmail}><Mail size={16}/> {page === 'Contracts' && !item.signature ? 'Email for signature' : 'Email PDF'}</button>}{page === 'Contracts' && <button className="secondary" onClick={() => onSaveTemplate(item)}>Save as template</button>}</>}</>}
        {canEdit && page === 'Email' && item.status !== 'Sent' && <button className="primary" onClick={onEmail}>Open draft <ArrowRight size={16}/></button>}
        {canEdit && action && item.status !== action[1] && <button className="secondary" onClick={() => onStatus(action[1], `${title} marked ${action[1].toLowerCase()}`)}>{action[0]} <Check size={16}/></button>}
      </div>
    </div>
  </section>
}
