# SPDX-License-Identifier: MIT
"""Shared control state for the Swarm Treasury agents.

Lets an external controller (the dashboard's /control endpoint, or a human
via the CLI) start / pause / stop the autonomous agents without killing the
process. The state lives in a single backend that BOTH the Python agents and
the Node dashboard server read/write:

  * File backend (default): a JSON file at CONTROL_FILE (repo-root
    agent_control.json). Works when the server and agents share a filesystem
    (local dev, or a single Render service running both). No dependencies.
  * Redis backend (optional): if REDIS_URL is set AND the `redis` package is
    installed, state is stored in Redis. Required when the server and agents
    run as separate services (e.g. Render Web Service + Background Worker)
    because they do not share a filesystem.

The agents poll this every loop iteration, so pause/stop takes effect within
one polling cycle.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Dict

try:
    import redis as _redis  # type: ignore
    _HAS_REDIS = True
except Exception:  # pragma: no cover - redis is optional
    _HAS_REDIS = False

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_FILE = os.path.join(_REPO_ROOT, "agent_control.json")
_REDIS_KEY = "swarm:control"


class ControlState:
    def __init__(self, redis_url: str | None = None, file_path: str | None = None):
        self.redis_url = redis_url or os.environ.get("REDIS_URL")
        self.file_path = file_path or os.environ.get("CONTROL_FILE") or DEFAULT_FILE
        self._lock = threading.Lock()
        self._redis = None
        if self.redis_url and _HAS_REDIS:
            try:
                self._redis = _redis.Redis.from_url(self.redis_url, socket_connect_timeout=3)
                self._redis.ping()
            except Exception:
                self._redis = None
        if not self._redis and not os.path.exists(self.file_path):
            self._write({"paused": False, "stop": False})

    # --- low-level read/write -------------------------------------------
    def _read(self) -> Dict[str, bool]:
        if self._redis is not None:
            raw = self._redis.get(_REDIS_KEY)
            if raw:
                return json.loads(raw)
            return {"paused": False, "stop": False}
        try:
            with open(self.file_path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            return {"paused": False, "stop": False}

    def _write(self, state: Dict[str, bool]) -> None:
        if self._redis is not None:
            self._redis.set(_REDIS_KEY, json.dumps(state))
            return
        with self._lock:
            with open(self.file_path, "w", encoding="utf-8") as fh:
                json.dump(state, fh)

    # --- public API -----------------------------------------------------
    def get_state(self) -> Dict[str, bool]:
        return self._read()

    def set_state(self, paused: bool | None = None, stop: bool | None = None) -> Dict[str, bool]:
        s = self._read()
        if paused is not None:
            s["paused"] = bool(paused)
        if stop is not None:
            s["stop"] = bool(stop)
        self._write(s)
        return s

    def pause(self) -> Dict[str, bool]:
        return self.set_state(paused=True)

    def resume(self) -> Dict[str, bool]:
        return self.set_state(paused=False)

    def stop(self) -> Dict[str, bool]:
        return self.set_state(stop=True)

    def clear(self) -> Dict[str, bool]:
        return self.set_state(paused=False, stop=False)

    def should_pause(self) -> bool:
        return bool(self._read().get("paused", False))

    def should_stop(self) -> bool:
        return bool(self._read().get("stop", False))

    @property
    def backend(self) -> str:
        return "redis" if self._redis is not None else "file"
