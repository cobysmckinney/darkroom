import { createHash, randomBytes } from 'node:crypto'
import { requireCsrf, requireSession } from './auth.js'
import { db, workspaceFor } from './database.js'
import { publicBase } from './clientLinks.js'
import { scheduleItems } from '../src/schedule.js'

// A private iCalendar feed per member and studio, for subscribing from Google, Apple, or Outlook calendars.
const hashToken = token => createHash('sha256').update(token).digest('hex')
const feedFor = db.prepare('SELECT created_at FROM calendar_feeds WHERE studio_id = ? AND user_id = ?')
const feedByToken = db.prepare(`
  SELECT calendar_feeds.studio_id, studios.name AS studio_name FROM calendar_feeds
  JOIN studio_members ON studio_members.studio_id = calendar_feeds.studio_id AND studio_members.user_id = calendar_feeds.user_id
  JOIN studios ON studios.id = calendar_feeds.studio_id
  WHERE calendar_feeds.token_hash = ?
`)

const escapeText = value => String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// Lines longer than 75 octets must be folded; 60 characters keeps multi-byte text safely under.
const fold = line => line.length <= 60 ? line : line.match(/.{1,60}/gsu).join('\r\n ')
const compactDate = date => date.replace(/-/g, '')
const nextDay = date => { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10) }
const addHour = time => `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, '0')}${time.slice(3, 5)}`

export function calendarFile(studioName, items, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Darkroom//Studio schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(`${studioName} · Darkroom`)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  for (const item of items) {
    // Times are "floating": calendar apps show them at the same clock time the studio entered.
    const when = item.start
      ? [`DTSTART:${compactDate(item.date)}T${item.start.replace(':', '')}00`, `DTEND:${compactDate(item.date)}T${item.end ? item.end.replace(':', '') : addHour(item.start)}00`]
      : [`DTSTART;VALUE=DATE:${compactDate(item.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(item.date))}`]
    const description = [item.kind, item.project ? `Project: ${item.project.name}` : '', item.notes].filter(Boolean).join('\n')
    lines.push('BEGIN:VEVENT', `UID:${item.key}@darkroom`, `DTSTAMP:${stamp}`, ...when, `SUMMARY:${escapeText(item.title)}`, ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []), ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []), 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function calendarRoutes(app) {
  app.get('/api/calendar-feed', requireSession, (request, response) => {
    const feed = feedFor.get(request.session.studio_id, request.session.user_id)
    response.json({ active: Boolean(feed), createdAt: feed ? new Date(feed.created_at).toISOString() : null })
  })
  // Creating a link replaces the previous one, so a leaked link can be revoked by making a new one.
  app.post('/api/calendar-feed', requireSession, requireCsrf, (request, response) => {
    let base
    try { base = publicBase(request) } catch (error) { return response.status(400).json({ error: error.message }) }
    const token = randomBytes(32).toString('base64url')
    db.prepare('INSERT INTO calendar_feeds (token_hash, studio_id, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (studio_id, user_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at').run(hashToken(token), request.session.studio_id, request.session.user_id, Date.now())
    response.status(201).json({ url: new URL(`/api/calendar/${token}.ics`, base).toString(), active: true })
  })
  app.delete('/api/calendar-feed', requireSession, requireCsrf, (request, response) => {
    db.prepare('DELETE FROM calendar_feeds WHERE studio_id = ? AND user_id = ?').run(request.session.studio_id, request.session.user_id)
    response.json({ active: false })
  })
  app.get('/api/calendar/:file', (request, response) => {
    const token = request.params.file.replace(/\.ics$/, '')
    const feed = /^[A-Za-z0-9_-]{43}$/.test(token) ? feedByToken.get(hashToken(token)) : null
    if (!feed) return response.status(404).json({ error: 'Calendar not found.' })
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    response.setHeader('Content-Disposition', 'inline; filename="darkroom.ics"')
    const workspace = workspaceFor(feed.studio_id)
    response.send(calendarFile(feed.studio_name, scheduleItems({ events: workspace.Events, projects: workspace.Projects, invoices: workspace.Invoices })))
  })
}
