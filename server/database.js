import { randomUUID } from 'node:crypto'
import { mkdirSync, chmodSync, copyFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'

export const sections = ['Projects', 'Clients', 'Galleries', 'Invoices', 'Contracts', 'Email', 'Templates']
const projectSections = new Set(['Galleries', 'Invoices', 'Contracts', 'Email'])
export const databasePath = path.resolve(process.env.DB_PATH || 'data/darkroom.sqlite')
mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 })
export const db = new DatabaseSync(databasePath, { timeout: 5000 })
if (existsSync(databasePath)) chmodSync(databasePath, 0o600)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
const needsMembershipMigration = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'studio_members'").get()
db.exec(`
  CREATE TABLE IF NOT EXISTS studios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS records (
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (studio_id, section, id)
  );
  CREATE INDEX IF NOT EXISTS records_studio_section_idx ON records(studio_id, section, updated_at DESC);
  CREATE TABLE IF NOT EXISTS studio_members (
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
    PRIMARY KEY (studio_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS studio_settings (
    studio_id TEXT PRIMARY KEY REFERENCES studios(id) ON DELETE CASCADE,
    smtp_host TEXT NOT NULL DEFAULT '',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure INTEGER NOT NULL DEFAULT 0,
    smtp_user TEXT NOT NULL DEFAULT '',
    smtp_password TEXT NOT NULL DEFAULT '',
    smtp_from TEXT NOT NULL DEFAULT '',
    business_email TEXT NOT NULL DEFAULT '',
    business_address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    tax_id TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_terms TEXT NOT NULL DEFAULT '',
    invoice_notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS studio_invites (
    token_hash TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_attachments (
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    email_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (studio_id, email_id, position)
  );
  CREATE TABLE IF NOT EXISTS gallery_photos (
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    gallery_id TEXT NOT NULL,
    id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    content BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (studio_id, gallery_id, id)
  );
  CREATE INDEX IF NOT EXISTS gallery_photos_gallery_idx ON gallery_photos(studio_id, gallery_id, created_at);
  CREATE TABLE IF NOT EXISTS gallery_shares (
    token_hash TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    gallery_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS gallery_shares_gallery_idx ON gallery_shares(studio_id, gallery_id, created_at DESC);
`)
if (!db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'studio_id')) db.exec('ALTER TABLE sessions ADD COLUMN studio_id TEXT')
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'active_studio_id')) db.exec('ALTER TABLE users ADD COLUMN active_studio_id TEXT')
db.exec(`
  UPDATE sessions SET studio_id = (SELECT studio_id FROM users WHERE users.id = sessions.user_id) WHERE studio_id IS NULL;
  UPDATE users SET active_studio_id = studio_id WHERE active_studio_id IS NULL;
  CREATE INDEX IF NOT EXISTS studio_members_user_idx ON studio_members(user_id);
`)
if (needsMembershipMigration) db.exec("INSERT OR IGNORE INTO studio_members (studio_id, user_id, role) SELECT studio_id, id, 'owner' FROM users")

export const getUserByEmail = db.prepare('SELECT users.id, users.studio_id, users.active_studio_id, users.email, users.display_name, users.password_hash, studios.name AS studio_name FROM users JOIN studios ON studios.id = users.studio_id WHERE users.email = ?')
export const getSession = db.prepare(`
  SELECT sessions.token_hash, sessions.csrf_token, sessions.expires_at,
    users.id AS user_id, users.email, users.display_name, sessions.studio_id,
    studios.name AS studio_name, studio_members.role
  FROM sessions JOIN users ON users.id = sessions.user_id
  JOIN studio_members ON studio_members.user_id = users.id AND studio_members.studio_id = sessions.studio_id
  JOIN studios ON studios.id = sessions.studio_id
  WHERE sessions.token_hash = ? AND sessions.expires_at > ?
`)
export const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, studio_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
export const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
export const deleteExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?')
const listRecords = db.prepare('SELECT section, data FROM records WHERE studio_id = ? ORDER BY updated_at DESC')
const getRecordStatement = db.prepare('SELECT data FROM records WHERE studio_id = ? AND section = ? AND id = ?')
const putRecordStatement = db.prepare(`
  INSERT INTO records (studio_id, section, id, data, updated_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (studio_id, section, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`)
const deleteRecordStatement = db.prepare('DELETE FROM records WHERE studio_id = ? AND section = ? AND id = ?')
const countRecords = db.prepare('SELECT COUNT(*) AS count FROM records WHERE studio_id = ?')

