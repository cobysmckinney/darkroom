// One timeline for the overview, the Schedule page, and the calendar feed.
import { dayKey, parseDate } from './format.js'
import { invoiceTotals } from './invoice.js'

export const eventKinds = ['Shoot', 'Client call', 'Meeting', 'Edit review', 'Deadline', 'Other']
export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
export const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const statusProgress = { Inquiry: 5, Planning: 15, 'Contract sent': 25, Booked: 35, Photographed: 55, Editing: 75, Delivered: 100 }
export const projectStatuses = Object.keys(statusProgress)

export function timeLabel(value) {
  if (!timePattern.test(value || '')) return ''
  const [hours, minutes] = value.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}
export const timeRange = item => item.start ? [timeLabel(item.start), timeLabel(item.end)].filter(Boolean).join(' – ') : 'All day'

export function scheduleItems({ events = [], projects = [], invoices = [] }) {
  const projectFor = id => projects.find(project => String(project.id) === String(id))
  const items = []
  for (const event of events) {
    if (!datePattern.test(event.date || '')) continue
    items.push({ key: `event-${event.id}`, source: 'event', event, kind: event.kind || 'Other', title: event.title, date: event.date, start: event.start || '', end: event.end || '', location: event.location || '', notes: event.notes || '', projectId: event.projectId, project: projectFor(event.projectId) })
  }
  // A project's shoot date counts as an event unless one is already scheduled for that day.
  for (const project of projects) {
    const date = parseDate(project.date)
    if (!date || project.status === 'Delivered') continue
    const key = dayKey(date)
    if (items.some(item => item.kind === 'Shoot' && String(item.projectId) === String(project.id) && item.date === key)) continue
    items.push({ key: `shoot-${project.id}`, source: 'project', kind: 'Shoot', title: `${project.type || 'Photo'} session — ${project.name}`, date: key, start: '', end: '', location: project.location && project.location !== 'Location to be confirmed' ? project.location : '', notes: '', projectId: project.id, project })
  }
  for (const invoice of invoices) {
    const date = parseDate(invoice.due)
    if (!date || ['Draft', 'Paid'].includes(invoice.status) || invoiceTotals(invoice).balance <= 0) continue
    items.push({ key: `invoice-${invoice.id}`, source: 'invoice', invoice, kind: 'Payment due', title: `${invoice.title} due — ${invoice.client || 'client'}`, date: dayKey(date), start: '', end: '', location: '', notes: '', projectId: invoice.projectId, project: projectFor(invoice.projectId) })
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.start || '99').localeCompare(b.start || '99') || a.title.localeCompare(b.title))
}

export function splitByToday(items, today = dayKey(new Date())) {
  return { upcoming: items.filter(item => item.date >= today), past: items.filter(item => item.date < today).reverse() }
}
