import React, { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Copy, Download, Plus, Trash2 } from 'lucide-react'

const emptySettings = { name: '', businessEmail: '', businessAddress: '', phone: '', website: '', taxId: '', currency: 'USD', paymentTerms: '', invoiceNotes: '', smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpFrom: '' }
export default function SettingsPage({ auth, apiRequest, onSession, onSettings, onExport, notify }) {
  const [studios, setStudios] = useState([])
  const [settings, setSettings] = useState(emptySettings)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [newStudio, setNewStudio] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [feed, setFeed] = useState({ active: false })
  const [feedUrl, setFeedUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canManage = ['owner', 'admin'].includes(auth.role)
  const load = async () => {
    const [studioRows, studioSettings, people, calendarFeed] = await Promise.all([apiRequest('/api/studios'), apiRequest('/api/studios/current/settings'), apiRequest('/api/studios/current/members'), apiRequest('/api/calendar-feed')])
    setFeed(calendarFeed)
    setStudios(studioRows); setSettings({ ...emptySettings, ...studioSettings }); setMembers(people.members); setInvites(people.invites)
    onSettings(studioSettings)
  }
  useEffect(() => { load().then(() => { if (window.location.hash === '#calendar-feed') { document.getElementById('calendar-feed')?.scrollIntoView(); window.history.replaceState({}, '', window.location.pathname) } }).catch(cause => setError(cause.message)) }, [auth.studioId])
  const createFeed = async () => {
    if (feed.active && !window.confirm('Create a new calendar link? The current link will stop working, so update any calendar subscribed to it.')) return
    setBusy(true); setError('')
    try { const result = await apiRequest('/api/calendar-feed', { method: 'POST' }); setFeed(result); setFeedUrl(result.url); notify('Calendar link created') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const removeFeed = async () => {
    if (!window.confirm('Turn off your calendar link? Subscribed calendars will stop updating.')) return
    try { setFeed(await apiRequest('/api/calendar-feed', { method: 'DELETE' })); setFeedUrl(''); notify('Calendar link turned off') }
    catch (cause) { setError(cause.message) }
  }
  const update = (key, value) => setSettings(previous => ({ ...previous, [key]: value }))
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { const saved = await apiRequest('/api/studios/current/settings', { method: 'PUT', body: settings }); setSettings({ ...emptySettings, ...saved }); onSettings(saved); onSession({ ...auth, studioName: saved.name }); notify('Studio settings saved'); await load() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const disconnectStripe = async () => {
    if (!window.confirm('Remove the Stripe keys? Clients will no longer be able to pay online.')) return
    setBusy(true); setError('')
    try { const saved = await apiRequest('/api/studios/current/settings', { method: 'PUT', body: { ...settings, stripeSecretKey: '', stripeWebhookSecret: '', clearStripe: true } }); setSettings({ ...emptySettings, ...saved }); onSettings(saved); notify('Online payments turned off') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const webhookUrl = `${window.location.origin}/api/stripe/webhook/${auth.studioId}`
  const createStudio = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { const session = await apiRequest('/api/studios', { method: 'POST', body: { name: newStudio } }); onSession(session.user, session.csrfToken); setNewStudio(''); notify('Studio created') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const switchStudio = async id => {
    setBusy(true); setError('')
    try { const session = await apiRequest(`/api/studios/${id}/switch`, { method: 'POST' }); onSession(session.user, session.csrfToken); notify(`Switched to ${session.user.studioName}`) }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const invite = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await apiRequest('/api/studios/current/invites', { method: 'POST', body: { email: inviteEmail, role: inviteRole } }); setInviteUrl(result.inviteUrl); setInviteEmail(''); await load(); notify('Invitation link created') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const changeRole = async (id, role) => {
    try { await apiRequest(`/api/studios/current/members/${id}`, { method: 'PATCH', body: { role } }); await load(); notify('Role updated') }
    catch (cause) { setError(cause.message) }
  }
  const remove = async id => {
    if (!window.confirm('Remove this person from the studio?')) return
    try { await apiRequest(`/api/studios/current/members/${id}`, { method: 'DELETE' }); await load(); notify('Member removed') }
    catch (cause) { setError(cause.message) }
  }
  const revoke = async email => {
    try { await apiRequest(`/api/studios/current/invites/${encodeURIComponent(email)}`, { method: 'DELETE' }); await load(); notify('Invitation revoked') }
    catch (cause) { setError(cause.message) }
  }
  return <div className="settings-page"><header className="page-head inner-head"><div><h1>Settings</h1><p>Manage your studio, documents, and team.</p></div></header>{error && <p className="form-error" role="alert">{error}</p>}
    <section className="settings-card"><div className="settings-card-head"><div><h2>Your studios</h2><p>Each studio has its own records, documents, and email settings.</p></div></div><div className="studio-switch-list">{studios.map(studio => <div key={studio.id} className="studio-switch-row"><div><strong>{studio.name}</strong><small>{studio.role}</small></div>{studio.id === auth.studioId ? <span className="current-badge">Current</span> : <button className="secondary" disabled={busy} onClick={() => switchStudio(studio.id)}>Switch <ArrowRight size={15}/></button>}</div>)}</div><form className="settings-inline" onSubmit={createStudio}><label>New studio name<input value={newStudio} onChange={event => setNewStudio(event.target.value)} required placeholder="Another studio"/></label><button className="secondary" disabled={busy}><Plus size={16}/> Create studio</button></form></section>
    <form onSubmit={save}><section className="settings-card"><div className="settings-card-head"><div><h2>Studio profile</h2><p>These details appear on invoices and emails.</p></div></div><div className="settings-grid">{[['name','Studio name'],['businessEmail','Business email'],['phone','Phone'],['website','Website'],['taxId','Tax ID']].map(([key,label]) => <label key={key}>{label}<input value={settings[key] || ''} onChange={event => update(key,event.target.value)} disabled={!canManage} required={key === 'name'}/></label>)}<label>Currency<select value={settings.currency || 'USD'} onChange={event => update('currency',event.target.value)} disabled={!canManage}>{['USD','EUR','GBP','CAD','AUD'].map(currency => <option key={currency}>{currency}</option>)}</select></label><label className="wide">Business address<textarea rows="2" value={settings.businessAddress || ''} onChange={event => update('businessAddress',event.target.value)} disabled={!canManage}/></label></div></section>
    <section className="settings-card"><div className="settings-card-head"><div><h2>Invoice defaults</h2><p>New invoices start with these notes and payment terms.</p></div></div><div className="settings-grid"><label className="wide">Payment terms<textarea rows="2" value={settings.paymentTerms || ''} onChange={event => update('paymentTerms',event.target.value)} disabled={!canManage}/></label><label className="wide">Invoice note<textarea rows="2" value={settings.invoiceNotes || ''} onChange={event => update('invoiceNotes',event.target.value)} disabled={!canManage}/></label></div></section>
    {canManage && <section className="settings-card"><div className="settings-card-head"><div><h2>Email delivery</h2><p>SMTP credentials are stored on this server and used only for this studio.</p></div></div><div className="settings-grid"><label>SMTP host<input value={settings.smtpHost || ''} onChange={event => update('smtpHost',event.target.value)} placeholder="smtp.example.com"/></label><label>Port<input type="number" min="1" max="65535" value={settings.smtpPort || 587} onChange={event => update('smtpPort',event.target.value)}/></label><label>Username<input value={settings.smtpUser || ''} onChange={event => update('smtpUser',event.target.value)}/></label><label>Password<input type="password" value={settings.smtpPassword || ''} onChange={event => update('smtpPassword',event.target.value)} placeholder={settings.smtpPasswordSet ? 'Saved — leave blank to keep' : 'SMTP password'} autoComplete="new-password"/></label><label className="wide">From address<input value={settings.smtpFrom || ''} onChange={event => update('smtpFrom',event.target.value)} placeholder={`${settings.name || 'Studio'} <hello@example.com>`}/></label><label className="check-label"><input type="checkbox" checked={Boolean(settings.smtpSecure)} onChange={event => update('smtpSecure',event.target.checked)}/> Use implicit TLS (usually port 465)</label></div></section>}
    {canManage && <section className="settings-card"><div className="settings-card-head"><div><h2>Online payments</h2><p>Add your Stripe keys so invoice emails include a secure payment link. Payments go directly to your Stripe account.</p></div>{settings.stripeKeySet && <button type="button" className="secondary" onClick={disconnectStripe} disabled={busy}>Turn off</button>}</div><div className="settings-grid"><label>Stripe secret key<input type="password" value={settings.stripeSecretKey || ''} onChange={event => update('stripeSecretKey', event.target.value)} placeholder={settings.stripeKeySet ? 'Saved — leave blank to keep' : 'sk_live_… or a restricted rk_ key'} autoComplete="off"/></label><label>Webhook signing secret<input type="password" value={settings.stripeWebhookSecret || ''} onChange={event => update('stripeWebhookSecret', event.target.value)} placeholder={settings.stripeWebhookSecretSet ? 'Saved — leave blank to keep' : 'whsec_… (recommended)'} autoComplete="off"/></label><div className="wide"><p className="settings-hint">In Stripe, add a webhook endpoint for <strong>checkout.session.completed</strong> and <strong>checkout.session.async_payment_succeeded</strong> at this URL. It must be your public HTTPS address.</p><div className="invite-link"><input readOnly value={webhookUrl} aria-label="Stripe webhook URL"/><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(webhookUrl).then(() => notify('Webhook URL copied'))}><Copy size={15}/> Copy</button></div></div></div></section>}
    {canManage && <div className="settings-save"><button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button></div>}</form>
    <section className="settings-card"><div className="settings-card-head"><div><h2>People & permissions</h2><p>Owners and admins manage settings. Editors change records and send email. Viewers can read.</p></div></div><div className="member-list">{members.map(member => <div className="member-row" key={member.id}><div><strong>{member.displayName}</strong><small>{member.email}</small></div>{canManage && member.role !== 'owner' ? <><select aria-label={`Role for ${member.displayName}`} value={member.role} onChange={event => changeRole(member.id,event.target.value)}>{['admin','editor','viewer'].map(role => <option key={role}>{role}</option>)}</select><button type="button" aria-label={`Remove ${member.displayName}`} onClick={() => remove(member.id)}><Trash2 size={16}/></button></> : <span className="current-badge">{member.role}</span>}</div>)}</div>{canManage && <><form className="settings-inline" onSubmit={invite}><label>Invite by email<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="teammate@example.com"/></label><label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{['admin','editor','viewer'].map(role => <option key={role}>{role}</option>)}</select></label><button className="secondary" disabled={busy}>Create invite link</button></form>{inviteUrl && <div className="invite-link"><input readOnly value={inviteUrl} aria-label="Invitation link"/><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => notify('Link copied'))}><Copy size={15}/> Copy</button></div>}{invites.length > 0 && <div className="pending-invites"><p className="settings-hint">Pending invitations · links expire after 7 days</p>{invites.map(invite => <div className="member-row" key={invite.email}><div><strong>{invite.email}</strong><small>{invite.role}</small></div><button type="button" onClick={() => revoke(invite.email)}>Revoke</button></div>)}</div>}</>}</section>
    <section className="settings-card" id="calendar-feed"><div className="settings-card-head"><div><h2>Calendar feed</h2><p>Subscribe from Google, Apple, or Outlook Calendar to see this studio’s sessions, shoot dates, and payment due dates. The link is private to you; anyone who has it can read your schedule.</p></div><div className="settings-card-actions">{feed.active && <button type="button" className="secondary" onClick={removeFeed}>Turn off</button>}<button type="button" className="secondary" onClick={createFeed} disabled={busy}><CalendarDays size={16}/> {feed.active ? 'Create new link' : 'Create calendar link'}</button></div></div>{feedUrl ? <><div className="invite-link"><input readOnly value={feedUrl} aria-label="Calendar feed link"/><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(feedUrl).then(() => notify('Link copied'))}><Copy size={15}/> Copy</button><a className="secondary" href={feedUrl.replace(/^https?:/, 'webcal:')}>Subscribe</a></div><p className="settings-hint">Copy this link now: it is only shown once. Calendar apps refresh it every few hours.</p></> : feed.active && <p className="settings-hint">Your calendar link has been active since {new Date(feed.createdAt).toLocaleDateString()}. Create a new link if you need to see it again.</p>}</section>
    <section className="settings-card"><div className="settings-card-head"><div><h2>Your data</h2><p>Download the records from the current studio.</p></div><button className="secondary" onClick={onExport}><Download size={16}/> Export studio data</button></div></section>
  </div>
}
