"""
Lightweight HTTP keepalive server for Render deployment.

Each agent starts this in a background thread so the Render Web Service
stays alive (health checks hit /health every ~30s; free-tier services
spin down after 15 min of zero traffic — the health check is incoming
traffic that keeps them warm).

Run pattern:
    from keepalive import start_keepalive
    start_keepalive(port, agent_name)   # daemon thread, non-blocking

On Render the platform sets PORT; locally you can set it yourself or
the default (8000) is used. When multiple agents run on one machine,
set a different PORT per terminal to avoid bind conflicts.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional

logger = logging.getLogger("keepalive")


class _HealthHandler(BaseHTTPRequestHandler):
    # quiet: don't spam stdout with one line per health check
    def log_message(self, fmt: str, *args: object) -> None:  # pragma: no cover
        return

    def do_GET(self) -> None:
        if self.path == "/health":
            body = json.dumps({"status": "ok"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            body = json.dumps({"error": "not found"}).encode()
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


def start_keepalive(port: int, name: str = "agent") -> HTTPServer:
    """Start a /health server in a daemon thread. Non-blocking.

    Args:
        port: port to bind to (Render sets PORT; locally default 8000).
        name: agent name used in log line.
    """
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True,
                         name=f"keepalive-{name}")
    t.start()
    logger.info("keepalive %s -> :%d/health", name, port)
    return server
