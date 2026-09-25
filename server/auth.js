import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createStudioAndUser, createStudioForUser, createUserForInvite, db, deleteExpiredSessions, deleteInvite, deleteSession, getInvite, getSession, getUserByEmail, insertSession, studiosForUser } from './database.js'

const scrypt = promisify(scryptCallback)
const sessionHours = 12
const loginAttempts = new Map()

const tokenHash = token => createHash('sha256').update(token).digest('hex')
const cookieName = request => request.secure ? '__Host-darkroom_session' : 'darkroom_session'
const cookieValue = request => {
  const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map(part => part.trim().split('=').slice(0, 2)))
  return cookies['__Host-darkroom_session'] || cookies.darkroom_session
}
export const publicUser = row => ({ id: row.user_id || row.id, studioId: row.studioId || row.studio_id, email: row.email, displayName: row.displayName || row.display_name, studioName: row.studioName || row.studio_name, role: row.role || 'owner' })

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url')
  const hash = await scrypt(password, salt, 64, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
  return `scrypt$131072$8$1$${salt}$${hash.toString('base64url')}`
}

async function verifyPassword(password, stored) {
  const [algorithm, cost, blockSize, parallelism, salt, expected] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) return false
  const actual = await scrypt(password, salt, 64, { N: Number(cost), r: Number(blockSize), p: Number(parallelism), maxmem: 256 * 1024 * 1024 })
  const expectedBytes = Buffer.from(expected, 'base64url')
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes)
}

export function setSession(response, request, user) {
  const token = randomBytes(32).toString('base64url')
  const csrfToken = randomBytes(32).toString('base64url')
  const now = Date.now()
  const studioId = user.studioId || user.studio_id
  insertSession.run(tokenHash(token), user.id, studioId, csrfToken, now + sessionHours * 60 * 60 * 1000, now)
  db.prepare('UPDATE users SET active_studio_id = ? WHERE id = ?').run(studioId, user.id)
  response.setHeader('Set-Cookie', `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict${request.secure ? '; Secure' : ''}`)
  response.setHeader('Cache-Control', 'no-store')
  return { user: publicUser(user), csrfToken }
}

export function loadSession(request, _response, next) {
  const token = cookieValue(request)
  request.session = token ? getSession.get(tokenHash(token), Date.now()) : null
  next()
}

export function requireSession(request, response, next) {
  if (!request.session) return response.status(401).json({ error: 'Please sign in.' })
  next()
}

export function requireCsrf(request, response, next) {
  if (!request.session || request.get('X-CSRF-Token') !== request.session.csrf_token) return response.status(403).json({ error: 'Invalid session token.' })
  next()
}

export function requireEditor(request, response, next) {
  if (!request.session) return response.status(401).json({ error: 'Please sign in.' })
  if (request.session.role === 'viewer') return response.status(403).json({ error: 'Editing requires editor access.' })
  next()
}

export function requireAdmin(request, response, next) {
  if (!request.session) return response.status(401).json({ error: 'Please sign in.' })
  if (!['owner', 'admin'].includes(request.session.role)) return response.status(403).json({ error: 'Studio admin access is required.' })
  next()
}

export function checkOrigin(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next()
  const origin = request.get('Origin')
  if (origin) {
    try { if (new URL(origin).host !== request.get('Host')) return response.status(403).json({ error: 'Invalid request origin.' }) }
    catch { return response.status(403).json({ error: 'Invalid request origin.' }) }
  }
  next()
}

function rateLimited(key) {
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry || entry.resetAt < now) { loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false }
  entry.count += 1
  return entry.count > 10
}

export function authRoutes(app) {
  app.get('/api/auth/me', (request, response) => {
    if (!request.session) return response.status(401).json({ error: 'Please sign in.' })
    response.setHeader('Cache-Control', 'no-store')
    response.json({ user: publicUser(request.session), csrfToken: request.session.csrf_token })
  })

  app.post('/api/auth/register', async (request, response) => {
    const { studioName, displayName, email, password, inviteToken } = request.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const invite = typeof inviteToken === 'string' ? getInvite.get(tokenHash(inviteToken), Date.now()) : null
    if (inviteToken && (!invite || invite.email !== normalizedEmail)) return response.status(400).json({ error: 'This invitation is invalid, expired, or for a different email.' })
    if ((!invite && (typeof studioName !== 'string' || !studioName.trim() || studioName.length > 80)) || typeof displayName !== 'string' || !displayName.trim() || displayName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 12 || password.length > 128) return response.status(400).json({ error: 'Add a studio name, your name, a valid email, and a password of at least 12 characters.' })
    if (rateLimited(`register:${request.ip}`)) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
    if (getUserByEmail.get(normalizedEmail)) return response.status(409).json({ error: 'An account with this email already exists.' })
    try {
      const passwordHash = await hashPassword(password)
      const user = invite ? createUserForInvite({ studioId: invite.studio_id, role: invite.role, displayName: displayName.trim(), email: normalizedEmail, passwordHash }) : createStudioAndUser({ studioName: studioName.trim(), displayName: displayName.trim(), email: normalizedEmail, passwordHash })
      if (invite) deleteInvite.run(invite.token_hash)
      response.status(201).json(setSession(response, request, user))
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return response.status(409).json({ error: 'An account with this email already exists.' })
      console.error('Registration failed:', error)
      response.status(500).json({ error: 'Account could not be created.' })
    }
  })

  app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (typeof password !== 'string' || !normalizedEmail) return response.status(400).json({ error: 'Enter your email and password.' })
    const key = `login:${request.ip}:${normalizedEmail}`
    if (rateLimited(key)) return response.status(429).json({ error: 'Too many attempts. Try again later.' })
    try {
      const user = getUserByEmail.get(normalizedEmail)
      if (!user || !(await verifyPassword(password, user.password_hash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
      loginAttempts.delete(key)
      let memberships = studiosForUser.all(user.id)
      if (!memberships.length) memberships = [createStudioForUser(user.id, `${user.display_name}'s Studio`)]
      const studio = memberships.find(row => row.id === user.active_studio_id) || memberships[0]
      response.json(setSession(response, request, { ...user, studioId: studio.id, studioName: studio.name, role: studio.role }))
    } catch (error) {
      console.error('Login failed:', error)
      response.status(500).json({ error: 'Sign in failed.' })
    }
  })

  app.post('/api/auth/logout', requireSession, requireCsrf, (request, response) => {
    deleteSession.run(request.session.token_hash)
    response.setHeader('Set-Cookie', `${cookieName(request)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${request.secure ? '; Secure' : ''}`)
    response.setHeader('Cache-Control', 'no-store')
    response.json({ signedOut: true })
  })
}

deleteExpiredSessions.run(Date.now())
