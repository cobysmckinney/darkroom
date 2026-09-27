import React, { useEffect, useState } from 'react'
import { ArrowRight, BellRing, FileSignature, FileText, Mail, Plus } from 'lucide-react'
import { invoiceTotals, money } from './invoice.js'
import { dayKey, parseDate, shortDate } from './format.js'
import { splitByToday } from './schedule.js'
import { ScheduleRow } from './SchedulePage.jsx'

const readableDate = value => value ? shortDate(value) : 'Date not set'

const daysOverdue = due => {
  const date = parseDate(due)
  if (!date) return 0
  date.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((Date.now() - date.getTime()) / 86_400_000))
}
const reminded = item => item.lastSentAt ? ` · Last emailed ${readableDate(item.lastSentAt)}` : ''

function invoiceAttention(item) {
  const totals = invoiceTotals(item)
  if (['Draft', 'Paid'].includes(item.status) || totals.balance <= 0) return null
  const overdue = daysOverdue(item.due)
  const label = overdue > 0 || item.status === 'Overdue' ? 'Overdue invoice' : item.status === 'Partially paid' ? 'Partially paid' : 'Open invoice'
  const timing = overdue > 0 ? `${overdue} day${overdue === 1 ? '' : 's'} overdue` : item.due ? `Due ${readableDate(item.due)}` : 'No due date'
  return { section: 'Invoices', item, label, icon: FileText, overdue, detail: `${money(totals.balance, totals.currency)} due · ${timing}${reminded(item)}` }
}

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }

// The project you're most likely working on: the one furthest along in post-production, otherwise the nearest shoot date.
function currentProject(projects) {
  const active = projects.filter(project => project.status !== 'Delivered')
  const working = active.filter(project => ['Photographed', 'Editing'].includes(project.status))
  if (working.length) return [...working].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0]
  const today = parseDate(dayKey(new Date()))
  const distance = project => { const date = parseDate(project.date); return date ? Math.abs(date - today) : Infinity }
  return [...active].sort((a, b) => distance(a) - distance(b))[0]
}

function CurrentProject({ project, galleries, onOpen }) {
  const [cover, setCover] = useState(project.id === 1 ? '/images/emma-daniel.png' : '')
  useEffect(() => {
    if (project.id === 1) return
    let active = true
    setCover('')
    const gallery = galleries.find(item => String(item.projectId) === String(project.id) && item.count > 0)
    if (gallery) fetch(`/api/galleries/${encodeURIComponent(gallery.id)}/photos`).then(response => response.ok ? response.json() : []).then(photos => { if (active && photos[0]) setCover(`/api/galleries/${encodeURIComponent(gallery.id)}/photos/${encodeURIComponent(photos[0].id)}`) }).catch(() => {})
    return () => { active = false }
  }, [project.id, galleries])
  const details = [project.type, project.location !== 'Location to be confirmed' && project.location, parseDate(project.date) && shortDate(project.date)].filter(Boolean)
  return <article className="current-project">
    <button className={`current-project-cover ${cover ? '' : 'no-cover'}`} onClick={() => onOpen(project)} aria-label={`Open ${project.name}`}>
      {cover && <img src={cover} alt=""/>}
      <span className="current-project-caption"><small>CURRENT PROJECT</small><strong>{project.name}</strong><span>{details.join('  ·  ')}</span><em>Open project <ArrowRight size={15}/></em></span>
    </button>
    <div className="current-project-foot"><p>{project.description && project.description !== 'New project created.' ? project.description : `${project.status || 'Planning'} · ${project.client}`}</p><div className="current-project-progress"><span>Progress</span><div className="progress-line"><i style={{ width: `${project.progress || 0}%` }}/></div><strong>{project.progress || 0}%</strong></div></div>
  </article>
}

