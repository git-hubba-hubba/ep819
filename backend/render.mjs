import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createApp } from './server.mjs'

const frontend = new URL('../frontend/amethyst-ep/dist/', import.meta.url)
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', woff2: 'font/woff2' }

export async function createProductionApp(options) {
  // Fail the deployment before opening the database if the frontend wasn't built.
  await access(new URL('index.html', frontend))
  if (!options.databasePath) throw new Error('DATABASE_PATH is required for persistent storage.')
  if (!options.origin || new URL(options.origin).protocol !== 'https:') throw new Error('APP_ORIGIN or RENDER_EXTERNAL_URL must be an HTTPS origin.')
  const server = await createApp({ ...options, origin: new URL(options.origin).origin, secureCookies: true })
  const apiHandler = server.listeners('request')[0]
  server.removeListener('request', apiHandler)
  server.on('request', async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost')
      if (pathname === '/api' || pathname.startsWith('/api/')) return apiHandler(req, res)
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end()
      }
      if (pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }))
      }
      const file = pathname === '/' ? 'index.html' : pathname.slice(1)
      // Only build output is public. Never expose source, credentials, or SQLite files.
      if (!['index.html', 'favicon.svg', 'icons.svg'].includes(file) && !/^assets\/[a-zA-Z0-9_.-]+$/.test(file)) {
        res.writeHead(404); return res.end('Not found')
      }
      const content = await readFile(new URL(file, frontend))
      res.writeHead(200, {
        'Content-Type': types[file.split('.').pop()] || 'application/octet-stream',
        'Content-Length': content.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      res.end(req.method === 'HEAD' ? undefined : content)
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500)
      res.end(error.code === 'ENOENT' ? 'Not found' : 'Unable to serve request')
    }
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createProductionApp({
    databasePath: process.env.DATABASE_PATH,
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    adminName: process.env.ADMIN_NAME,
    origin: process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL,
  })
  const port = Number(process.env.PORT || 3001)
  server.listen(port, '0.0.0.0', () => console.log(`AmethystPlus production server listening on port ${port}`))
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      server.close(() => process.exit(0))
      setTimeout(() => process.exit(1), 10000).unref()
    })
  }
}
