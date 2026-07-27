// Vercel serverless bot-control endpoint (replaces server.js /control).
//
// Vercel is serverless — there is no persistent filesystem, so the file
// backend used by server.js / control_state.py cannot work here. Instead this
// uses Upstash Redis (HTTP-based, serverless-friendly) as the shared control
// state. The Python agents read/write the SAME key via REDIS_URL, so the
// dashboard and agents stay in sync across services.
//
// If Upstash isn't configured, the endpoint degrades gracefully: it returns a
// default RUNNING state and POSTs are inert. The dashboard still displays
// (live on-chain data + demo mode); only the control buttons are inactive.
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL    e.g. https://xxxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN  the REST token from the Upstash console

import { Redis } from '@upstash/redis';

const KEY = 'swarm:control'; // must match agents/control_state.py

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

async function read() {
  if (!redis) return { paused: false, stop: false };
  const s = await redis.get(KEY);
  // Upstash auto-parses JSON; tolerate a raw string too.
  if (!s) return { paused: false, stop: false };
  return typeof s === 'string' ? JSON.parse(s) : s;
}

async function write(state) {
  if (redis) await redis.set(KEY, state);
}

export default async function handler(req, res) {
  const backend = redis ? 'redis' : 'none';

  if (req.method === 'GET') {
    const s = await read();
    return res.status(200).json({ ...s, backend });
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};
    const s = await read();
    if (action === 'pause') s.paused = true;
    else if (action === 'resume' || action === 'start') { s.paused = false; s.stop = false; }
    else if (action === 'stop') s.stop = true;
    else if (action === 'reset') {
      s.paused = false;
      s.stop = false;
    } else {
      return res.status(400).json({ error: 'unknown action: ' + action });
    }
    await write(s);
    return res.status(200).json({ ...s, backend });
  }

  res.status(405).json({ error: 'method not allowed' });
}