export default function StudioOverview({ auth, projects, galleries, invoices, contracts, emails, schedule, canEdit, onProject, onRecord, onNavigate, onNew, onCompose, onRemind, onScheduleItem }) {
  const [showAllAttention, setShowAllAttention] = useState(false)
  const activeProjects = projects.filter(project => project.status !== 'Delivered')
  const projectName = id => projects.find(project => String(project.id) === String(id))?.name || 'Needs sorting'
  const attentionItems = [
    ...invoices.map(invoiceAttention).filter(Boolean).sort((a, b) => b.overdue - a.overdue),
    ...contracts.filter(item => item.status === 'Awaiting signature' && !item.signature).map(item => ({ section: 'Contracts', item, label: 'Awaiting signature', icon: FileSignature, detail: `${item.sent && item.sent !== 'Not sent' ? `Sent ${readableDate(item.sent)}` : 'Not sent yet'}${reminded(item)}` })),
  ]
  const attention = showAllAttention ? attentionItems : attentionItems.slice(0, 4)
  const featured = currentProject(projects)
  const upcoming = splitByToday(schedule.filter(item => item.source !== 'invoice')).upcoming.slice(0, 4)
  const recentEmails = [...emails].sort((a, b) => new Date(b.sentAt || b.date || 0) - new Date(a.sentAt || a.date || 0)).slice(0, 4)

  return <div className="studio-overview">
    <header className="page-head studio-overview-head"><div><h1>{greeting()}, {auth.displayName.split(' ')[0]}</h1><p>Here’s what’s happening with your studio.</p></div>{canEdit && <button className="primary" onClick={() => onNew('Projects')}><Plus size={17}/> New project</button>}</header>
    <div className="overview-grid">
      {featured ? <CurrentProject project={featured} galleries={galleries} onOpen={onProject}/> : <div className="empty-panel"><h2>Your next story starts here.</h2><p>Create a project to keep its sessions, documents, galleries, and email together.</p>{canEdit && <button className="primary" onClick={() => onNew('Projects')}><Plus size={17}/> New project</button>}</div>}
      <div className="overview-right"><section className="studio-overview-section"><div className="overview-section-head"><h2>Upcoming</h2><button onClick={() => onNavigate('Schedule')}>View all <ArrowRight size={15}/></button></div>{upcoming.length ? <div className="schedule-list">{upcoming.map(item => <ScheduleRow key={item.key} item={item} onOpen={onScheduleItem}/>)}</div> : <div className="overview-empty">No upcoming sessions. {canEdit && <button className="text-button" onClick={() => onNew('Schedule')}>Add an event</button>}</div>}</section></div>
    </div>
    <section className="studio-overview-section"><div className="overview-section-head"><h2>Needs your attention</h2>{attentionItems.length > 4 ? <button onClick={() => setShowAllAttention(value => !value)}>{showAllAttention ? 'Show less' : `View all ${attentionItems.length}`} <ArrowRight size={15}/></button> : <span>{attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}</span>}</div>
      {attention.length ? <div className="overview-attention-list">{attention.map(({ section, item, label, icon: Icon, detail }) => <div className="overview-attention-row" key={`${section}-${item.id}`}><span className={`overview-attention-icon ${section === 'Invoices' ? 'invoice' : 'contract'}`}><Icon size={20} strokeWidth={1.6}/></span><div className="overview-attention-title"><small>{label}</small><strong>{item.title}</strong><span className="overview-attention-mobile-context">{item.client || 'No client'} · {item.projectId ? projectName(item.projectId) : 'Needs sorting'}</span><span>{detail}</span></div><div className="overview-attention-context"><small>Client</small><span>{item.client || '—'}</span></div><div className="overview-attention-context"><small>Project</small><span>{item.projectId ? projectName(item.projectId) : 'Needs sorting'}</span></div><div className="overview-row-actions">{canEdit && item.projectId && item.email && <button className="primary overview-row-action" onClick={() => onRemind(section, item)}><BellRing size={15}/> Send reminder</button>}<button className="secondary overview-row-action" onClick={() => onRecord(section, item)}>View {section === 'Invoices' ? 'invoice' : 'contract'}</button></div></div>)}</div> : <div className="overview-empty">No invoices or contracts need follow-up right now.</div>}
    </section>
    <section className="studio-overview-section"><div className="overview-section-head"><h2>Active projects</h2><button onClick={() => onNavigate('Projects')}>View all <ArrowRight size={15}/></button></div>
      {activeProjects.length ? <div className="overview-project-list">{activeProjects.slice(0, 5).map(project => <button className="overview-project-row" key={project.id} onClick={() => onProject(project)}><span className="overview-project-title"><strong>{project.name}</strong><small>{project.client || 'No client yet'}</small></span><span className="overview-project-date">{readableDate(project.date)}</span><span className="overview-project-status">{project.status || 'Planning'}</span><span className="overview-project-open">Open project <ArrowRight size={16}/></span></button>)}</div> : <div className="overview-empty">{projects.length ? 'All projects are delivered.' : 'Create your first project to keep its documents and emails together.'}</div>}
    </section>
    <div className="overview-bottom"><section className="studio-overview-section"><div className="overview-section-head"><h2>Quick actions</h2></div><div className="overview-quick-actions">{canEdit && <><button onClick={onCompose}><Mail size={18}/> Compose email</button><button onClick={() => onNew('Invoices')}><FileText size={18}/> New invoice</button><button onClick={() => onNew('Contracts')}><FileSignature size={18}/> New contract</button></>}{!canEdit && <p className="overview-empty">Your studio tools are available from the navigation.</p>}</div></section>
      <section className="studio-overview-section"><div className="overview-section-head"><h2>Recent email</h2></div>{recentEmails.length ? <div className="overview-email-list">{recentEmails.map(item => <button key={item.id} onClick={() => onRecord('Email', item)}><Mail size={16}/><span><strong>{item.subject || 'No subject'}</strong><small>{item.recipient || 'No recipient'} · {item.status}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="overview-empty">Your recent messages will appear here.</div>}</section></div>
  </div>
}
