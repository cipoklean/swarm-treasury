// Vercel serverless health endpoint (replaces server.js /health).
export default function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      status: 'ok',
      service: 'swarm-treasury-dashboard',
      time: new Date().toISOString(),
    });
  }
  res.status(405).json({ error: 'method not allowed' });
}
