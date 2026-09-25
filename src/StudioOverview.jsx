import React, { useState } from 'react'
import { ArrowRight, FileSignature, FileText, Mail, Plus } from 'lucide-react'

const readableDate = value => {
  if (!value) return 'Date not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StudioOverview({ projects, invoices, contracts, emails, canEdit, onProject, onRecord, onNavigate, onNew, onCompose }) {
  const [showAllAttention, setShowAllAttention] = useState(false)
  const activeProjects = projects.filter(project => project.status !== 'Delivered')
  const projectName = id => projects.find(project => String(project.id) === String(id))?.name || 'Needs sorting'
  const attentionItems = [
    ...invoices.filter(item => ['Overdue', 'Open', 'Reminder sent'].includes(item.status)).map(item => ({ section: 'Invoices', item, label: item.status === 'Overdue' ? 'Overdue invoice' : 'Open invoice', icon: FileText, detail: item.due ? `Due ${readableDate(item.due)}` : item.amount })),
    ...contracts.filter(item => item.status === 'Awaiting signature').map(item => ({ section: 'Contracts', item, label: 'Awaiting signature', icon: FileSignature, detail: item.sent && item.sent !== 'Not sent' ? `Sent ${readableDate(item.sent)}` : 'Not sent yet' })),
  ]
  const attention = showAllAttention ? attentionItems : attentionItems.slice(0, 4)
  const recentEmails = [...emails].sort((a, b) => new Date(b.sentAt || b.date || 0) - new Date(a.sentAt || a.date || 0)).slice(0, 4)

  return <div className="studio-overview">
    <header className="page-head studio-overview-head"><div><h1>Studio overview</h1><p>What needs your attention, and where to go next.</p></div>{canEdit && <button className="primary" onClick={() => onNew('Projects')}><Plus size={17}/> New project</button>}</header>
    <section className="studio-overview-section"><div className="overview-section-head"><h2>Needs your attention</h2>{attentionItems.length > 4 ? <button onClick={() => setShowAllAttention(value => !value)}>{showAllAttention ? 'Show less' : `View all ${attentionItems.length}`} <ArrowRight size={15}/></button> : <span>{attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}</span>}</div>
      {attention.length ? <div className="overview-attention-list">{attention.map(({ section, item, label, icon: Icon, detail }) => <div className="overview-attention-row" key={`${section}-${item.id}`}><span className={`overview-attention-icon ${section === 'Invoices' ? 'invoice' : 'contract'}`}><Icon size={20} strokeWidth={1.6}/></span><div className="overview-attention-title"><small>{label}</small><strong>{item.title}</strong><span className="overview-attention-mobile-context">{item.client || 'No client'} · {item.projectId ? projectName(item.projectId) : 'Needs sorting'}</span><span>{detail}</span></div><div className="overview-attention-context"><small>Client</small><span>{item.client || '—'}</span></div><div className="overview-attention-context"><small>Project</small><span>{item.projectId ? projectName(item.projectId) : 'Needs sorting'}</span></div><button className="secondary overview-row-action" onClick={() => onRecord(section, item)}>View {section === 'Invoices' ? 'invoice' : 'contract'}</button></div>)}</div> : <div className="overview-empty">No invoices or contracts need follow-up right now.</div>}
    </section>
    <section className="studio-overview-section"><div className="overview-section-head"><h2>Active projects</h2><button onClick={() => onNavigate('Projects')}>View all <ArrowRight size={15}/></button></div>
      {activeProjects.length ? <div className="overview-project-list">{activeProjects.slice(0, 5).map(project => <button className="overview-project-row" key={project.id} onClick={() => onProject(project)}><span className="overview-project-title"><strong>{project.name}</strong><small>{project.client || 'No client yet'}</small></span><span className="overview-project-date">{readableDate(project.date)}</span><span className="overview-project-status">{project.status || 'Planning'}</span><span className="overview-project-open">Open project <ArrowRight size={16}/></span></button>)}</div> : <div className="overview-empty">{projects.length ? 'All projects are delivered.' : 'Create your first project to keep its documents and emails together.'}</div>}
    </section>
    <div className="overview-bottom"><section className="studio-overview-section"><div className="overview-section-head"><h2>Quick actions</h2></div><div className="overview-quick-actions">{canEdit && <><button onClick={onCompose}><Mail size={18}/> Compose email</button><button onClick={() => onNew('Invoices')}><FileText size={18}/> New invoice</button><button onClick={() => onNew('Contracts')}><FileSignature size={18}/> New contract</button></>}{!canEdit && <p className="overview-empty">Your studio tools are available from the navigation.</p>}</div></section>
      <section className="studio-overview-section"><div className="overview-section-head"><h2>Recent email</h2></div>{recentEmails.length ? <div className="overview-email-list">{recentEmails.map(item => <button key={item.id} onClick={() => onRecord('Email', item)}><Mail size={16}/><span><strong>{item.subject || 'No subject'}</strong><small>{item.recipient || 'No recipient'} · {item.status}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="overview-empty">Your recent messages will appear here.</div>}</section></div>
  </div>
}
