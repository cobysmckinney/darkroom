import 'dotenv/config'
import { backupDatabase } from './database.js'

const path = await backupDatabase()
console.log(`Backup saved: ${path}`)
