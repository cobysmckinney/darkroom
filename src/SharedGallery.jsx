import React, { useEffect, useState } from 'react'
import { ArrowLeft, Download, X } from 'lucide-react'

export default function SharedGallery() {
  const token = window.location.pathname.split('/')[2] || ''
  const [gallery, setGallery] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta)
    let active = true
    fetch(`/api/share/${encodeURIComponent(token)}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Gallery unavailable.'); return result }).then(result => { if (active) { setGallery(result); document.title = `${result.title} — ${result.studioName}` } }).catch(cause => { if (active) setError(cause.message) })
    return () => { active = false; meta.remove() }
  }, [token])
  const photoUrl = photo => `/api/share/${encodeURIComponent(token)}/photos/${encodeURIComponent(photo.id)}`
  const index = gallery?.photos.findIndex(photo => photo.id === selected?.id) ?? -1
  return <div className="shared-gallery"><header className="shared-gallery-top"><span>darkroom</span><small>PRIVATE CLIENT GALLERY</small></header>{error ? <main className="shared-gallery-error"><h1>Gallery unavailable</h1><p>{error}</p><p>Ask your photographer for a new link.</p></main> : !gallery ? <main className="shared-gallery-error"><h1>Opening gallery…</h1></main> : <main className="shared-gallery-main"><div className="shared-gallery-heading"><div><p>Shared by {gallery.studioName}</p><h1>{gallery.title}</h1><span>{gallery.photos.length} photo{gallery.photos.length === 1 ? '' : 's'} · Link expires {new Date(gallery.expiresAt).toLocaleDateString()}</span></div></div>{gallery.photos.length ? <div className="shared-gallery-grid">{gallery.photos.map(photo => <button key={photo.id} onClick={() => setSelected(photo)} aria-label={`View ${photo.filename}`}><img src={photoUrl(photo)} alt={photo.filename} loading="lazy"/></button>)}</div> : <div className="gallery-empty">No photos are available in this gallery.</div>}</main>}{selected && <div className="gallery-lightbox shared-lightbox" role="dialog" aria-modal="true" aria-label={`Photo: ${selected.filename}`}><div className="gallery-lightbox-bar"><strong>{selected.filename}</strong><div><a href={`${photoUrl(selected)}?download=1`}><Download size={17}/> Download</a><button onClick={() => setSelected(null)} aria-label="Close photo"><X size={22}/></button></div></div><img src={photoUrl(selected)} alt={selected.filename}/><div className="gallery-lightbox-nav"><button disabled={index <= 0} onClick={() => setSelected(gallery.photos[index - 1])}><ArrowLeft size={16}/> Previous</button><span>{index + 1} of {gallery.photos.length}</span><button disabled={index >= gallery.photos.length - 1} onClick={() => setSelected(gallery.photos[index + 1])}>Next</button></div></div>}</div>
}
