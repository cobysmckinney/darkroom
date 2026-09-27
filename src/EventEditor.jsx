import React, { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { dayKey } from './format.js'
import { eventKinds } from './schedule.js'

export default function EventEditor({ event, projects, defaultProjectId, onSave, onDelete, onClose }) {
  const [values, setValues] = useState({
    title: event?.title || '',
    kind: event?.kind || 'Client call',
    date: event?.date || dayKey(new Date()),
    start: event?.start || '',
    end: event?.end || '',
    location: event?.location || '',
    notes: event?.notes || '',
    projectId: String(event?.projectId ?? (projects.some(project => String(project.id) === String(defaultProjectId)) ? defaultProjectId : '')),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = key => changeEvent => setValues(previous => ({ ...previous, [key]: changeEvent.target.value }))

  const submit = async submitEvent => {
    submitEvent.preventDefault()
    if (values.end && !values.start) { setError('Add a start time, or clear the end time for an all-day event.'); return }
    if (values.start && values.end && values.end <= values.start) { setError('The end time must be after the start time.'); return }
    const project = projects.find(row => String(row.id) === values.projectId)
    setBusy(true); setError('')
    try { await onSave({ ...event, id: event?.id || crypto.randomUUID(), ...values, title: values.title.trim(), location: values.location.trim(), notes: values.notes.trim(), projectId: project?.id, scope: project ? 'project' : 'global' }) }
    catch (cause) { setError(cause.message); setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm(`Delete “${event.title}”?`)) return
    setBusy(true)
    try { await onDelete(event) }
    catch (cause) { setError(cause.message); setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={stop => stop.stopPropagation()}>
    <div className="modal-head"><div><span>SCHEDULE</span><h2>{event ? 'Edit event' : 'Add event'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit}>
      <label>Title<input value={values.title} onChange={update('title')} required maxLength={200} placeholder="e.g. Engagement session"/></label>
      <div className="form-pair">
        <label>Kind<select value={values.kind} onChange={update('kind')}>{eventKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
        <label>Project<select value={values.projectId} onChange={update('projectId')}><option value="">General · no project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>
      </div>
      <div className="form-trio">
        <label>Date<input type="date" value={values.date} onChange={update('date')} required/></label>
        <label>Start<input type="time" value={values.start} onChange={update('start')}/></label>
        <label>End<input type="time" value={values.end} onChange={update('end')}/></label>
      </div>
      <p className="form-note">Leave the times empty for an all-day event.</p>
      <label>Location<input value={values.location} onChange={update('location')} maxLength={200} placeholder="e.g. Golden Gate Park or Zoom"/></label>
      <label>Notes<textarea rows="3" value={values.notes} onChange={update('notes')} maxLength={2000}/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions">{event && <button type="button" className="secondary event-delete" onClick={remove} disabled={busy}><Trash2 size={15}/> Delete</button>}<button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save event'}</button></div>
    </form>
  </div></div>
}
