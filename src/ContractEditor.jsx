import React, { useState } from 'react'
import { X } from 'lucide-react'
import { dateInput } from './format.js'
import RichTextEditor from './RichTextEditor.jsx'

const defaultDocument = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe the services, deliverables, schedule, payment, cancellation, and usage rights you and your client agreed to.' }] }] }
const legacyDocument = terms => ({ type: 'doc', content: String(terms || '').split('\n').map(text => text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }) })

export default function ContractEditor({ item, template, projects, clients, currentProjectId, onSave, onClose }) {
  const initialProjectId = item?.projectId || (projects.some(project => String(project.id) === String(currentProjectId)) ? currentProjectId : '')
  const initialProject = projects.find(project => String(project.id) === String(initialProjectId))
  const [projectId, setProjectId] = useState(String(initialProjectId))
  const [client, setClient] = useState(item?.client || initialProject?.client || '')
  const [email, setEmail] = useState(item?.email || initialProject?.clientEmail || clients.find(person => person.name === initialProject?.client)?.email || '')
  const initialContent = item?.document || (item?.terms ? legacyDocument(item.terms) : template?.document || (template?.terms ? legacyDocument(template.terms) : defaultDocument))
  const [document, setDocument] = useState(initialContent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const project = projects.find(row => String(row.id) === projectId)
    if (!project) { setError('Choose a project.'); return }
    if (!document?.content?.length) { setError('Write the agreement before saving.'); return }
    setBusy(true); setError('')
    try { await onSave({ ...item, id: item?.id || crypto.randomUUID(), projectId: project.id, scope: 'project', title: values.title.trim(), client: client.trim(), email: email.trim(), service: values.service.trim(), eventDate: values.eventDate || 'To be confirmed', fee: values.fee || '', document, terms: undefined, status: 'Draft', sent: 'Not sent' }) }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal document-modal" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-head"><div><span>CONTRACT DOCUMENT</span><h2>{item ? 'Edit contract' : 'New contract'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit} className="document-form"><div className="document-fields">
      <label>Project<select name="projectId" required value={projectId} onChange={event => chooseProject(event.target.value)}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>
      <label>Title<input name="title" required defaultValue={item?.title || template?.title || ''} placeholder="Wedding photography agreement"/></label>
      <label>Client<input name="client" required value={client} onChange={event => setClient(event.target.value)} placeholder="Client name"/></label>
      <label>Client email<input name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="client@example.com"/></label>
      <label>Services<input name="service" required defaultValue={item?.service || ''} placeholder="Coverage and edited gallery"/></label>
      <label>Event date<input name="eventDate" type="date" defaultValue={dateInput(item?.eventDate)}/></label>
      <label>Fee<input name="fee" type="number" min="0" step="0.01" defaultValue={item?.fee || ''} placeholder="0.00"/></label>
    </div><div><label className="editor-label">Agreement text</label><RichTextEditor initial={initialContent} onChange={setDocument}/><p className="form-note">Saving changes returns the agreement to Draft so you can review and resend it.</p></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save contract'}</button></div></form>
  </div></div>
}
