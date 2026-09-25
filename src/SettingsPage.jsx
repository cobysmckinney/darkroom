import React, { useEffect, useState } from 'react'
import { ArrowRight, Copy, Download, Plus, Trash2 } from 'lucide-react'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canManage = ['owner', 'admin'].includes(auth.role)
  const load = async () => {
    const [studioRows, studioSettings, people] = await Promise.all([apiRequest('/api/studios'), apiRequest('/api/studios/current/settings'), apiRequest('/api/studios/current/members')])
    setStudios(studioRows); setSettings({ ...emptySettings, ...studioSettings }); setMembers(people.members); setInvites(people.invites)
    onSettings(studioSettings)
  }
  useEffect(() => { load().catch(cause => setError(cause.message)) }, [auth.studioId])
  const update = (key, value) => setSettings(previous => ({ ...previous, [key]: value }))
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { const saved = await apiRequest('/api/studios/current/settings', { method: 'PUT', body: settings }); setSettings({ ...saved, smtpPassword: '' }); onSettings(saved); onSession({ ...auth, studioName: saved.name }); notify('Studio settings saved'); await load() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
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
    {canManage && <div className="settings-save"><button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button></div>}</form>
    <section className="settings-card"><div className="settings-card-head"><div><h2>People & permissions</h2><p>Owners and admins manage settings. Editors change records and send email. Viewers can read.</p></div></div><div className="member-list">{members.map(member => <div className="member-row" key={member.id}><div><strong>{member.displayName}</strong><small>{member.email}</small></div>{canManage && member.role !== 'owner' ? <><select aria-label={`Role for ${member.displayName}`} value={member.role} onChange={event => changeRole(member.id,event.target.value)}>{['admin','editor','viewer'].map(role => <option key={role}>{role}</option>)}</select><button type="button" aria-label={`Remove ${member.displayName}`} onClick={() => remove(member.id)}><Trash2 size={16}/></button></> : <span className="current-badge">{member.role}</span>}</div>)}</div>{canManage && <><form className="settings-inline" onSubmit={invite}><label>Invite by email<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="teammate@example.com"/></label><label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{['admin','editor','viewer'].map(role => <option key={role}>{role}</option>)}</select></label><button className="secondary" disabled={busy}>Create invite link</button></form>{inviteUrl && <div className="invite-link"><input readOnly value={inviteUrl} aria-label="Invitation link"/><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => notify('Link copied'))}><Copy size={15}/> Copy</button></div>}{invites.length > 0 && <div className="pending-invites"><p className="settings-hint">Pending invitations · links expire after 7 days</p>{invites.map(invite => <div className="member-row" key={invite.email}><div><strong>{invite.email}</strong><small>{invite.role}</small></div><button type="button" onClick={() => revoke(invite.email)}>Revoke</button></div>)}</div>}</>}</section>
    <section className="settings-card"><div className="settings-card-head"><div><h2>Your data</h2><p>Download the records from the current studio.</p></div><button className="secondary" onClick={onExport}><Download size={16}/> Export studio data</button></div></section>
  </div>
}
