# Deploying the Dashboard to Vercel

The dashboard deploys to Vercel as a **static Vite app + two serverless functions**.
This replaces the Render setup (`server.js`), which Vercel can't run because Vercel is
serverless (no long-lived Node server, no persistent filesystem).

## What works out of the box (zero config)

- ✅ The full dashboard UI
- ✅ **Live on-chain data** — block height, treasury balance, APY, MessageBus feed
  (these are client-side RPC calls from the browser; they work on any static host)
- ✅ Demo mode fallback if no contracts are at the configured addresses
- ✅ `/health` endpoint

## What needs Redis: the Bot Control buttons

The Pause / Stop / Resume / Reset buttons talk to `/control`, which stores state.
On Render that state lived in a file (`agent_control.json`). **Vercel has no persistent
filesystem**, so `/control` uses **Upstash Redis** instead. Without Redis, the dashboard
still displays fine — the control buttons just become inert (they return a default
RUNNING state and don't persist).

> The Python agents already support Redis (`REDIS_URL` in `agents/control_state.py`),
> so the dashboard and agents share the **same** `swarm:control` key and stay in sync.

---

## Step-by-step

### 1. Push the repo to GitHub
Vercel deploys from Git. Make sure your latest commits (including `dashboard/vercel.json`
and `dashboard/api/`) are pushed.

### 2. Import the project in Vercel
- Go to https://vercel.com/new → import your `swarm-treasury` repo.
- **Root Directory: `dashboard`** ← important. The dashboard lives in a subfolder.
- Framework preset: **Vite** (auto-detected).
- Build command: `npm run build` · Output directory: `dist` (auto-filled from `vercel.json`).

### 3. (Optional, for working control buttons) Add Upstash Redis
1. Create a free Redis at https://upstash.com (free tier is plenty).
2. In the Upstash console, copy the **REST** endpoint:
   - `UPSTASH_REDIS_REST_URL` → e.g. `https://xxxx-xxxx.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` → the REST token
3. In Vercel → Project → **Settings → Environment Variables**, add both (for Production + Preview).
4. Redeploy.

To make the **Python agents** obey the same control state, give them the **TCP** URL from
the same Upstash database (`.env`):
```
REDIS_URL=rediss://default:<password>@<host>:<port>
```
Both hit the same `swarm:control` key — dashboard and agents stay in sync.

### 4. Deploy
Click **Deploy**. Vercel runs `npm run build`, serves `dist/`, and mounts:
- `/control` → `api/control.js`
- `/health` → `api/health.js`
- everything else → the SPA (`index.html`)

---

## Environment variables (Vercel)

| Variable | Required | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | For control buttons | Upstash REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | For control buttons | Upstash REST token |
| `VITE_CHAIN_ID` | No | Chain to display (default `968` testnet) |
| `VITE_RPC_URL` | No | Override RPC (defaults to chainConfig) |
| `VITE_TREASURY_VAULT`, `VITE_GOVERNOR`, etc. | No | Override contract addresses |

The `VITE_*` vars are baked in at build time; the `UPSTASH_*` vars are read at runtime
by the serverless function.

## Verifying

- `https://<your-app>.vercel.app/` → dashboard loads
- `https://<your-app>.vercel.app/health` → `{"status":"ok",...}`
- `https://<your-app>.vercel.app/control` → `{"paused":false,"stop":false,"backend":"redis"}`
  (if `backend` is `"none"`, Redis isn't configured — buttons are inert)

## Notes

- **Render files are untouched** — `server.js` and `render.yaml` still work if you go back
  to Render or run locally with `npm start`.
- **Local dev** (`npm run dev`) uses the Vite control-plane plugin (file backend), so the
  buttons work locally without Redis.
- The bundle is ~980 kB (ethers + recharts). Fine to ship; if you want it leaner later,
  code-split with dynamic `import()`.
