import React, { useState } from 'react'
import { ArrowRight, CalendarPlus } from 'lucide-react'
import { parseDate } from './format.js'
import { splitByToday, timeRange } from './schedule.js'

const monthName = date => parseDate(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export function ScheduleRow({ item, onOpen, showProject = true }) {
  const date = parseDate(item.date)
  const details = [timeRange(item), item.location, showProject && item.project && !item.title.includes(item.project.name) ? item.project.name : ''].filter(Boolean)
  return <button className={`schedule-row schedule-${item.source}`} onClick={() => onOpen(item)}>
    <span className="schedule-day"><small>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</small><strong>{String(date.getDate()).padStart(2, '0')}</strong></span>
    <span className="schedule-text"><strong>{item.title}</strong><small>{details.join(' · ')}</small></span>
    <span className="schedule-kind">{item.kind}</span>
  </button>
}

function groupByMonth(items) {
  const groups = []
  for (const item of items) {
    const label = monthName(item.date)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(item)
  }
  return groups
}

export default function SchedulePage({ items, project, canEdit, onAdd, onOpen, onCalendarSettings }) {
  const [showPast, setShowPast] = useState(false)
  const { upcoming, past } = splitByToday(items)
  return <div className="schedule-page">
    <header className="page-head inner-head"><div><span className="scope-kicker">{project ? project.name.toUpperCase() : 'GENERAL STUDIO'}</span><h1>Schedule</h1><p>{project ? 'Sessions, calls, and deadlines for this project.' : 'Every session, call, and deadline across your studio.'}</p></div>{canEdit && <button className="primary" onClick={onAdd}>Add event <CalendarPlus size={16}/></button>}</header>
    {upcoming.length ? groupByMonth(upcoming).map(group => <section className="schedule-month" key={group.label}><h2>{group.label}</h2><div className="schedule-list">{group.items.map(item => <ScheduleRow key={item.key} item={item} onOpen={onOpen} showProject={!project}/>)}</div></section>)
      : <div className="overview-empty">Nothing scheduled yet. {canEdit ? 'Add a session, call, or deadline, or set a shoot date on a project.' : ''}</div>}
    {past.length > 0 && <section className="schedule-month"><button className="schedule-past-toggle" onClick={() => setShowPast(value => !value)}>{showPast ? 'Hide' : 'Show'} past ({past.length}) <ArrowRight size={14}/></button>{showPast && <div className="schedule-list schedule-list-past">{past.map(item => <ScheduleRow key={item.key} item={item} onOpen={onOpen} showProject={!project}/>)}</div>}</section>}
    <p className="settings-hint">Shoot dates come from projects and payment dates from unpaid invoices. To see this schedule in Google, Apple, or Outlook Calendar, <button className="text-button" onClick={onCalendarSettings}>subscribe to your calendar feed</button>.</p>
  </div>
}
