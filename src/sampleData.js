export const initialProjects = [
  { id: 1, name: 'Emma & Daniel', client: 'Emma Carter', type: 'Wedding', date: 'Oct 14, 2026', location: 'Lake Como, Italy', status: 'Editing', progress: 78, description: 'Final edits in progress. Gallery delivery scheduled for October 28, 2026.' },
  { id: 2, name: 'Priya & James', client: 'Priya Desai', type: 'Engagement', date: 'Sep 30, 2026', location: 'Golden Gate Park', status: 'Photographed', progress: 46, description: 'Selects are ready for review.' },
  { id: 3, name: 'Morgan & Taylor', client: 'Morgan Lee', type: 'Wedding', date: 'Oct 12, 2026', location: 'San Francisco, CA', status: 'Planning', progress: 18, description: 'Planning call scheduled for next week.' },
  { id: 4, name: 'Chris & Pat', client: 'Chris Nguyen', type: 'Portrait', date: 'Nov 2, 2026', location: 'Studio', status: 'Contract sent', progress: 12, description: 'Awaiting the signed contract.' },
  { id: 5, name: 'Sophie & Ryan', client: 'Sophie Chen', type: 'Wedding', date: 'Jun 8, 2026', location: 'Napa Valley, CA', status: 'Delivered', progress: 100, description: 'Final gallery delivered.' },
]
export const initialClients = [
  { id: 1, name: 'Emma Carter', email: 'emma.carter@example.com', phone: '(415) 555-0142', projects: 1 },
  { id: 2, name: 'Priya Desai', email: 'priya.desai@example.com', phone: '(415) 555-0184', projects: 1 },
  { id: 3, name: 'Morgan Lee', email: 'morgan.lee@example.com', phone: '(415) 555-0107', projects: 1 },
  { id: 4, name: 'Chris Nguyen', email: 'chris.nguyen@example.com', phone: '(415) 555-0128', projects: 1 },
  { id: 5, name: 'Sophie Chen', email: 'sophie.chen@example.com', phone: '(415) 555-0163', projects: 1 },
]
export const initialInvoices = [
  { id: 1042, title: 'Invoice #1042', client: 'Taylor Kim', email: 'taylor.kim@example.com', service: 'Wedding photography package', amount: '$2,800.00', status: 'Overdue', due: 'Sep 21, 2026', issued: 'Aug 21, 2026' },
  { id: 1041, title: 'Invoice #1041', client: 'Emma Carter', email: 'emma.carter@example.com', service: 'Wedding photography package', amount: '$3,500.00', status: 'Paid', due: 'Sep 12, 2026', issued: 'Aug 12, 2026' },
  { id: 1040, title: 'Invoice #1040', client: 'Morgan Lee', email: 'morgan.lee@example.com', service: 'Wedding photography deposit', amount: '$1,200.00', status: 'Draft', due: 'Oct 10, 2026', issued: 'Sep 24, 2026' },
]
export const initialContracts = [
  { id: 1, title: 'Wedding photography agreement', client: 'Morgan Lee', email: 'morgan.lee@example.com', service: 'Wedding coverage and edited digital gallery', eventDate: 'Oct 12, 2026', fee: '3200', terms: 'Photographer will provide coverage and an edited digital gallery. Both parties will confirm the final timeline and deliverables before the event.', status: 'Awaiting signature', sent: 'Sep 20, 2026' },
  { id: 2, title: 'Portrait session agreement', client: 'Chris Nguyen', email: 'chris.nguyen@example.com', service: 'Portrait photography session', eventDate: 'Nov 2, 2026', fee: '650', terms: 'Photographer will provide a portrait session and an edited selection of images. Session details and delivery timing will be confirmed before the shoot.', status: 'Draft', sent: 'Not sent' },
  { id: 3, title: 'Wedding photography agreement', client: 'Emma Carter', email: 'emma.carter@example.com', service: 'Wedding coverage and edited digital gallery', eventDate: 'Oct 14, 2026', fee: '3500', terms: 'Photographer will provide wedding coverage and an edited digital gallery as agreed with the client.', status: 'Signed', sent: 'Aug 18, 2026' },
]
export const initialGalleries = [
  { id: 1, title: 'Priya & James', client: 'Priya Desai', count: 421, status: 'Ready to deliver', updated: 'Sep 22, 2026' },
  { id: 2, title: 'Sophie & Ryan', client: 'Sophie Chen', count: 638, status: 'Delivered', updated: 'Jul 12, 2026' },
  { id: 3, title: 'Emma & Daniel', client: 'Emma Carter', count: 784, status: 'In progress', updated: 'Sep 23, 2026' },
]
export const initialEmails = [
  { id: 1, subject: 'Your invoice from Alex Rivera Studio', recipient: 'morgan.lee@example.com', status: 'Draft', date: 'Sep 23, 2026', body: 'Hi Morgan,\n\nPlease find your invoice attached.\n\nBest,\nAlex', attachmentRefs: [{ type: 'Invoices', id: 1040 }] },
  { id: 2, subject: 'Thank you for a wonderful day', recipient: 'sophie.chen@example.com', status: 'Sent', date: 'Jul 12, 2026', body: 'Hi Sophie,\n\nThank you for a wonderful day.\n\nBest,\nAlex', attachmentRefs: [] },
]
export const initialEvents = [
  { id: 'sample-event-1', projectId: 2, scope: 'project', kind: 'Shoot', title: 'Engagement session — Priya & James', date: '2026-09-30', start: '17:00', end: '19:00', location: 'Golden Gate Park', notes: '' },
  { id: 'sample-event-2', projectId: 3, scope: 'project', kind: 'Client call', title: 'Client call — Morgan & Taylor', date: '2026-10-02', start: '10:00', end: '10:30', location: 'Zoom', notes: 'Walk through the wedding day timeline.' },
  { id: 'sample-event-3', projectId: 1, scope: 'project', kind: 'Edit review', title: 'Edit review — Emma & Daniel', date: '2026-10-06', start: '11:00', end: '12:00', location: 'Studio', notes: '' },
  { id: 'sample-event-4', projectId: 4, scope: 'project', kind: 'Meeting', title: 'Contract meeting — Chris & Pat', date: '2026-10-09', start: '14:00', end: '14:30', location: 'Zoom', notes: '' },
]
