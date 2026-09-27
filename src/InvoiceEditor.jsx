import React, { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { invoiceTotals, money } from './invoice.js'
import { dateInput } from './format.js'


export default function InvoiceEditor({ item, settings, projects, clients, currentProjectId, onSave, onClose }) {
  const initialProjectId = item?.projectId || (projects.some(project => String(project.id) === String(currentProjectId)) ? currentProjectId : '')
  const initialProject = projects.find(project => String(project.id) === String(initialProjectId))
  const [projectId, setProjectId] = useState(String(initialProjectId))
  const [client, setClient] = useState(item?.client || initialProject?.client || '')
  const [email, setEmail] = useState(item?.email || initialProject?.clientEmail || clients.find(person => person.name === initialProject?.client)?.email || '')
  const [lines, setLines] = useState(item?.lineItems?.length ? item.lineItems : [{ description: item?.service || '', quantity: 1, unitPrice: item ? Number(String(item.amount || '0').replace(/[^\d.]/g, '')) : '' }])
  const [taxRate, setTaxRate] = useState(item?.taxRate ?? 0)
  const [discount, setDiscount] = useState(item?.discount ?? 0)
  const [amountPaid, setAmountPaid] = useState(item?.amountPaid ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currency = item?.currency || settings?.currency || 'USD'
  const invoiceNumber = item?.invoiceNumber || item?.title?.match(/#(.+)$/)?.[1] || String(Date.now()).slice(-6)
  const totals = invoiceTotals({ lineItems: lines, taxRate, discount, amountPaid, onlinePayments: item?.onlinePayments, currency })
  const updateLine = (index, key, value) => setLines(previous => previous.map((line, position) => position === index ? { ...line, [key]: value } : line))
  const chooseProject = value => {
    setProjectId(value)
    if (!item) {
      const project = projects.find(row => String(row.id) === value)
      setClient(project?.client || '')
      setEmail(project?.clientEmail || clients.find(person => person.name === project?.client)?.email || '')
    }
  }
  const submit = async event => {
    event.preventDefault()
    const project = projects.find(row => String(row.id) === projectId)
    if (!project) { setError('Choose a project.'); return }
    if (lines.some(line => !String(line.description).trim() || Number(line.quantity) <= 0 || Number(line.unitPrice) < 0)) { setError('Complete each line item with a description, quantity, and price.'); return }
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const number = values.invoiceNumber.trim()
    setBusy(true); setError('')
    try { await onSave({ ...item, id: item?.id || crypto.randomUUID(), projectId: project.id, scope: 'project', title: `Invoice #${number}`, invoiceNumber: number, client: client.trim(), email: email.trim(), clientAddress: values.clientAddress.trim(), issued: values.issued, due: values.due, lineItems: lines.map(line => ({ description: String(line.description).trim(), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })), taxRate: Number(taxRate), discount: Number(discount), amountPaid: Number(amountPaid), currency, amount: money(totals.total, currency), balanceDue: money(totals.balance, currency), paymentTerms: values.paymentTerms.trim(), notes: values.notes.trim(), status: item?.status || 'Draft', service: lines.map(line => line.description).join(', ') }) }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal document-modal" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-head"><div><span>INVOICE</span><h2>{item ? 'Edit invoice' : 'New invoice'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit} className="document-form"><div className="document-fields">
      <label>Project<select name="projectId" required value={projectId} onChange={event => chooseProject(event.target.value)}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>
      <label>Invoice number<input name="invoiceNumber" required defaultValue={invoiceNumber}/></label>
      <label>Client<input name="client" required value={client} onChange={event => setClient(event.target.value)} placeholder="Client name"/></label>
      <label>Client email<input name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="client@example.com"/></label>
      <label>Client address<input name="clientAddress" defaultValue={item?.clientAddress || ''} placeholder="Street, city, postal code"/></label>
      <label>Issue date<input name="issued" type="date" required defaultValue={dateInput(item?.issued) || new Date().toISOString().slice(0, 10)}/></label>
      <label>Due date<input name="due" type="date" required defaultValue={dateInput(item?.due)}/></label>
    </div><div className="invoice-lines"><div className="invoice-lines-head"><h3>Line items</h3><button type="button" className="secondary" onClick={() => setLines([...lines, { description: '', quantity: 1, unitPrice: '' }])}><Plus size={15}/> Add item</button></div>
      {lines.map((line, index) => <div className="invoice-line" key={index}><label>Description<input required value={line.description} onChange={event => updateLine(index, 'description', event.target.value)} placeholder="Photography service"/></label><label>Qty<input type="number" min="0.01" step="0.01" required value={line.quantity} onChange={event => updateLine(index, 'quantity', event.target.value)}/></label><label>Rate<input type="number" min="0" step="0.01" required value={line.unitPrice} onChange={event => updateLine(index, 'unitPrice', event.target.value)}/></label><strong>{money(Number(line.quantity) * Number(line.unitPrice), currency)}</strong><button type="button" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, position) => position !== index))}><Trash2 size={16}/></button></div>)}
    </div><div className="invoice-extras"><label>Discount ({currency})<input type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)}/></label><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={event => setTaxRate(event.target.value)}/></label><label>Amount paid ({currency})<input type="number" min="0" step="0.01" value={amountPaid} onChange={event => setAmountPaid(event.target.value)}/></label></div>
    <div className="invoice-total"><span>Subtotal {money(totals.subtotal, currency)}</span><span>Tax {money(totals.tax, currency)}</span>{totals.onlinePaid > 0 && <span>Paid online {money(totals.onlinePaid, currency)}</span>}<strong>Balance due {money(totals.balance, currency)}</strong></div><label>Payment terms<textarea name="paymentTerms" rows="2" defaultValue={item?.paymentTerms || settings?.paymentTerms || ''} placeholder="Payment due within 14 days"/></label><label>Notes<textarea name="notes" rows="2" defaultValue={item?.notes || settings?.invoiceNotes || ''} placeholder="Thank you for your business"/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save invoice'}</button></div></form>
  </div></div>
}
