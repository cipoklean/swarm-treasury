import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Dev-only control plane.
//
// The production static server (server.js) exposes GET/POST /control and
// GET /health. Vite's dev server doesn't, so the dashboard's Bot Control
// panel silently failed in dev (fetch('/control') hit the SPA fallback and
// returned HTML). This plugin re-implements those two endpoints in dev,
// sharing the SAME file/Redis backend as server.js so state is consistent.
// ---------------------------------------------------------------------------

const CONTROL_FILE = process.env.CONTROL_FILE || join(__dirname, '..', 'agent_control.json')
const CONTROL_KEY = 'swarm:control'

async function makeBackend() {
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis')
      const client = createClient({ url: process.env.REDIS_URL })
      client.on('error', () => {})
      await client.connect()
      console.log('[dev] control backend: redis')
      return {
        read: async () => {
          const raw = await client.get(CONTROL_KEY)
          return raw ? JSON.parse(raw) : { paused: false, stop: false }
        },
        write: async (s: any) => { await client.set(CONTROL_KEY, JSON.stringify(s)) },
      }
    } catch {
      console.log('[dev] REDIS_URL set but unavailable, using file backend')
    }
  }
  console.log('[dev] control backend: file (' + CONTROL_FILE + ')')
  return {
    read: async () => {
      try { return JSON.parse(await readFile(CONTROL_FILE, 'utf8')) }
      catch { return { paused: false, stop: false } }
    },
    write: async (s: any) => { await writeFile(CONTROL_FILE, JSON.stringify(s), 'utf8') },
  }
}

function controlPlane(): Plugin {
  let backend: Awaited<ReturnType<typeof makeBackend>> | null = null
  return {
    name: 'swarm-control-plane',
    async configureServer(server) {
      backend = await makeBackend()
      const send = (res: any, code: number, obj: any) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        if (url === '/health') {
          if (req.method === 'GET' || req.method === 'HEAD') {
            return send(res, 200, { status: 'ok', service: 'swarm-treasury-dashboard', time: new Date().toISOString() })
          }
          return send(res, 405, { error: 'method not allowed' })
        }

        if (url === '/control') {
          if (req.method === 'GET') {
            return backend!.read().then((s) => send(res, 200, s))
          }
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (d) => (body += d))
            req.on('end', async () => {
              try {
                const { action } = JSON.parse(body || '{}')
                const s = await backend!.read()
                if (action === 'pause') s.paused = true
                else if (action === 'resume' || action === 'start') { s.paused = false; s.stop = false; }
                else if (action === 'stop') s.stop = true
                else if (action === 'reset') { s.paused = false; s.stop = false }
                else return send(res, 400, { error: 'unknown action: ' + action })
                await backend!.write(s)
                send(res, 200, s)
              } catch (e: any) {
                send(res, 400, { error: String((e && e.message) || e) })
              }
            })
            return
          }
          return send(res, 405, { error: 'method not allowed' })
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), controlPlane()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
