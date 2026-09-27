// Plain dates ("2026-10-12") are calendar days, not instants: read them as local noon so no timezone shifts the day.
export const parseDate = value => {
  if (!value) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
export const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const dateInput = value => { const date = parseDate(value); return date ? dayKey(date) : '' }
export const shortDate = value => parseDate(value)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? value
export const formatDate = value => value ? shortDate(value) : 'Not set'
export const displayDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? formatDate(value) : value

export const sectionActions = { Projects: 'New project', Clients: 'New client', Galleries: 'New gallery', Invoices: 'New invoice', Contracts: 'New contract', Email: 'Compose email', Templates: 'New template', Schedule: 'Add event' }
