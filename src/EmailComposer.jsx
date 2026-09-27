import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FileText, X } from 'lucide-react'
import ContractDocument from './ContractDocument.jsx'
import RichTextEditor from './RichTextEditor.jsx'
import { plainText, textDocument } from './richText.js'

export default function EmailComposer({ documentRef, galleryRef, galleries, draft, source, template, projects, invoices, contracts, clients, scope, studioName, displayName, onSave, onSend, onClose }) {
  const allDocuments = useMemo(() => [...invoices.map(item => ({ type: 'Invoices', item })), ...contracts.map(item => ({ type: 'Contracts', item }))], [invoices, contracts])
  const selectedDocument = documentRef && allDocuments.find(entry => entry.type === documentRef.type && String(entry.item.id) === String(documentRef.id))?.item
  const requestedGallery = galleryRef || galleries.find(item => String(item.id) === String(draft?.galleryId || source?.galleryId))
  const initialProject = draft?.projectId || source?.projectId || selectedDocument?.projectId || requestedGallery?.projectId || (scope !== 'global' && scope !== 'unassigned' ? scope : 'global')
  const [projectId, setProjectId] = useState(String(initialProject))
  const initialProjectRecord = projects.find(project => String(project.id) === String(initialProject))
  const projectClient = clients.find(client => client.name === initialProjectRecord?.client)
  const [recipient, setRecipient] = useState(draft?.recipient || source?.recipient || selectedDocument?.email || requestedGallery?.email || initialProjectRecord?.clientEmail || projectClient?.email || '')
  const [subject, setSubject] = useState(draft?.subject || source?.subject || template?.subject || (selectedDocument ? `${selectedDocument.title} from ${studioName}` : requestedGallery ? `Your gallery: ${requestedGallery.title}` : ''))
  const initialBody = draft?.bodyDocument || source?.bodyDocument || template?.bodyDocument || textDocument(draft?.messageBody || draft?.body || source?.messageBody || source?.body || template?.body || (selectedDocument ? `Hi ${selectedDocument.client?.split(' ')[0] || ''},\n\nPlease find your ${documentRef.type === 'Invoices' ? 'invoice' : 'agreement'} attached. Let me know if you have any questions.\n\nBest,\n${displayName.split(' ')[0]}` : requestedGallery ? `Hi ${requestedGallery.client?.split(' ')[0] || ''},\n\nYour photos are ready to view and download. I hope you enjoy them!\n\nBest,\n${displayName.split(' ')[0]}` : ''))
  const [bodyDocument, setBodyDocument] = useState(initialBody)
  const [galleryId, setGalleryId] = useState(requestedGallery ? String(requestedGallery.id) : '')
  const [attachmentRefs, setAttachmentRefs] = useState((draft?.attachmentRefs || source?.attachmentRefs || (documentRef ? [documentRef] : [])).filter(ref => allDocuments.some(entry => entry.type === ref.type && String(entry.item.id) === String(ref.id) && String(entry.item.projectId) === String(initialProject))))
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState('compose')
  const selectedProject = projects.find(project => String(project.id) === projectId)
  const documents = allDocuments.filter(entry => String(entry.item.projectId) === projectId)
  const availableGalleries = galleries.filter(item => String(item.projectId) === projectId && item.count > 0)
  const selectedGallery = galleries.find(item => String(item.id) === galleryId && String(item.projectId) === projectId)
  const linkNotes = [
    attachmentRefs.some(ref => ref.type === 'Contracts') && 'Unsigned contracts get a private link to review and sign.',
    attachmentRefs.some(ref => ref.type === 'Invoices') && (status?.paymentsConfigured ? 'Invoices with a balance get a secure payment link.' : 'Turn on online payments in Settings to add a payment link.'),
  ].filter(Boolean)
  useEffect(() => { fetch('/api/email/status').then(response => response.json()).then(setStatus).catch(() => setStatus({ configured: false })) }, [])
  const chooseProject = value => {
    setProjectId(value); setAttachmentRefs([]); setGalleryId('')
    const project = projects.find(row => String(row.id) === value)
    setRecipient(project?.clientEmail || clients.find(client => client.name === project?.client)?.email || '')
  }
  const toggle = (type, item) => {
    const exists = attachmentRefs.some(ref => ref.type === type && String(ref.id) === String(item.id))
    setAttachmentRefs(exists ? attachmentRefs.filter(ref => !(ref.type === type && String(ref.id) === String(item.id))) : [...attachmentRefs, { type, id: item.id }])
    if (!exists && !recipient) setRecipient(item.email || '')
    if (!exists && !subject) setSubject(`${item.title} from ${studioName}`)
  }
  const values = { galleryId: selectedGallery?.id, projectId: projectId === 'global' ? undefined : selectedProject?.id, scope: projectId === 'global' ? 'global' : 'project', recipient: recipient.trim(), subject: subject.trim(), bodyDocument, body: plainText(bodyDocument), attachmentRefs }
  const validate = () => {
    if (!values.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.recipient) || !values.subject || !values.body) return 'Add a valid recipient, subject, and message.'
    if (projectId !== 'global' && !selectedProject) return 'Choose a project.'
    if (attachmentRefs.some(ref => documents.find(entry => entry.type === ref.type && String(entry.item.id) === String(ref.id))?.item.email?.toLowerCase() !== values.recipient.toLowerCase())) return 'The recipient must match the email on every attached document.'
    if (attachmentRefs.length > 3) return 'Choose no more than three PDFs.'
    if (galleryId && !selectedGallery) return 'Choose a gallery from this project.'
    if (selectedGallery) {
      const expected = selectedGallery.email || selectedProject?.clientEmail || clients.find(client => client.name === selectedGallery.client)?.email
      if (!expected) return 'Add a client email to the gallery before sharing.'
      if (expected.trim().toLowerCase() !== values.recipient.toLowerCase()) return 'The recipient must match the gallery client email.'
    }
    return ''
  }
  const act = async (action, requireComplete) => {
    setError('')
    const problem = requireComplete ? validate() : projectId !== 'global' && !selectedProject ? 'Choose a project.' : attachmentRefs.length > 3 ? 'Choose no more than three PDFs.' : ''
    if (problem) { setError(problem); return }
    setBusy(true)
    try { await action(values) }
    catch (cause) { setError(cause.message || 'Email could not be saved.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal email-workbench" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-head"><div><span>EMAIL · {projectId === 'global' ? 'GENERAL' : selectedProject?.name?.toUpperCase() || 'PROJECT'}</span><h2>{draft ? 'Edit draft' : source ? 'Reuse email' : 'New email'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <div className="email-tabs"><button className={view === 'compose' ? 'active' : ''} onClick={() => setView('compose')}>Compose</button><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Preview</button></div>
    {view === 'compose' ? <div className="email-workbench-body"><div className="email-workbench-main"><div className="composer-fields"><label>Project<select aria-label="Email project" value={projectId} onChange={event => chooseProject(event.target.value)}><option value="global">General · no project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label><label>To<input type="email" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="client@example.com"/></label><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Subject"/></label></div><label className="editor-label email-body-label">Message</label><RichTextEditor initial={initialBody} onChange={setBodyDocument} minHeight={230}/></div><aside className="email-workbench-aside"><h3>Attachments</h3><p>{projectId === 'global' ? 'General emails have no project documents.' : `Only PDFs from ${selectedProject?.name || 'this project'} appear here.`}</p><div className="attachment-list">{documents.length ? documents.map(({ type, item }) => <label key={`${type}-${item.id}`} className="attachment-option"><input type="checkbox" checked={attachmentRefs.some(ref => ref.type === type && String(ref.id) === String(item.id))} onChange={() => toggle(type, item)}/><FileText size={17}/><span><strong>{item.title}</strong><small>{item.client} · {item.email || 'No email'} · {type === 'Invoices' ? 'Invoice' : 'Contract'}</small></span></label>) : projectId !== 'global' && <div className="empty-list">No documents in this project yet.</div>}</div><div className="gallery-link-picker"><h3>Client gallery</h3><p>Add a private seven-day link when this email is sent.</p><select aria-label="Gallery to share" value={galleryId} onChange={event => setGalleryId(event.target.value)}><option value="">No gallery link</option>{availableGalleries.map(item => <option key={item.id} value={String(item.id)}>{item.title} · {item.count} photos</option>)}</select></div><div className="email-send-summary"><strong>Before you send</strong><span>{attachmentRefs.length} PDF{attachmentRefs.length === 1 ? '' : 's'} selected</span><span>Recipient: {recipient || 'Not set'}</span>{linkNotes.map(note => <span key={note}>{note}</span>)}</div></aside></div> : <div className="email-preview"><div className="email-preview-header"><span>From</span><strong>{studioName}</strong><span>To</span><strong>{recipient || 'Not set'}</strong><span>Subject</span><strong>{subject || 'No subject'}</strong><span>Project</span><strong>{selectedProject?.name || 'General'}</strong></div><ContractDocument content={bodyDocument} legacyTerms="" emptyText="No message yet."/>{selectedGallery && <div className="email-preview-gallery"><strong>Private gallery link: {selectedGallery.title}</strong><span>A seven-day link will be added when you send.</span></div>}{linkNotes.map(note => <div className="email-preview-gallery" key={note}><span>{note}</span></div>)}<div className="email-preview-attachments">{attachmentRefs.length ? `${attachmentRefs.length} project PDF${attachmentRefs.length === 1 ? '' : 's'} attached` : 'No attachments'}</div></div>}
    {status && !status.configured && <p className="delivery-note">Set up SMTP in Studio Settings to send. Drafts can still be saved.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="secondary" onClick={() => act(onSave, false)} disabled={busy}>Save draft</button><button className="primary" onClick={() => act(onSend, true)} disabled={busy || !status?.configured}>{busy ? 'Working...' : 'Send email'} <ArrowRight size={16}/></button></div>
  </div></div>
}
