import 'dotenv/config'
import net from 'node:net'
import path from 'node:path'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { backupDatabase } from './database.js'
import { createApp } from './app.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requestedPort = Number(process.env.PORT || 4173)
const host = process.env.HOST || '127.0.0.1'
const port = process.env.PORT ? requestedPort : await findAvailablePort(requestedPort, host)
const isProduction = process.env.NODE_ENV === 'production'
const app = createApp({ host, isProduction })

if (!isProduction) {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: { port: port + 10000 } }, appType: 'spa' })
  app.use(vite.middlewares)
} else {
  app.use(express.static(path.join(root, 'dist')))
  app.get('/{*path}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))
}

const server = app.listen(port, host, () => {
  if (port !== requestedPort) console.log(`Port ${requestedPort} is occupied; Darkroom is using ${port}.`)
  console.log(`Darkroom ready at http://${host}:${port}`)
})
server.on('error', error => {
  console.error(`Darkroom could not start on ${host}:${port}: ${error.message}`)
  process.exitCode = 1
})

backupDatabase().catch(error => console.error('Initial backup failed:', error))
const backupInterval = setInterval(() => backupDatabase().catch(error => console.error('Scheduled backup failed:', error)), 24 * 60 * 60 * 1000)
backupInterval.unref()

async function findAvailablePort(start, bindHost) {
  for (let candidate = start; candidate < start + 50; candidate += 1) {
    const available = await new Promise((resolve, reject) => {
      const probe = net.createServer()
      probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error))
      probe.listen(candidate, bindHost, () => probe.close(() => resolve(true)))
    })
    if (available) return candidate
  }
  throw new Error(`No free port found between ${start} and ${start + 49}`)
}
