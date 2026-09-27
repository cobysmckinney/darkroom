import React, { useState } from 'react'
import { X } from 'lucide-react'
import { dateInput } from './format.js'
import { projectStatuses, statusProgress } from './schedule.js'

const projectTypes = ['Wedding', 'Engagement', 'Portrait', 'Family', 'Event', 'Commercial', 'Other']

export default function ProjectEditor({ project, onSave, onClose }) {
  const [values, setValues] = useState({
    name: project?.name || '',
    client: project?.client || '',
    clientEmail: project?.clientEmail || '',
    type: project?.type || 'Wedding',
    date: dateInput(project?.date),
    location: project?.location === 'Location to be confirmed' ? '' : project?.location || '',
    status: project?.status || 'Planning',
    progress: project?.progress ?? statusProgress.Planning,
    description: project?.description === 'New project created.' ? '' : project?.description || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = key => event => setValues(previous => ({ ...previous, [key]: event.target.value }))
  // Picking a status moves progress to that stage; it can still be fine-tuned afterwards.
  const chooseStatus = event => setValues(previous => ({ ...previous, status: event.target.value, progress: statusProgress[event.target.value] ?? previous.progress }))
  const statuses = projectStatuses.includes(values.status) ? projectStatuses : [values.status, ...projectStatuses]

  const submit = async event => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await onSave({ ...project, id: project?.id ?? Date.now(), name: values.name.trim(), client: values.client.trim(), clientEmail: values.clientEmail.trim(), type: values.type, date: values.date || 'To be scheduled', location: values.location.trim() || 'Location to be confirmed', status: values.status, progress: Math.min(100, Math.max(0, Number(values.progress) || 0)), description: values.description.trim() })
    } catch (cause) { setError(cause.message); setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-head"><div><span>{project ? 'PROJECT' : 'ADD TO YOUR STUDIO'}</span><h2>{project ? 'Edit project' : 'New project'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit}>
      <label>Project name<input value={values.name} onChange={update('name')} required maxLength={120} placeholder="e.g. Jamie & Robin"/></label>
      <div className="form-pair">
        <label>Client name<input value={values.client} onChange={update('client')} required maxLength={120} placeholder="e.g. Jamie Lee"/></label>
        <label>Client email<input type="email" value={values.clientEmail} onChange={update('clientEmail')} placeholder="jamie@example.com"/></label>
      </div>
      <div className="form-pair">
        <label>Project type<select value={values.type} onChange={update('type')}>{(projectTypes.includes(values.type) ? projectTypes : [values.type, ...projectTypes]).map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Shoot date<input type="date" value={values.date} onChange={update('date')}/></label>
      </div>
      <label>Location<input value={values.location} onChange={update('location')} maxLength={200} placeholder="e.g. San Francisco, CA"/></label>
      {project && <div className="form-pair">
        <label>Status<select value={values.status} onChange={chooseStatus}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Progress · {values.progress}%<input type="range" min="0" max="100" step="1" value={values.progress} onChange={update('progress')}/></label>
      </div>}
      <label>Status note<textarea rows="2" value={values.description} onChange={update('description')} maxLength={500} placeholder="e.g. Final edits in progress. Gallery delivery scheduled for Oct 28."/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving...' : project ? 'Save project' : 'Create project'}</button></div>
    </form>
  </div></div>
}
