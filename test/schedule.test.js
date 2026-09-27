import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, createProject, registerStudio, startServer } from './helpers.js'
import { scheduleItems, splitByToday, timeRange } from '../src/schedule.js'
import { dateInput, shortDate } from '../src/format.js'

let server
beforeAll(async () => { server = await startServer() })
afterAll(() => server.close())

const event = (values = {}) => ({ id: `e-${Math.random()}`, title: 'Client call', kind: 'Client call', date: '2026-10-02', start: '10:00', end: '10:30', location: 'Zoom', scope: 'global', ...values })

describe('events', () => {
  it('saves valid events and rejects invalid ones', async () => {
    const owner = await registerStudio(server.origin)
    const project = await createProject(owner)
    expect((await owner.put('/api/records/Events', event({ projectId: project.id, scope: 'project' }))).status).toBe(200)
    expect((await owner.put('/api/records/Events', event({ date: 'Oct 2' }))).status).toBe(400)
    expect((await owner.put('/api/records/Events', event({ end: '09:00' }))).status).toBe(400)
    expect((await owner.put('/api/records/Events', event({ start: '', end: '11:00' }))).status).toBe(400)
    expect((await owner.put('/api/records/Events', event({ kind: 'Party' }))).status).toBe(400)
    const missingProject = await owner.put('/api/records/Events', event({ projectId: 'nope' }))
    expect(missingProject).toMatchObject({ status: 400, data: { error: 'Choose a project for this record' } })
  })

  it('deletes events but not other records', async () => {
    const owner = await registerStudio(server.origin)
    const saved = (await owner.put('/api/records/Events', event())).data
    expect((await owner.request(`/api/records/Events/${encodeURIComponent(saved.id)}`, { method: 'DELETE' })).data.removed).toBe(true)
    expect((await owner.request('/api/records/Projects/1', { method: 'DELETE' })).status).toBe(404)
    expect((await owner.get('/api/workspace')).data.Events).toEqual([])
  })
})

describe('calendar feed', () => {
  it('serves events and shoot dates through a private link that can be replaced', async () => {
    const owner = await registerStudio(server.origin, 'Feed Studio')
    await createProject(owner, { id: 'p-feed', name: 'Morgan & Taylor', type: 'Wedding', date: '2026-10-12', location: 'San Francisco, CA' })
    await owner.put('/api/records/Events', event({ title: 'Planning call' }))
    expect((await owner.get('/api/calendar-feed')).data.active).toBe(false)

    const first = (await owner.post('/api/calendar-feed', {})).data.url
    const ics = await (await fetch(first)).text()
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Planning call')
    expect(ics).toContain('DTSTART:20261002T100000')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261012')
    expect(ics).toContain('X-WR-CALNAME:Feed Studio · Darkroom')

    const second = (await owner.post('/api/calendar-feed', {})).data.url
    expect((await fetch(first)).status).toBe(404)
    expect((await fetch(second)).status).toBe(200)
    await owner.request('/api/calendar-feed', { method: 'DELETE' })
    expect((await fetch(second)).status).toBe(404)
  })

  it('stops working when the member leaves the studio', async () => {
    const owner = await registerStudio(server.origin)
    const invite = await owner.post('/api/studios/current/invites', { email: 'editor@example.com', role: 'editor' })
    const editor = client(server.origin)
    const registered = await editor.post('/api/auth/register', { displayName: 'Editor', email: 'editor@example.com', password: 'correct horse battery', inviteToken: new URL(invite.data.inviteUrl).searchParams.get('invite') })
    const url = (await editor.post('/api/calendar-feed', {})).data.url
    expect((await fetch(url)).status).toBe(200)
    await owner.request(`/api/studios/current/members/${registered.data.user.id}`, { method: 'DELETE' })
    expect((await fetch(url)).status).toBe(404)
  })
})

describe('schedule timeline', () => {
  const projects = [{ id: 1, name: 'Emma & Daniel', type: 'Wedding', date: 'Oct 14, 2026', status: 'Editing' }, { id: 2, name: 'Done', date: '2026-06-01', status: 'Delivered' }]

  it('combines events, shoot dates, and unpaid invoice due dates in order', () => {
    const items = scheduleItems({ projects, events: [event({ date: '2026-10-14', start: '', end: '', title: 'Buffer day', kind: 'Other' })], invoices: [{ id: 9, title: 'Invoice #9', status: 'Open', due: '2026-10-01', lineItems: [{ quantity: 1, unitPrice: 100 }] }, { id: 10, title: 'Invoice #10', status: 'Paid', due: '2026-10-01' }] })
    expect(items.map(item => [item.date, item.kind])).toEqual([['2026-10-01', 'Payment due'], ['2026-10-14', 'Other'], ['2026-10-14', 'Shoot']])
  })

  it('does not duplicate a shoot that is already scheduled', () => {
    const items = scheduleItems({ projects, events: [event({ kind: 'Shoot', projectId: 1, date: '2026-10-14' })] })
    expect(items.filter(item => item.kind === 'Shoot')).toHaveLength(1)
  })

  it('splits by day and formats times', () => {
    const { upcoming, past } = splitByToday([{ date: '2026-09-26' }, { date: '2026-09-27' }], '2026-09-27')
    expect([upcoming.length, past.length]).toEqual([1, 1])
    expect(timeRange({ start: '17:00', end: '19:30' })).toBe('5:00 PM – 7:30 PM')
    expect(timeRange({ start: '' })).toBe('All day')
  })

  it('keeps plain dates on the same calendar day', () => {
    expect(dateInput('2026-10-12')).toBe('2026-10-12')
    expect(dateInput('Sep 21, 2026')).toBe('2026-09-21')
    expect(shortDate('2026-10-12')).toBe('Oct 12, 2026')
  })
})
