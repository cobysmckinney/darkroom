import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, createProject, registerStudio, startServer } from './helpers.js'

let server
beforeAll(async () => { server = await startServer() })
afterAll(() => server.close())

describe('accounts and sessions', () => {
  it('rejects unauthenticated workspace access', async () => {
    expect((await client(server.origin).get('/api/workspace')).status).toBe(401)
  })

  it('signs in with the registered password only', async () => {
    const owner = await registerStudio(server.origin)
    const visitor = client(server.origin)
    expect((await visitor.post('/api/auth/login', { email: owner.user.email, password: 'wrong password here' })).status).toBe(401)
    const result = await visitor.post('/api/auth/login', { email: owner.user.email, password: 'correct horse battery' })
    expect(result.status).toBe(200)
    expect(result.data.user.role).toBe('owner')
  })

  it('requires the CSRF token for changes', async () => {
    const owner = await registerStudio(server.origin)
    const result = await owner.request('/api/records/Projects', { method: 'PUT', body: { id: 'p1', name: 'x' }, headers: { 'X-CSRF-Token': 'forged' } })
    expect(result.status).toBe(403)
  })
})

describe('studio isolation and roles', () => {
  it('keeps records separate between studios', async () => {
    const first = await registerStudio(server.origin, 'First')
    const second = await registerStudio(server.origin, 'Second')
    await createProject(first, { id: 'shared-id', name: 'First project' })
    expect((await second.get('/api/workspace')).data.Projects).toEqual([])
  })

  it('lets viewers read but not edit', async () => {
    const owner = await registerStudio(server.origin)
    const invite = await owner.post('/api/studios/current/invites', { email: 'viewer@example.com', role: 'viewer' })
    const token = new URL(invite.data.inviteUrl).searchParams.get('invite')
    const viewer = client(server.origin)
    expect((await viewer.post('/api/auth/register', { displayName: 'Viewer', email: 'viewer@example.com', password: 'correct horse battery', inviteToken: token })).status).toBe(201)
    expect((await viewer.get('/api/workspace')).status).toBe(200)
    expect((await viewer.put('/api/records/Projects', { id: 'v1', name: 'Nope' })).status).toBe(403)
  })

  it('requires project documents to belong to a project in the studio', async () => {
    const owner = await registerStudio(server.origin)
    expect((await owner.put('/api/records/Invoices', { id: 'i1', title: 'Invoice #1', projectId: 'missing' })).status).toBe(400)
  })
})

describe('email sending', () => {
  it('refuses to send without SMTP settings', async () => {
    const owner = await registerStudio(server.origin)
    const result = await owner.post('/api/email/send', { to: 'jamie@example.com', subject: 'Hi', body: 'Hello', scope: 'global' })
    expect(result.status).toBe(503)
  })

  it('sends a general email and records it', async () => {
    const owner = await registerStudio(server.origin)
    await owner.put('/api/studios/current/settings', { name: 'Test Studio', smtpHost: 'smtp.example.com', smtpFrom: 'Studio <hello@example.com>' })
    const result = await owner.post('/api/email/send', { to: 'jamie@example.com', subject: 'Hello', body: 'Hello there', scope: 'global' })
    expect(result.status).toBe(200)
    expect(server.sent.at(-1)).toMatchObject({ to: 'jamie@example.com', subject: 'Hello' })
    expect((await owner.get('/api/workspace')).data.Email[0]).toMatchObject({ status: 'Sent', scope: 'global' })
  })
})
