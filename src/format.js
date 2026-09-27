export const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'
export const displayDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? formatDate(value) : value

export const sectionActions = { Projects: 'New project', Clients: 'New client', Galleries: 'New gallery', Invoices: 'New invoice', Contracts: 'New contract', Email: 'Compose email', Templates: 'New template' }
