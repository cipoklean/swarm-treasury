// SPDX-License-Identifier: MIT
// Minimal static-file server for the Swarm Treasury dashboard.
// - Serves the Vite build output in ./dist
// - GET/HEAD /health  -> liveness (platform health checks)
// - GET  /control     -> current bot control state {paused, stop}
// - POST /control     -> {action:"start"|"pause"|"resume"|"stop"|"reset"} -> new state
//
// Control state backend (shared with the Python agents):
//   * File (default): repo-root agent_control.json. Works when server + agents
//     share a filesystem (local dev, or one Render service running both).
//   * Redis (optional): if REDIS_URL is set and the `redis` package is
//     installed, state lives in Redis (needed when server + agents are
//     separate services that don't share a filesystem, e.g. Render Web
//     Service + Background Worker).
// No hard dependencies for the default path — Redis is loaded lazily only
// when REDIS_URL is set.

import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// --- control state backend -------------------------------------------
const CONTROL_FILE = process.env.CONTROL_FILE || join(__dirname, '..', 'agent_control.json');
const CONTROL_KEY = 'swarm:control';
let redisClient = null;

if (process.env.REDIS_URL) {
  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', () => {});
    await redisClient.connect();
    console.log('Control state backend: redis');
  } catch {
    redisClient = null;
    console.log('REDIS_URL set but redis unavailable, falling back to file backend');
  }
} else {
  console.log('Control state backend: file (' + CONTROL_FILE + ')');
}

async function readControl() {
  if (redisClient) {
    const raw = await redisClient.get(CONTROL_KEY);
    if (raw) return JSON.parse(raw);
    return { paused: false, stop: false };
  }
  try {
    return JSON.parse(await readFile(CONTROL_FILE, 'utf8'));
  } catch {
    return { paused: false, stop: false };
  }
}

async function writeControl(state) {
  if (redisClient) {
    await redisClient.set(CONTROL_KEY, JSON.stringify(state));
    return;
  }
  await writeFile(CONTROL_FILE, JSON.stringify(state), 'utf8');
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function handleControl(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, await readControl());
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', async () => {
      try {
        const { action } = JSON.parse(body || '{}');
        const s = await readControl();
        if (action === 'pause') s.paused = true;
        else if (action === 'resume' || action === 'start') s.paused = false;
        else if (action === 'stop') s.stop = true;
        else if (action === 'reset') { s.paused = false; s.stop = false; }
        else return sendJson(res, 400, { error: 'unknown action: ' + action });
        await writeControl(s);
        sendJson(res, 200, s);
      } catch (e) {
        sendJson(res, 400, { error: String((e && e.message) || e) });
      }
    });
    return;
  }
  sendJson(res, 405, { error: 'method not allowed' });
}

// --- RPC proxy -----------------------------------------------------------
// JSON-RPC proxy to rpc.botchain.ai — lets the Vercel frontend call the
// public RPC through this Render backend (avoids browser CORS issues).
// Env: BOT_CHAIN_RPC_URL (default: https://rpc.botchain.ai)

const RPC_PROXY_URL = process.env.BOT_CHAIN_RPC_URL || 'https://rpc.botchain.ai';

function handleRpc(req, res) {
  // CORS: allow the Vercel frontend to call this cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'swarm-treasury-dashboard/1.0',
  };

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    if (!body) {
      return sendJson(res, 400, { error: 'empty request' });
    }

    const options = {
      hostname: new URL(RPC_PROXY_URL).hostname,
      port: new URL(RPC_PROXY_URL).port || 443,
      path: new URL(RPC_PROXY_URL).pathname + (new URL(RPC_PROXY_URL).search || ''),
      method: 'POST',
      headers,
      timeout: 15000,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => (data += chunk));
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode || 502, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    proxyReq.on('error', (err) => {
      sendJson(res, 502, { error: 'RPC proxy error', detail: err.message });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      sendJson(res, 504, { error: 'RPC proxy timeout' });
    });

    proxyReq.setTimeout(15000);

    try {
      proxyReq.write(body);
    } catch {
      return sendJson(res, 400, { error: 'invalid request' });
    }
    proxyReq.end();
  });
}

// --- health -----------------------------------------------------------
function sendHealth(req, res) {
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end();
    return;
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'swarm-treasury-dashboard',
      time: new Date().toISOString(),
    }));
    return;
  }
  sendJson(res, 405, { error: 'method not allowed' });
}

// --- static -----------------------------------------------------------
async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, safe === '/' ? '/index.html' : safe);

  try {
    let info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath);
    }
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    try {
      const html = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      res.end(req.method === 'HEAD' ? undefined : html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Dashboard build not found. Run `npm run build` first.');
    }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/health') return sendHealth(req, res);
  if (path === '/control') return handleControl(req, res);
  if (path === '/rpc') return handleRpc(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  sendJson(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Swarm Treasury dashboard listening on http://${HOST}:${PORT} (health: /health, control: /control)`);
});
