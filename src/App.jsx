import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Download, Mail, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { downloadDocument, pdfAttachment } from './pdf.js'
import AuthScreen from './AuthScreen.jsx'
import ContractDocument from './ContractDocument.jsx'
import InvoiceEditor from './InvoiceEditor.jsx'
import SettingsPage from './SettingsPage.jsx'
import EmailDetail from './EmailDetail.jsx'
import ProjectOverview from './ProjectOverview.jsx'
import TemplateDetail from './TemplateDetail.jsx'
import StudioOverview from './StudioOverview.jsx'
import GalleryDetail from './GalleryDetail.jsx'
import { House as HouseIcon } from '@phosphor-icons/react/dist/csr/House'
import { Folder as FolderIcon } from '@phosphor-icons/react/dist/csr/Folder'
import { Users as UsersIcon } from '@phosphor-icons/react/dist/csr/Users'
import { Image as ImageIcon } from '@phosphor-icons/react/dist/csr/Image'
import { FilePdf as FilePdfIcon } from '@phosphor-icons/react/dist/csr/FilePdf'
import { NotePencil as NotePencilIcon } from '@phosphor-icons/react/dist/csr/NotePencil'
import { Envelope as EnvelopeIcon } from '@phosphor-icons/react/dist/csr/Envelope'
import { SquaresFour as SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour'
import { GearSix as GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix'
import { Question as QuestionIcon } from '@phosphor-icons/react/dist/csr/Question'
import { SignOut as SignOutIcon } from '@phosphor-icons/react/dist/csr/SignOut'
import { List as ListIcon } from '@phosphor-icons/react/dist/csr/List'
const ContractEditor = React.lazy(() => import('./ContractEditor.jsx'))
const EmailComposer = React.lazy(() => import('./EmailComposer.jsx'))

function EditorLoading({ label }) {
  return <div className="modal-backdrop"><div className="modal editor-loading"><span>darkroom</span><p>Opening {label}…</p></div></div>
}

const initialProjects = [
  { id: 1, name: 'Emma & Daniel', client: 'Emma Carter', type: 'Wedding', date: 'Oct 14, 2026', location: 'Lake Como, Italy', status: 'Editing', progress: 78, description: 'Final edits in progress. Gallery delivery scheduled for October 28, 2026.' },
  { id: 2, name: 'Priya & James', client: 'Priya Desai', type: 'Engagement', date: 'Sep 30, 2026', location: 'Golden Gate Park', status: 'Photographed', progress: 46, description: 'Selects are ready for review.' },
  { id: 3, name: 'Morgan & Taylor', client: 'Morgan Lee', type: 'Wedding', date: 'Oct 12, 2026', location: 'San Francisco, CA', status: 'Planning', progress: 18, description: 'Planning call scheduled for next week.' },
  { id: 4, name: 'Chris & Pat', client: 'Chris Nguyen', type: 'Portrait', date: 'Nov 2, 2026', location: 'Studio', status: 'Contract sent', progress: 12, description: 'Awaiting the signed contract.' },
  { id: 5, name: 'Sophie & Ryan', client: 'Sophie Chen', type: 'Wedding', date: 'Jun 8, 2026', location: 'Napa Valley, CA', status: 'Delivered', progress: 100, description: 'Final gallery delivered.' },
]
const initialClients = [
  { id: 1, name: 'Emma Carter', email: 'emma.carter@example.com', phone: '(415) 555-0142', projects: 1 },
  { id: 2, name: 'Priya Desai', email: 'priya.desai@example.com', phone: '(415) 555-0184', projects: 1 },
  { id: 3, name: 'Morgan Lee', email: 'morgan.lee@example.com', phone: '(415) 555-0107', projects: 1 },
  { id: 4, name: 'Chris Nguyen', email: 'chris.nguyen@example.com', phone: '(415) 555-0128', projects: 1 },
  { id: 5, name: 'Sophie Chen', email: 'sophie.chen@example.com', phone: '(415) 555-0163', projects: 1 },
]
const initialInvoices = [
  { id: 1042, title: 'Invoice #1042', client: 'Taylor Kim', email: 'taylor.kim@example.com', service: 'Wedding photography package', amount: '$2,800.00', status: 'Overdue', due: 'Sep 21, 2026', issued: 'Aug 21, 2026' },
  { id: 1041, title: 'Invoice #1041', client: 'Emma Carter', email: 'emma.carter@example.com', service: 'Wedding photography package', amount: '$3,500.00', status: 'Paid', due: 'Sep 12, 2026', issued: 'Aug 12, 2026' },
  { id: 1040, title: 'Invoice #1040', client: 'Morgan Lee', email: 'morgan.lee@example.com', service: 'Wedding photography deposit', amount: '$1,200.00', status: 'Draft', due: 'Oct 10, 2026', issued: 'Sep 24, 2026' },
]
const initialContracts = [
  { id: 1, title: 'Wedding photography agreement', client: 'Morgan Lee', email: 'morgan.lee@example.com', service: 'Wedding coverage and edited digital gallery', eventDate: 'Oct 12, 2026', fee: '3200', terms: 'Photographer will provide coverage and an edited digital gallery. Both parties will confirm the final timeline and deliverables before the event.', status: 'Awaiting signature', sent: 'Sep 20, 2026' },
  { id: 2, title: 'Portrait session agreement', client: 'Chris Nguyen', email: 'chris.nguyen@example.com', service: 'Portrait photography session', eventDate: 'Nov 2, 2026', fee: '650', terms: 'Photographer will provide a portrait session and an edited selection of images. Session details and delivery timing will be confirmed before the shoot.', status: 'Draft', sent: 'Not sent' },
  { id: 3, title: 'Wedding photography agreement', client: 'Emma Carter', email: 'emma.carter@example.com', service: 'Wedding coverage and edited digital gallery', eventDate: 'Oct 14, 2026', fee: '3500', terms: 'Photographer will provide wedding coverage and an edited digital gallery as agreed with the client.', status: 'Signed', sent: 'Aug 18, 2026' },
]
const initialGalleries = [
  { id: 1, title: 'Priya & James', client: 'Priya Desai', count: 421, status: 'Ready to deliver', updated: 'Sep 22, 2026' },
  { id: 2, title: 'Sophie & Ryan', client: 'Sophie Chen', count: 638, status: 'Delivered', updated: 'Jul 12, 2026' },
  { id: 3, title: 'Emma & Daniel', client: 'Emma Carter', count: 784, status: 'In progress', updated: 'Sep 23, 2026' },
]
const initialEmails = [
  { id: 1, subject: 'Your invoice from Alex Rivera Studio', recipient: 'morgan.lee@example.com', status: 'Draft', date: 'Sep 23, 2026', body: 'Hi Morgan,\n\nPlease find your invoice attached.\n\nBest,\nAlex', attachmentRefs: [{ type: 'Invoices', id: 1040 }] },
  { id: 2, subject: 'Thank you for a wonderful day', recipient: 'sophie.chen@example.com', status: 'Sent', date: 'Jul 12, 2026', body: 'Hi Sophie,\n\nThank you for a wonderful day.\n\nBest,\nAlex', attachmentRefs: [] },
]
const nav = [
  ['Overview', HouseIcon], ['Projects', FolderIcon], ['Clients', UsersIcon], ['Galleries', ImageIcon], ['Invoices', FilePdfIcon], ['Contracts', NotePencilIcon], ['Email', EnvelopeIcon], ['Templates', SquaresFourIcon],
]
const sectionActions = { Projects: 'New project', Clients: 'New client', Galleries: 'New gallery', Invoices: 'New invoice', Contracts: 'New contract', Email: 'Compose email', Templates: 'New template' }
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'
const displayDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? formatDate(value) : value

const emptyWorkspace = () => ({ Projects: [], Clients: [], Galleries: [], Invoices: [], Contracts: [], Email: [], Templates: [] })
const sampleWorkspace = () => ({ Projects: initialProjects, Clients: initialClients, Galleries: initialGalleries, Invoices: initialInvoices, Contracts: initialContracts, Email: initialEmails, Templates: [] })
const browserWorkspace = () => Object.fromEntries(Object.keys(emptyWorkspace()).map(section => {
  try {
    const rows = JSON.parse(localStorage.getItem(`darkroom-${section.toLowerCase()}`))
    return [section, Array.isArray(rows) ? rows : []]
  } catch { return [section, []] }
}))
const hasBrowserWorkspace = () => {
  try { return Object.keys(emptyWorkspace()).some(section => localStorage.getItem(`darkroom-${section.toLowerCase()}`) !== null) }
  catch { return false }
}

function App() {
  const [auth, setAuth] = useState(undefined)
  const [csrfToken, setCsrfToken] = useState('')
  const [page, setPage] = useState('Overview')
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [contracts, setContracts] = useState([])
  const [galleries, setGalleries] = useState([])
  const [emails, setEmails] = useState([])
  const [templates, setTemplates] = useState([])
  const [scope, setScope] = useState('global')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [emailDocument, setEmailDocument] = useState(null)
  const [emailDraft, setEmailDraft] = useState(null)
  const [emailSource, setEmailSource] = useState(null)
  const [emailTemplate, setEmailTemplate] = useState(null)
  const [emailGallery, setEmailGallery] = useState(null)
  const [contractTemplate, setContractTemplate] = useState(null)
  const [studioSettings, setStudioSettings] = useState({})
  const [editingDocument, setEditingDocument] = useState(null)
  const inviteToken = new URLSearchParams(window.location.search).get('invite')
  useEffect(() => {
    if (!modal && !mobileNav) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [modal, mobileNav])

  const applyWorkspace = workspace => {
    setProjects(workspace.Projects || [])
    setClients(workspace.Clients || [])
    setGalleries(workspace.Galleries || [])
    setInvoices(workspace.Invoices || [])
    setContracts(workspace.Contracts || [])
    setEmails(workspace.Email || [])
    setTemplates(workspace.Templates || [])
  }
  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        const sessionResponse = await fetch('/api/auth/me')
        if (!sessionResponse.ok) { if (active) setAuth(false); return }
        const session = await sessionResponse.json()
        let currentSession = session
        if (inviteToken) {
          const accepted = await fetch(`/api/invitations/${inviteToken}/accept`, { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken } })
          if (accepted.ok) { currentSession = await accepted.json(); window.history.replaceState({}, '', window.location.pathname) }
          else { const result = await accepted.json().catch(() => ({})); if (active) notify(result.error || 'Invitation could not be accepted.') }
        }
        const [workspaceResponse, settingsResponse] = await Promise.all([fetch('/api/workspace'), fetch('/api/studios/current/settings')])
        if (!workspaceResponse.ok) throw new Error('Workspace could not be loaded.')
        const workspace = await workspaceResponse.json()
        if (active) { applyWorkspace(workspace); setStudioSettings(settingsResponse.ok ? await settingsResponse.json() : {}); setCsrfToken(currentSession.csrfToken); setAuth(currentSession.user) }
      } catch { if (active) setAuth(false) }
    }
    restore()
    return () => { active = false }
  }, [])

  const apiRequest = async (path, { method = 'GET', body, csrf = csrfToken, headers = {} } = {}) => {
    const response = await fetch(path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Request failed. Please try again.')
    return result
  }
  const authenticate = async (mode, values, setup) => {
    const session = await apiRequest(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: values, csrf: '' })
    let importError = null
    if (mode === 'login' && inviteToken) {
      const accepted = await apiRequest(`/api/invitations/${inviteToken}/accept`, { method: 'POST', csrf: session.csrfToken })
      session.user = accepted.user; session.csrfToken = accepted.csrfToken
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (mode === 'register' && !inviteToken && setup !== 'empty') {
      const workspace = setup === 'browser' ? browserWorkspace() : sampleWorkspace()
      try {
        await apiRequest('/api/workspace/import', { method: 'POST', body: workspace, csrf: session.csrfToken })
        if (setup === 'browser') Object.keys(emptyWorkspace()).forEach(section => localStorage.removeItem(`darkroom-${section.toLowerCase()}`))
      } catch (error) { importError = error }
    }
    const [workspace, settings] = await Promise.all([apiRequest('/api/workspace'), apiRequest('/api/studios/current/settings')])
    applyWorkspace(workspace)
    setStudioSettings(settings)
    setCsrfToken(session.csrfToken)
    setAuth(session.user)
    if (importError) notify(`Studio created, but records could not be imported: ${importError.message}`)
  }
  const signOut = async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }) }
    catch { notify('Could not sign out. Please try again.'); return }
    applyWorkspace(emptyWorkspace())
    setCsrfToken('')
    setAuth(false)
    setPage('Overview')
    setSelected(null)
    setScope('global')
  }

  const switchSession = async (user, token) => {
    const [workspace, settings] = await Promise.all([apiRequest('/api/workspace'), apiRequest('/api/studios/current/settings')])
    applyWorkspace(workspace); setStudioSettings(settings); setAuth(user); setCsrfToken(token); setPage('Overview'); setScope('global'); setSelected(null); setModal(null)
  }

  const collections = { Projects: projects, Clients: clients, Galleries: galleries, Invoices: invoices, Contracts: contracts, Email: emails, Templates: templates }
  const setters = { Projects: setProjects, Clients: setClients, Galleries: setGalleries, Invoices: setInvoices, Contracts: setContracts, Email: setEmails, Templates: setTemplates }
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3500) }
  const saveRecord = async (section, item) => {
    const saved = await apiRequest(`/api/records/${section}`, { method: 'PUT', body: item })
    setters[section](previous => [saved, ...previous.filter(row => String(row.id) !== String(saved.id))])
    return saved
  }
  const saveDocument = async (section, item) => {
    const saved = await saveRecord(section, item)
    if (selected?.id === saved.id) setSelected(saved)
    setModal(null); setEditingDocument(null); setContractTemplate(null); setScope(String(saved.projectId)); go(section); setSelected(saved); notify(`${section === 'Invoices' ? 'Invoice' : 'Contract'} saved`)
  }
  const go = (target) => { if (['Projects', 'Templates'].includes(target)) setScope('global'); setPage(target); setSelected(null); setQuery(''); setStatusFilter('All'); setMobileNav(false) }
  const selectScope = value => { setScope(value); setPage('Overview'); setSelected(null); setQuery(''); setStatusFilter('All'); setMobileNav(false) }
  const openProject = project => selectScope(String(project.id))
  const composeEmail = (document = null, draft = null, source = null, template = null, gallery = null) => {
    if (document) {
      const item = resolveDocument(document)
      if (!item?.projectId) { notify('Assign this document to a project before emailing it.'); return }
      setScope(String(item.projectId))
    }
    if (gallery) setScope(String(gallery.projectId))
    setEmailDocument(document); setEmailDraft(draft); setEmailSource(source); setEmailTemplate(template); setEmailGallery(gallery); setModal('Email')
  }
  const resolveDocument = (reference) => {
    const collection = reference.type === 'Invoices' ? invoices : contracts
    return collection.find(item => String(item.id) === String(reference.id))
  }
  const saveEmail = async values => {
    const item = { id: emailDraft?.id || crypto.randomUUID(), projectId: values.projectId, scope: values.scope, subject: values.subject, recipient: values.recipient, body: values.body, bodyDocument: values.bodyDocument, attachmentRefs: values.attachmentRefs, galleryId: values.galleryId, status: 'Draft', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    await saveRecord('Email', item)
    setModal(null)
    setEmailDocument(null); setEmailDraft(null); setEmailSource(null); setEmailTemplate(null); setEmailGallery(null)
    if (values.projectId) setScope(String(values.projectId)); else setScope('global')
    go('Email')
    notify('Email draft saved')
  }
  const sendEmail = async values => {
    const attachments = await Promise.all(values.attachmentRefs.map(async reference => {
      const document = resolveDocument(reference)
      if (!document) throw new Error('An attached document was removed. Please select it again.')
      return pdfAttachment(reference.type, document, auth.studioName, studioSettings)
    }))
    const result = await apiRequest('/api/email/send', { method: 'POST', body: { to: values.recipient, subject: values.subject, body: values.body, bodyDocument: values.bodyDocument, projectId: values.projectId, scope: values.scope, attachments, attachmentRefs: values.attachmentRefs, draftId: emailDraft?.id, galleryId: values.galleryId } })
    setEmails(previous => [result.email, ...previous.filter(row => String(row.id) !== String(result.email.id))])
    if (result.updatedGallery) setGalleries(previous => previous.map(row => String(row.id) === String(result.updatedGallery.id) ? result.updatedGallery : row))
    for (const update of result.updatedDocuments || []) {
      setters[update.type](previous => previous.map(row => String(row.id) === String(update.item.id) ? update.item : row))
      if (page === update.type && selected?.id === update.item.id) setSelected(update.item)
    }
    setModal(null)
    setEmailDocument(null); setEmailDraft(null); setEmailSource(null); setEmailTemplate(null); setEmailGallery(null)
    if (values.projectId) setScope(String(values.projectId)); else setScope('global')
    go('Email')
    notify('Email sent')
  }

  const resendEmail = async email => {
    const result = await apiRequest(`/api/email/${encodeURIComponent(email.id)}/resend`, { method: 'POST' })
    setEmails(previous => [result.email, ...previous])
    setSelected(result.email)
  }

  const saveTemplate = async (source, type) => {
    const title = window.prompt('Template name', type === 'Email' ? source.subject : source.title)
    if (!title?.trim()) return
    const template = { id: crypto.randomUUID(), type, title: title.trim(), subject: type === 'Email' ? source.subject : undefined, bodyDocument: type === 'Email' ? source.bodyDocument || null : undefined, body: type === 'Email' ? source.body : undefined, document: type === 'Contract' ? source.document : undefined, terms: type === 'Contract' ? source.terms : undefined, createdAt: new Date().toISOString() }
    await saveRecord('Templates', template)
    notify('Template saved to General')
  }

  const useTemplate = template => {
    if (template.type === 'Email') composeEmail(null, null, null, template)
    else { setContractTemplate(template); setEditingDocument(null); setModal('Contracts') }
  }

  const deleteTemplate = async template => {
    if (!window.confirm(`Delete “${template.title}”?`)) return
    await apiRequest(`/api/records/Templates/${encodeURIComponent(template.id)}`, { method: 'DELETE' })
    setTemplates(previous => previous.filter(row => row.id !== template.id)); setSelected(null); notify('Template deleted')
  }

  const assignRecord = async (section, item, projectId) => {
    const saved = await saveRecord(section, { ...item, projectId, scope: 'project' })
    setSelected(saved); setScope(String(projectId)); notify('Moved to project')
  }

  const filtered = useMemo(() => {
    let rows = collections[page] || []
    if (page === 'Clients' && scope !== 'global' && scope !== 'unassigned') rows = rows.filter(item => item.name === projects.find(project => String(project.id) === scope)?.client)
    if (['Galleries', 'Invoices', 'Contracts', 'Email'].includes(page)) rows = rows.filter(item => scope === 'global' ? item.scope === 'global' : scope === 'unassigned' ? item.scope === 'unassigned' || (!item.projectId && item.scope !== 'global') : String(item.projectId) === scope)
    return rows.filter(item => Object.values(item).join(' ').toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'All' || item.status === statusFilter))
  }, [page, projects, clients, galleries, invoices, contracts, emails, templates, scope, query, statusFilter])

  const submit = async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const id = Date.now()
    let item
    if (modal === 'Projects') item = { id, name: values.name, client: values.client, clientEmail: values.clientEmail?.trim() || '', type: values.type || 'Portrait', date: values.date || 'To be scheduled', location: values.location || 'Location to be confirmed', status: 'Planning', progress: 0, description: 'New project created.' }
    if (modal === 'Clients') item = { id, name: values.name, email: values.email, phone: values.phone || '—', projects: 0 }
    if (modal === 'Galleries') item = { id, projectId: values.projectId, scope: 'project', title: values.title, client: values.client, email: values.email?.trim().toLowerCase() || '', count: 0, status: 'In progress', updated: 'Just now' }
    try {
      await saveRecord(modal, item)
      setModal(null)
      if (modal === 'Projects') selectScope(String(id))
      else { if (modal === 'Galleries') setScope(String(values.projectId)); go(modal) }
      notify(`${modal === 'Galleries' ? 'Gallery' : modal.slice(0, -1)} created`)
    } catch (error) { notify(error.message) }
  }

  const changeStatus = async (section, item, status, message) => {
    try {
      const paid = section === 'Invoices' && status === 'Paid'
      const currency = item.currency || studioSettings.currency || 'USD'
      const saved = await saveRecord(section, { ...item, status, ...(paid ? { amountPaid: Number(String(item.amount || '0').replace(/[^\d.]/g, '')), balanceDue: new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0) } : {}) })
      if (selected?.id === item.id) setSelected(saved)
      notify(message)
    } catch (error) { notify(error.message) }
  }

  const exportData = async () => {
    try {
      const response = await fetch('/api/workspace/export')
      if (!response.ok) throw new Error('Export could not be downloaded.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `darkroom-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) { notify(error.message) }
  }
  const currentProject = projects.find(project => String(project.id) === scope)
  const unassignedItems = ['Galleries', 'Invoices', 'Contracts', 'Email'].flatMap(section => collections[section].filter(item => item.scope === 'unassigned' || (!item.projectId && item.scope !== 'global')).map(item => ({ section, item })))
  const projectRows = section => collections[section].filter(item => String(item.projectId) === scope)

  if (auth === undefined) return <div className="loading-screen">darkroom</div>
  if (!auth) return <AuthScreen onSubmit={authenticate} hasBrowserData={hasBrowserWorkspace()} inviteToken={inviteToken} />

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand-row"><button className="brand" onClick={() => selectScope('global')} aria-label="Darkroom overview"><span>darkroom</span><small>A BRIGHTER CREATIVE LIFE</small></button><button className="sidebar-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <div className="scope-picker"><label htmlFor="workspace-scope">WORKSPACE</label><select id="workspace-scope" value={scope} onChange={event => selectScope(event.target.value)}><option value="global">General studio</option><optgroup label="PROJECTS">{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</optgroup>{unassignedItems.length > 0 && <option value="unassigned">Needs sorting · {unassignedItems.length}</option>}</select></div>
      <nav aria-label="Main navigation">{nav.map(([label, Icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} aria-current={page === label ? 'page' : undefined} onClick={() => go(label)}><Icon size={19} weight={page === label ? 'fill' : 'regular'}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">{auth.displayName.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}</div><div><strong>{auth.displayName}</strong><small>{auth.studioName}</small></div></div><button className={`nav-item minor ${page === 'Settings' ? 'active' : ''}`} aria-current={page === 'Settings' ? 'page' : undefined} onClick={() => go('Settings')}><GearSixIcon size={19} weight={page === 'Settings' ? 'fill' : 'regular'}/>Settings</button><button className="nav-item minor" onClick={() => { setMobileNav(false); setModal('Help') }}><QuestionIcon size={19} weight="regular"/>Help</button><button className="nav-item minor signout" onClick={signOut}><SignOutIcon size={19} weight="regular"/>Sign out</button></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main className="main"><div className="mobile-top"><button onClick={() => setMobileNav(true)} aria-label="Open navigation"><ListIcon size={23} weight="regular"/></button><span>darkroom</span><select aria-label="Mobile workspace" value={scope} onChange={event => selectScope(event.target.value)}><option value="global">General</option><optgroup label="Projects">{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</optgroup>{unassignedItems.length > 0 && <option value="unassigned">Needs sorting</option>}</select></div>
      {page === 'Settings' ? <SettingsPage auth={auth} apiRequest={apiRequest} onSession={(user, token) => { if (token) switchSession(user, token).catch(error => notify(error.message)); else setAuth(user) }} onSettings={setStudioSettings} onExport={exportData} notify={notify}/> : page === 'Overview' && currentProject ? <ProjectOverview project={currentProject} galleries={projectRows('Galleries')} invoices={projectRows('Invoices')} contracts={projectRows('Contracts')} emails={projectRows('Email')} canEdit={auth.role !== 'viewer'} onOpen={(section, item) => { setPage(section); setSelected(item) }} onNew={section => section === 'Email' ? composeEmail() : (setEditingDocument(null), setModal(section))} onStatus={() => changeStatus('Projects', currentProject, 'Delivered', `${currentProject.name} marked delivered`)} onNavigate={section => go(section)}/> : page === 'Overview' && scope === 'unassigned' ? <div className="unassigned-overview"><header className="page-head inner-head"><div><h1>Needs sorting</h1><p>Place older documents and emails in the right project before sending them.</p></div></header>{unassignedItems.length ? unassignedItems.map(({ section, item }) => <button key={`${section}-${item.id}`} className="project-record" onClick={() => { setPage(section); setSelected(item) }}><span><strong>{item.title || item.subject}</strong><small>{section} · {item.client || item.recipient || 'No client'}</small></span><ArrowRight size={16}/></button>) : <div className="empty-panel"><h2>Everything has a place.</h2><p>There are no unassigned records.</p></div>}</div> : page === 'Overview' ? <StudioOverview projects={projects} invoices={invoices} contracts={contracts} emails={emails} canEdit={auth.role !== 'viewer'} onProject={openProject} onRecord={(section, item) => { setScope(item.projectId ? String(item.projectId) : section === 'Email' && item.scope === 'global' ? 'global' : 'unassigned'); setPage(section); setSelected(item) }} onNavigate={go} onNew={section => { setEditingDocument(null); setModal(section) }} onCompose={() => composeEmail()}/> : <>
        <header className="page-head inner-head"><div><span className="scope-kicker">{scope === 'global' ? 'GENERAL STUDIO' : scope === 'unassigned' ? 'NEEDS SORTING' : currentProject?.name?.toUpperCase()}</span><h1>{page}</h1><p>{subtitles[page]}</p></div>{auth.role !== 'viewer' && page !== 'Templates' && <button className="primary" onClick={() => page === 'Email' ? composeEmail() : (setEditingDocument(null), setModal(page))}>{sectionActions[page]} <Plus size={16}/></button>}</header>
        {selected && page === 'Email' ? <EmailDetail email={selected} project={projects.find(project => String(project.id) === String(selected.projectId))} projects={projects} canEdit={auth.role !== 'viewer'} onBack={() => setSelected(null)} onAssign={projectId => assignRecord('Email', selected, projectId).catch(error => notify(error.message))} onEditDraft={draft => composeEmail(null, draft)} onReuse={source => composeEmail(null, null, source)} onResend={resendEmail} onSaveTemplate={source => saveTemplate(source, 'Email').catch(error => notify(error.message))} notify={notify}/> : selected && page === 'Galleries' ? <GalleryDetail gallery={selected} project={projects.find(project => String(project.id) === String(selected.projectId))} projects={projects} clients={clients} canEdit={auth.role !== 'viewer'} csrfToken={csrfToken} apiRequest={apiRequest} onBack={() => setSelected(null)} onUpdate={updated => { setGalleries(previous => [updated, ...previous.filter(row => String(row.id) !== String(updated.id))]); setSelected(updated) }} onAssign={projectId => assignRecord('Galleries', selected, projectId).catch(error => notify(error.message))} onShare={gallery => composeEmail(null, null, null, null, gallery)} notify={notify}/> : selected && page === 'Templates' ? <TemplateDetail template={selected} canEdit={auth.role !== 'viewer'} onBack={() => setSelected(null)} onUse={useTemplate} onDelete={template => deleteTemplate(template).catch(error => notify(error.message))}/> : selected ? <Detail item={selected} page={page} canEdit={auth.role !== 'viewer'} projects={projects} onAssign={projectId => assignRecord(page, selected, projectId).catch(error => notify(error.message))} onSaveTemplate={item => saveTemplate(item, 'Contract').catch(error => notify(error.message))} onBack={() => setSelected(null)} onEdit={() => { setEditingDocument(selected); setModal(page) }} onStatus={(status, message) => changeStatus(page, selected, status, message)} onDownload={() => downloadDocument(page, selected, auth.studioName, studioSettings).catch(() => notify('PDF could not be generated'))} onEmail={() => composeEmail({ type: page, id: selected.id })} /> : scope === 'global' && ['Galleries', 'Invoices', 'Contracts'].includes(page) ? <section className="scope-empty"><h2>Choose a project to see its {page.toLowerCase()}.</h2><p>Project documents stay together, so only the right files appear when you write to a client.</p><div className="scope-project-list">{projects.map(project => <button key={project.id} onClick={() => setScope(String(project.id))}>{project.name}<ArrowRight size={16}/></button>)}</div>{!projects.length && auth.role !== 'viewer' && <button className="primary" onClick={() => setModal('Projects')}>Create a project</button>}</section> : <section className="workspace"><div className="workspace-toolbar"><div className="search"><Search size={18}/><input aria-label={`Search ${page.toLowerCase()}`} placeholder={`Search ${page.toLowerCase()}...`} value={query} onChange={e => setQuery(e.target.value)}/></div>{!['Clients', 'Templates'].includes(page) && <div className="filter"><SlidersHorizontal size={17}/><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option>{[...new Set(filtered.map(item => item.status))].map(status => <option key={status}>{status}</option>)}</select><ChevronDown size={15}/></div>}</div><div className="results-count">{filtered.length} {page.toLowerCase()}</div><CollectionTable page={page} items={filtered} onOpen={item => page === 'Projects' ? openProject(item) : setSelected(item)} /><div className="workspace-foot"><span>{page === 'Templates' ? 'Save an email or contract as a template from its detail view.' : 'Keep your studio moving, one detail at a time.'}</span></div></section>}
      </>}
    </main>
    {modal === 'Email' && <Suspense fallback={<EditorLoading label="email editor"/>}><EmailComposer key={`${emailDocument?.type || 'blank'}-${emailDocument?.id || emailDraft?.id || emailSource?.id || emailTemplate?.id || 'new'}`} documentRef={emailDocument} galleryRef={emailGallery} galleries={galleries} draft={emailDraft} source={emailSource} template={emailTemplate} projects={projects} invoices={invoices} contracts={contracts} clients={clients} scope={scope} studioName={auth.studioName} displayName={auth.displayName} onSave={saveEmail} onSend={sendEmail} onClose={() => setModal(null)} /></Suspense>}
    {modal === 'Contracts' && <Suspense fallback={<EditorLoading label="contract editor"/>}><ContractEditor key={editingDocument?.id || contractTemplate?.id || 'new'} item={editingDocument} template={contractTemplate} projects={projects} clients={clients} currentProjectId={scope} onClose={() => setModal(null)} onSave={item => saveDocument('Contracts', item)}/></Suspense>}
    {modal === 'Invoices' && <InvoiceEditor key={editingDocument?.id || 'new'} item={editingDocument} settings={studioSettings} projects={projects} clients={clients} currentProjectId={scope} onClose={() => setModal(null)} onSave={item => saveDocument('Invoices', item)}/>}
    {modal && !['Email', 'Contracts', 'Invoices'].includes(modal) && <Modal section={modal} projects={projects} scope={scope} onClose={() => setModal(null)} onSubmit={submit} />}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

const subtitles = { Projects: 'All your shoots, from first inquiry to final delivery.', Clients: 'The people at the heart of your work.', Galleries: 'Beautiful work, ready to share.', Invoices: 'Stay on top of what’s paid and what’s due.', Contracts: 'Every agreement in one place.', Email: 'Messages for this workspace.', Templates: 'Reusable writing for emails and agreements.' }

function CollectionTable({ page, items, onOpen }) {
  const headings = { Projects: ['PROJECT', 'CLIENT', 'DATE', 'STATUS'], Clients: ['CLIENT', 'EMAIL', 'PHONE', 'PROJECTS'], Galleries: ['GALLERY', 'CLIENT', 'PHOTOS', 'STATUS'], Invoices: ['INVOICE', 'CLIENT', 'AMOUNT', 'STATUS'], Contracts: ['CONTRACT', 'CLIENT', 'SENT', 'STATUS'], Email: ['SUBJECT', 'RECIPIENT', 'DATE', 'STATUS'], Templates: ['TEMPLATE', 'TYPE', 'CREATED', 'SCOPE'] }
  const cells = (item) => {
    if (page === 'Projects') return [item.name, item.client, displayDate(item.date), item.status]
    if (page === 'Clients') return [item.name, item.email, item.phone, `${item.projects} project${item.projects === 1 ? '' : 's'}`]
    if (page === 'Galleries') return [item.title, item.client, `${item.count} photos`, item.status]
    if (page === 'Invoices') return [item.title, item.client, item.amount, item.status]
    if (page === 'Contracts') return [item.title, item.client, item.sent, item.status]
    if (page === 'Templates') return [item.title, item.type, item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—', 'General']
    return [item.subject, item.recipient, item.date, item.status]
  }
  return <div className="table-scroll"><table className="collection-table"><thead><tr>{headings[page].map(h => <th key={h}>{h}</th>)}<th className="align-right">&nbsp;</th></tr></thead><tbody>{items.length ? items.map(item => <tr key={item.id} onClick={() => onOpen(item)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(item)}>{cells(item).map((cell, index) => <td key={index} data-label={headings[page][index]} className={index === 0 ? 'item-title' : ''}>{cell}</td>)}<td className="align-right"><ArrowRight size={17}/></td></tr>) : <tr><td colSpan={5} className="empty">No matching {page.toLowerCase()} found.</td></tr>}</tbody></table></div>
}

function Detail({ item, page, canEdit, projects, onAssign, onSaveTemplate, onBack, onEdit, onStatus, onDownload, onEmail }) {
  const [assignProject, setAssignProject] = useState('')
  const title = item.name || item.title || item.subject
  const isDocument = page === 'Invoices' || page === 'Contracts'
  const rows = page === 'Projects' ? [['Client', item.client], ['Type', item.type], ['Date', displayDate(item.date)], ['Location', item.location], ['Status', item.status]]
    : page === 'Clients' ? [['Email', item.email], ['Phone', item.phone], ['Projects', item.projects]]
    : page === 'Galleries' ? [['Client', item.client], ['Photos', item.count], ['Last updated', item.updated], ['Status', item.status]]
    : page === 'Invoices' ? [['Client', item.client], ['Email', item.email], ['Amount', item.amount], ['Balance due', item.balanceDue || item.amount], ['Due date', displayDate(item.due)], ['Status', item.status]]
    : page === 'Contracts' ? [['Client', item.client], ['Email', item.email], ['Services', item.service || 'Photography services'], ['Event date', displayDate(item.eventDate)], ['Fee', item.fee ? `$${Number(item.fee).toLocaleString('en-US')}` : 'To be agreed'], ['Status', item.status]]
    : [['Recipient', item.recipient], ['Date', item.date], ['Status', item.status], ['Attachments', item.attachmentRefs?.length ? `${item.attachmentRefs.length} PDF document${item.attachmentRefs.length === 1 ? '' : 's'}` : 'None']]
  const action = { Projects: ['Mark delivered', 'Delivered'], Galleries: ['Mark delivered', 'Delivered'], Invoices: ['Mark paid', 'Paid'], Contracts: ['Mark signed', 'Signed'] }[page]
  return <section className="detail">
    <button className="back-link" onClick={onBack}>← &nbsp; Back to {page.toLowerCase()}</button>
    <div className="detail-head"><div><span className="detail-kicker">{page === 'Email' ? 'EMAIL' : page.slice(0, -1).toUpperCase()}</span><h2>{title}</h2><p>{item.description || (page === 'Email' ? item.body || 'Email draft' : isDocument ? 'Your PDF is generated from these details.' : 'All the details in one place.')}</p></div></div>
    {page === 'Projects' && item.id === 1 && <div className="detail-image"><img src="/images/emma-daniel.png" alt="Emma and Daniel wedding portrait"/></div>}
    <div className="detail-content"><h3>Details</h3>{rows.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}
      {canEdit && !item.projectId && ['Galleries', 'Invoices', 'Contracts'].includes(page) && <div className="assign-project"><strong>Place in a project before sending</strong><select aria-label="Choose project for record" value={assignProject} onChange={event => setAssignProject(event.target.value)}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select><button className="secondary" disabled={!assignProject} onClick={() => onAssign(assignProject)}>Move to project</button></div>}
      {page === 'Contracts' && <div className="contract-terms"><span>AGREEMENT</span><ContractDocument content={item.document} legacyTerms={item.terms}/></div>}
      {page === 'Invoices' && item.lineItems?.length > 0 && <div className="invoice-detail-lines"><h3>Line items</h3>{item.lineItems.map((line, index) => <div key={index}><span>{line.description} · {line.quantity} × {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(line.unitPrice)}</span><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(line.quantity * line.unitPrice)}</strong></div>)}</div>}
      {page === 'Projects' && <div className="detail-progress"><span>Progress</span><strong>{item.progress}%</strong><div className="progress-line"><i style={{ width: `${item.progress}%` }}/></div></div>}
      <div className="detail-buttons">
        {isDocument && <><button className="secondary" onClick={onDownload}><Download size={16}/> Download PDF</button>{canEdit && <><button className="secondary" onClick={onEdit}>Edit {page === 'Invoices' ? 'invoice' : 'contract'}</button>{item.projectId && <button className="primary" onClick={onEmail}><Mail size={16}/> Email PDF</button>}{page === 'Contracts' && <button className="secondary" onClick={() => onSaveTemplate(item)}>Save as template</button>}</>}</>}
        {canEdit && page === 'Email' && item.status !== 'Sent' && <button className="primary" onClick={onEmail}>Open draft <ArrowRight size={16}/></button>}
        {canEdit && action && item.status !== action[1] && <button className="secondary" onClick={() => onStatus(action[1], `${title} marked ${action[1].toLowerCase()}`)}>{action[0]} <Check size={16}/></button>}
      </div>
    </div>
  </section>
}

function Modal({ section, projects, scope, onClose, onSubmit }) {
  const fields = {
    Projects: [['name', 'Project name', 'text', 'e.g. Jamie & Robin', true], ['client', 'Client name', 'text', 'e.g. Jamie Lee', true], ['clientEmail', 'Client email', 'email', 'jamie@example.com', false], ['type', 'Project type', 'select', 'Wedding,Portrait,Engagement,Commercial', false], ['date', 'Shoot date', 'date', '', false], ['location', 'Location', 'text', 'e.g. San Francisco, CA', false]],
    Clients: [['name', 'Full name', 'text', 'e.g. Jamie Lee', true], ['email', 'Email address', 'email', 'jamie@example.com', true], ['phone', 'Phone number', 'tel', '(415) 555-0123', false]],
    Galleries: [['title', 'Gallery name', 'text', 'e.g. Jamie & Robin', true], ['client', 'Client name', 'text', 'e.g. Jamie Lee', true], ['email', 'Client email', 'email', 'jamie@example.com', true]],
  }
  if (section === 'Help') return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal info-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button><h2>Help</h2><p>Create an invoice or contract, open it to download the PDF, then choose Email PDF to attach it to a message.</p><div className="info-actions"><button className="primary" onClick={onClose}>Done</button></div></div></div>
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span>ADD TO YOUR STUDIO</span><h2>{sectionActions[section]}</h2></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div><form onSubmit={onSubmit}>{section === 'Galleries' && <label>Project<select name="projectId" required defaultValue={projects.some(project => String(project.id) === scope) ? scope : ''}><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></label>}{fields[section].map(([name, label, type, placeholder, required]) => <label key={name}>{label}{type === 'select' ? <select name={name}>{placeholder.split(',').map(v => <option key={v}>{v}</option>)}</select> : type === 'textarea' ? <textarea name={name} rows="4" placeholder={placeholder} required={required}/> : <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={section === 'Galleries' && name === 'client' ? projects.find(project => String(project.id) === scope)?.client || '' : section === 'Galleries' && name === 'email' ? projects.find(project => String(project.id) === scope)?.clientEmail || '' : undefined}/>}</label>)}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Create <ArrowRight size={16}/></button></div></form></div></div>
}

export default App
