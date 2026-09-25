import React, { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function AuthScreen({ onSubmit, hasBrowserData, inviteToken }) {
  const [mode, setMode] = useState('register')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState(hasBrowserData ? 'browser' : 'sample')
  const [invitation, setInvitation] = useState(null)
  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/invitations/${inviteToken}`).then(response => response.json()).then(result => { if (result.studioName) { setInvitation(result); setMode(result.existingAccount ? 'login' : 'register') } else setError(result.error || 'Invitation not found.') }).catch(() => setError('Invitation could not be loaded.'))
  }, [inviteToken])

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await onSubmit(mode, { ...Object.fromEntries(new FormData(event.currentTarget)), ...(inviteToken ? { inviteToken } : {}) }, setup) }
    catch (cause) { setError(cause.message || 'Something went wrong. Please try again.') }
    finally { setBusy(false) }
  }

  return <div className="auth-shell">
    <section className="auth-art" aria-label="Darkroom studio workspace">
      <img src="/images/emma-daniel.png" alt="Couple photographed outdoors"/>
      <div className="auth-art-copy"><span>darkroom</span><p>A quieter place for the work behind your photographs.</p></div>
    </section>
    <main className="auth-panel">
      <div className="auth-brand">darkroom</div>
      <div className="auth-content">
        <h1>{invitation ? `Join ${invitation.studioName}.` : mode === 'register' ? 'Make room for the work you love.' : 'Welcome back.'}</h1>
        <p>{invitation ? `You were invited as ${invitation.role}. Use ${invitation.email} to join.` : mode === 'register' ? 'Create your studio workspace to keep clients, projects, and documents together.' : 'Sign in to pick up where you left off.'}</p>
        <div className="auth-switch" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Create account</button><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Sign in</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && <><label>Your name<input name="displayName" autoComplete="name" placeholder="Alex Rivera" required maxLength="80"/></label>{!invitation && <label>Studio name<input name="studioName" autoComplete="organization" placeholder="Rivera Studio" required maxLength="80"/></label>}</>}
          <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@studio.com" defaultValue={invitation?.email || ''} key={invitation?.email || 'new'} required/></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'} required minLength={mode === 'register' ? 12 : undefined}/></label>
          {mode === 'register' && !invitation && <fieldset className="auth-setup"><legend>Start with</legend>{hasBrowserData && <label><input type="radio" name="setup" checked={setup === 'browser'} onChange={() => setSetup('browser')}/> My existing browser workspace</label>}<label><input type="radio" name="setup" checked={setup === 'sample'} onChange={() => setSetup('sample')}/> Sample projects to explore</label><label><input type="radio" name="setup" checked={setup === 'empty'} onChange={() => setSetup('empty')}/> An empty studio</label></fieldset>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={busy} type="submit">{busy ? 'Please wait...' : mode === 'register' ? 'Create studio' : 'Sign in'} <ArrowRight size={17}/></button>
        </form>
      </div>
      <small className="auth-foot">Your work stays in your studio workspace.</small>
    </main>
  </div>
}
