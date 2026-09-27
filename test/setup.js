import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Each test file gets its own database, so server modules that open SQLite at import stay isolated.
const directory = mkdtempSync(path.join(tmpdir(), 'darkroom-test-'))
process.env.DB_PATH = path.join(directory, 'darkroom.sqlite')
process.env.BACKUP_DIR = path.join(directory, 'backups')