export function createStudioAndUser({ studioName, displayName, email, passwordHash }) {
  const studioId = randomUUID()
  const userId = randomUUID()
  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT INTO studios (id, name, created_at) VALUES (?, ?, ?)').run(studioId, studioName, now)
    db.prepare('INSERT INTO users (id, studio_id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, studioId, email, displayName, passwordHash, now)
    db.prepare('INSERT INTO studio_members (studio_id, user_id, role) VALUES (?, ?, ?)').run(studioId, userId, 'owner')
    db.exec('COMMIT')
    return { id: userId, studioId, email, displayName, studioName, role: 'owner' }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export const studiosForUser = db.prepare(`SELECT studios.id, studios.name, studio_members.role FROM studio_members JOIN studios ON studios.id = studio_members.studio_id WHERE studio_members.user_id = ? ORDER BY studios.created_at`)
export const memberFor = db.prepare('SELECT role FROM studio_members WHERE studio_id = ? AND user_id = ?')
export const listMembers = db.prepare('SELECT users.id, users.email, users.display_name AS displayName, studio_members.role FROM studio_members JOIN users ON users.id = studio_members.user_id WHERE studio_members.studio_id = ? ORDER BY users.display_name')
export const getStudioSettings = db.prepare('SELECT studios.name, studio_settings.* FROM studios LEFT JOIN studio_settings ON studio_settings.studio_id = studios.id WHERE studios.id = ?')
export const getInvite = db.prepare('SELECT * FROM studio_invites WHERE token_hash = ? AND expires_at > ?')
export const insertInvite = db.prepare('INSERT INTO studio_invites (token_hash, studio_id, email, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
export const deleteInvite = db.prepare('DELETE FROM studio_invites WHERE token_hash = ?')
export const listInvites = db.prepare('SELECT email, role, expires_at AS expiresAt FROM studio_invites WHERE studio_id = ? AND expires_at > ? ORDER BY created_at DESC')

export function createStudioForUser(userId, name) {
  const studioId = randomUUID()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT INTO studios (id, name, created_at) VALUES (?, ?, ?)').run(studioId, name, Date.now())
    db.prepare('INSERT INTO studio_members (studio_id, user_id, role) VALUES (?, ?, ?)').run(studioId, userId, 'owner')
    db.exec('COMMIT')
    return { id: studioId, name, role: 'owner' }
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

export function updateStudioSettings(studioId, values) {
  const fields = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from', 'business_email', 'business_address', 'phone', 'website', 'tax_id', 'currency', 'payment_terms', 'invoice_notes']
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('UPDATE studios SET name = ? WHERE id = ?').run(values.name, studioId)
    db.prepare(`INSERT INTO studio_settings (studio_id, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')}) ON CONFLICT(studio_id) DO UPDATE SET ${fields.map(field => `${field} = excluded.${field}`).join(', ')}`).run(studioId, ...fields.map(field => values[field]))
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

export function addMember(studioId, userId, role) {
  db.prepare('INSERT INTO studio_members (studio_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(studio_id, user_id) DO UPDATE SET role = excluded.role').run(studioId, userId, role)
}

export function createUserForInvite({ studioId, role, displayName, email, passwordHash }) {
  const userId = randomUUID()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT INTO users (id, studio_id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, studioId, email, displayName, passwordHash, Date.now())
    addMember(studioId, userId, role)
    db.exec('COMMIT')
    return { id: userId, studioId, role, email, displayName, studioName: db.prepare('SELECT name FROM studios WHERE id = ?').get(studioId).name }
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

export function removeMember(studioId, userId) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const role = memberFor.get(studioId, userId)?.role
    if (!role || role === 'owner') throw new Error('Owner access cannot be removed.')
    db.prepare('DELETE FROM studio_members WHERE studio_id = ? AND user_id = ?').run(studioId, userId)
    db.prepare('DELETE FROM sessions WHERE studio_id = ? AND user_id = ?').run(studioId, userId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}

export function workspaceFor(studioId) {
  const workspace = Object.fromEntries(sections.map(section => [section, []]))
  for (const row of listRecords.all(studioId)) workspace[row.section]?.push(JSON.parse(row.data))
  return workspace
}

export function recordFor(studioId, section, id) {
  const row = getRecordStatement.get(studioId, section, String(id))
  return row ? JSON.parse(row.data) : null
}

export function saveEmailAttachments(studioId, emailId, attachments) {
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM email_attachments WHERE studio_id = ? AND email_id = ?').run(studioId, String(emailId))
    const insert = db.prepare('INSERT INTO email_attachments (studio_id, email_id, position, filename, content) VALUES (?, ?, ?, ?, ?)')
    attachments.forEach((file, position) => insert.run(studioId, String(emailId), position, file.filename, Buffer.from(file.content, 'base64')))
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
export const getEmailAttachment = db.prepare('SELECT filename, content FROM email_attachments WHERE studio_id = ? AND email_id = ? AND position = ?')
export const listEmailAttachments = db.prepare('SELECT position, filename, content FROM email_attachments WHERE studio_id = ? AND email_id = ? ORDER BY position')

export function saveRecord(studioId, section, item, { allowLegacy = false } = {}) {
  if (!sections.includes(section) || !item || typeof item !== 'object' || Array.isArray(item) || !['string', 'number'].includes(typeof item.id) || String(item.id).length > 80) throw new Error('Invalid record')
  const record = section === 'Galleries' ? { ...item, count: db.prepare('SELECT COUNT(*) AS count FROM gallery_photos WHERE studio_id = ? AND gallery_id = ?').get(studioId, String(item.id)).count } : item
  const encoded = JSON.stringify(record)
  if (encoded.length > 64_000) throw new Error('Invalid record')
  if (!allowLegacy && projectSections.has(section)) {
    const project = item.projectId === undefined || item.projectId === null ? null : recordFor(studioId, 'Projects', item.projectId)
    if (!project && !(section === 'Email' && item.scope === 'global' && (!item.attachmentRefs || item.attachmentRefs.length === 0))) throw new Error('Choose a project for this record')
    if (section === 'Email' && Array.isArray(item.attachmentRefs) && item.attachmentRefs.some(ref => !['Invoices', 'Contracts'].includes(ref?.type) || String(recordFor(studioId, ref.type, ref.id)?.projectId) !== String(project?.id))) throw new Error('Attachments must belong to this project')
    if (section === 'Email' && item.galleryId && String(recordFor(studioId, 'Galleries', item.galleryId)?.projectId) !== String(project?.id)) throw new Error('Gallery must belong to this project')
  }
  if (section === 'Templates' && !['Email', 'Contract'].includes(item.type)) throw new Error('Invalid template')
  putRecordStatement.run(studioId, section, String(item.id), encoded, Date.now())
  return record
}

export function removeRecord(studioId, section, id) {
  return deleteRecordStatement.run(studioId, section, String(id)).changes > 0
}

export function importWorkspace(studioId, workspace) {
  if (countRecords.get(studioId).count > 0) throw new Error('This studio already has records')
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) throw new Error('Invalid workspace')
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const section of sections) {
      const rows = workspace[section] || []
      if (!Array.isArray(rows) || rows.length > 500) throw new Error('Invalid workspace')
      for (const row of rows) saveRecord(studioId, section, row, { allowLegacy: true })
    }
    migrateProjectAssociations(studioId)
    db.exec('COMMIT')
    return workspaceFor(studioId)
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function migrateProjectAssociations(studioId) {
  const workspace = workspaceFor(studioId)
  const projects = workspace.Projects
  const clients = workspace.Clients
  const projectByClient = name => {
    if (!name) return null
    const matches = projects.filter(project => project.client?.trim().toLowerCase() === String(name).trim().toLowerCase())
    return matches.length === 1 ? matches[0] : null
  }
  for (const section of ['Galleries', 'Invoices', 'Contracts']) {
    for (const item of workspace[section]) {
      if (item.projectId || item.scope === 'unassigned') continue
      const named = section === 'Galleries' ? projects.filter(project => project.name?.trim().toLowerCase() === item.title?.trim().toLowerCase()) : []
      const project = named.length === 1 ? named[0] : projectByClient(item.client)
      const updated = project ? { ...item, projectId: project.id, scope: 'project' } : { ...item, scope: 'unassigned' }
      putRecordStatement.run(studioId, section, String(item.id), JSON.stringify(updated), Date.now())
      item.projectId = updated.projectId; item.scope = updated.scope
    }
  }
  for (const item of workspace.Email) {
    if (item.projectId || item.scope) continue
    const refs = item.attachmentRefs || []
    const attachedProjects = refs.map(ref => workspace[ref.type]?.find(document => String(document.id) === String(ref.id))?.projectId)
    const uniqueAttachments = [...new Set(attachedProjects.map(String))]
    const client = clients.find(person => person.email?.trim().toLowerCase() === item.recipient?.trim().toLowerCase())
    const project = refs.length ? attachedProjects.every(Boolean) && uniqueAttachments.length === 1 ? projects.find(row => String(row.id) === uniqueAttachments[0]) : null : projectByClient(client?.name)
    const updated = project ? { ...item, projectId: project.id, scope: 'project' } : { ...item, scope: refs.length ? 'unassigned' : 'global' }
    putRecordStatement.run(studioId, 'Email', String(item.id), JSON.stringify(updated), Date.now())
  }
}

for (const studio of db.prepare('SELECT id FROM studios').all()) {
  migrateProjectAssociations(studio.id)
  for (const gallery of workspaceFor(studio.id).Galleries) {
    const count = db.prepare('SELECT COUNT(*) AS count FROM gallery_photos WHERE studio_id = ? AND gallery_id = ?').get(studio.id, String(gallery.id)).count
    if (gallery.count !== count) putRecordStatement.run(studio.id, 'Galleries', String(gallery.id), JSON.stringify({ ...gallery, count }), Date.now())
  }
}

export async function backupDatabase() {
  const directory = path.resolve(process.env.BACKUP_DIR || 'backups')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const stamp = new Date().toISOString().slice(0, 10)
  const destination = path.join(directory, `darkroom-${stamp}.sqlite`)
  await backup(db, destination)
  chmodSync(destination, 0o600)
  const keyPath = path.join(path.dirname(databasePath), 'studio-secrets.key')
  if (existsSync(keyPath)) { const keyBackup = path.join(directory, 'studio-secrets.key'); copyFileSync(keyPath, keyBackup); chmodSync(keyBackup, 0o600) }
  const oldFiles = readdirSync(directory).filter(name => /^darkroom-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort().slice(0, -14)
  for (const file of oldFiles) unlinkSync(path.join(directory, file))
  return destination
}
