import { useEffect, useState } from 'react'

// Loads a client-facing link (/sign/:token or /pay/:token) without a studio session.
export function usePublicLink(kind, prepare) {
  const token = window.location.pathname.split('/')[2] || ''
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const request = async (path, body) => {
    const response = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.')
    return result
  }
  const load = () => request(`/api/${kind}/${encodeURIComponent(token)}`).then(setData)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta)
    let active = true
    Promise.resolve(prepare?.(request, token)).then(() => request(`/api/${kind}/${encodeURIComponent(token)}`)).then(result => { if (active) setData(result) }).catch(cause => { if (active) setError(cause.message) })
    return () => { active = false; meta.remove() }
  }, [token])
  return { token, data, setData, error, request, load }
}
