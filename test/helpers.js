import { createApp } from '../server/app.js'

export async function startServer(options = {}) {
  const sent = []
  const mailTransport = () => ({ sendMail: async message => { sent.push(message); return { messageId: `<test-${sent.length}@darkroom>` } } })
  const app = createApp({ mailTransport, ...options })
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  const origin = `http://127.0.0.1:${server.address().port}`
  return { origin, sent, close: () => new Promise(resolve => server.close(resolve)) }
}

// A tiny browser stand-in: keeps the session cookie and CSRF token between requests.
export function client(origin) {
  let cookie = ''
  let csrf = ''
  const request = async (path, { method = 'GET', body, raw, headers = {} } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': csrf, Origin: origin } : {}), ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const type = response.headers.get('content-type') || ''
    const data = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())
    if (data?.csrfToken) csrf = data.csrfToken
    return { status: response.status, data, headers: response.headers }
  }
  return { request, get: path => request(path), put: (path, body) => request(path, { method: 'PUT', body }), post: (path, body) => request(path, { method: 'POST', body }) }
}

let userCount = 0
export async function registerStudio(origin, studioName = 'Test Studio') {
  const user = client(origin)
  userCount += 1
  const result = await user.post('/api/auth/register', { studioName, displayName: `Owner ${userCount}`, email: `owner${userCount}-${Date.now()}@example.com`, password: 'correct horse battery' })
  if (result.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(result.data)}`)
  return { ...user, user: result.data.user }
}

export async function createProject(user, values = {}) {
  const project = { id: `project-${Math.random().toString(36).slice(2)}`, name: 'Jamie & Robin', client: 'Jamie Lee', clientEmail: 'jamie@example.com', status: 'Planning', progress: 0, ...values }
  const result = await user.put('/api/records/Projects', project)
  if (result.status !== 200) throw new Error(`Project failed: ${JSON.stringify(result.data)}`)
  return result.data
}
