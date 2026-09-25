import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Download, ImagePlus, Mail, Trash2, X } from 'lucide-react'

const imageUrl = (galleryId, photoId) => `/api/galleries/${encodeURIComponent(galleryId)}/photos/${encodeURIComponent(photoId)}`
const sizeLabel = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function GalleryDetail({ gallery, project, projects, clients, canEdit, csrfToken, apiRequest, onBack, onUpdate, onAssign, onShare, notify }) {
  const [photos, setPhotos] = useState([])
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [assignProject, setAssignProject] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const fileInput = useRef(null)
  const clientEmail = gallery.email || project?.clientEmail || clients.find(client => client.name === gallery.client)?.email || ''
  const load = async () => {
    const [photoRows, shareRows] = await Promise.all([apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/photos`), apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/shares`)])
    setPhotos(photoRows); setShares(shareRows)
  }
  useEffect(() => { let active = true; Promise.all([apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/photos`), apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/shares`)]).then(([photoRows, shareRows]) => { if (active) { setPhotos(photoRows); setShares(shareRows) } }).catch(cause => { if (active) setError(cause.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [gallery.id])
  const upload = async event => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    if (files.some(file => file.size > 20 * 1024 * 1024)) { setError('Each photo must be 20 MB or smaller.'); return }
    if (photos.length + files.length > 150) { setError('A gallery can hold up to 150 photos.'); return }
    setBusy(true); setError('')
    let uploaded = 0
    try {
      for (const file of files) {
        const response = await fetch(`/api/galleries/${encodeURIComponent(gallery.id)}/photos`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-CSRF-Token': csrfToken }, body: file })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Photo could not be uploaded.')
        onUpdate(result.gallery)
        uploaded += 1
      }
      await load()
      notify(`${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded`)
    } catch (cause) { setError(`${cause.message}${uploaded ? ` ${uploaded} photo${uploaded === 1 ? ' was' : 's were'} uploaded first.` : ''}`); await load().catch(() => {}) }
    finally { setBusy(false) }
  }
  const remove = async photo => {
    if (!window.confirm(`Remove ${photo.filename} from this gallery?`)) return
    setBusy(true); setError('')
    try { const result = await apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' }); onUpdate(result.gallery); setLightbox(null); await load(); notify('Photo removed') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const saveDetails = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try { const updated = await apiRequest('/api/records/Galleries', { method: 'PUT', body: { ...gallery, title: values.title.trim(), client: values.client.trim(), email: values.email.trim().toLowerCase() } }); onUpdate(updated); setEditing(false); notify('Gallery details saved') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!window.confirm('Disable all existing client links for this gallery?')) return
    setBusy(true); setError('')
    try { const result = await apiRequest(`/api/galleries/${encodeURIComponent(gallery.id)}/shares/revoke`, { method: 'POST' }); await load(); notify(`${result.revoked} link${result.revoked === 1 ? '' : 's'} disabled`) }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const activeLinks = shares.filter(share => share.active)
  const photoIndex = photos.findIndex(photo => photo.id === lightbox?.id)
  return <section className="gallery-detail"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back to galleries</button><header className="gallery-head"><div><span className="detail-kicker">{project?.name?.toUpperCase() || 'NEEDS SORTING'} · GALLERY</span><h2>{gallery.title}</h2><p>{gallery.client || project?.client || 'No client'} · {photos.length} photo{photos.length === 1 ? '' : 's'} · {gallery.status || 'In progress'}</p></div><div className="gallery-head-actions">{canEdit && <><button className="secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Cancel edit' : 'Edit details'}</button><button className="secondary" disabled={busy || !gallery.projectId} onClick={() => fileInput.current?.click()}><ImagePlus size={17}/> Upload photos</button><button className="primary" disabled={busy || !photos.length || !clientEmail || !gallery.projectId} onClick={() => onShare(gallery)}><Mail size={17}/> Share via email</button></>}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload}/></div></header>
    {canEdit && !gallery.projectId && <div className="assign-project"><strong>Place this gallery in a project before uploading or sharing</strong><select aria-label="Choose project for gallery" value={assignProject} onChange={event => setAssignProject(event.target.value)}><option value="">Choose a project</option>{projects.map(row => <option key={row.id} value={String(row.id)}>{row.name}</option>)}</select><button className="secondary" disabled={!assignProject} onClick={() => onAssign(assignProject)}>Move to project</button></div>}
    {!clientEmail && canEdit && <p className="gallery-notice">Add the client email in Edit details before sharing this gallery.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {editing && <form className="gallery-edit-form" onSubmit={saveDetails}><label>Gallery name<input name="title" defaultValue={gallery.title} required/></label><label>Client<input name="client" defaultValue={gallery.client || ''} required/></label><label>Client email<input name="email" type="email" defaultValue={clientEmail} required/></label><button className="primary" disabled={busy}>Save details</button></form>}
    <div className="gallery-section-head"><div><h3>Photos</h3><p>JPEG, PNG, or WebP · up to 20 MB each</p></div>{busy && <span>Working…</span>}</div>
    {loading ? <div className="gallery-empty">Loading photos…</div> : photos.length ? <div className="gallery-photo-grid">{photos.map(photo => <div className="gallery-photo" key={photo.id}><button className="gallery-photo-open" onClick={() => setLightbox(photo)} aria-label={`View ${photo.filename}`}><img src={imageUrl(gallery.id, photo.id)} alt={photo.filename} loading="lazy"/></button><div className="gallery-photo-info"><span title={photo.filename}>{photo.filename}<small>{sizeLabel(photo.size)}</small></span>{canEdit && <button title={`Remove ${photo.filename}`} aria-label={`Remove ${photo.filename}`} disabled={busy} onClick={() => remove(photo)}><Trash2 size={16}/></button>}</div></div>)}</div> : <div className="gallery-empty"><ImagePlus size={30}/><h3>Start with your photographs.</h3><p>Upload photos to build this project’s client gallery.</p>{canEdit && <button className="secondary" onClick={() => fileInput.current?.click()}>Choose photos <ArrowRight size={16}/></button>}</div>}
    <section className="gallery-share-panel"><div><h3>Client access</h3><p>A private link is created when you send this gallery by email. Each link lasts seven days and can be disabled here.</p></div>{activeLinks.length ? <><div className="gallery-share-list">{activeLinks.map((share, index) => <div key={`${share.createdAt}-${index}`}><strong>{share.recipient}</strong><span>Expires {new Date(share.expiresAt).toLocaleDateString()}</span></div>)}</div>{canEdit && <button className="secondary" disabled={busy} onClick={revoke}>Disable all links</button>}</> : <span className="gallery-no-shares">No active client links</span>}</section>
    {lightbox && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Photo: ${lightbox.filename}`}><div className="gallery-lightbox-bar"><strong>{lightbox.filename}</strong><div><a href={`${imageUrl(gallery.id, lightbox.id)}?download=1`}><Download size={17}/> Download</a><button onClick={() => setLightbox(null)} aria-label="Close photo"><X size={22}/></button></div></div><img src={imageUrl(gallery.id, lightbox.id)} alt={lightbox.filename}/><div className="gallery-lightbox-nav"><button disabled={photoIndex <= 0} onClick={() => setLightbox(photos[photoIndex - 1])}>Previous</button><span>{photoIndex + 1} of {photos.length}</span><button disabled={photoIndex >= photos.length - 1} onClick={() => setLightbox(photos[photoIndex + 1])}>Next</button></div></div>}
  </section>
}
