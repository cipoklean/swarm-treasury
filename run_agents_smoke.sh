#!/usr/bin/env bash
# Boot the 4 Swarm Treasury agents against the live testnet (.env) for a smoke test.
# Each agent logs to logs/<agent>.log. Headless governor auto-approves (per fix).
set -u
cd "C:/Users/HomePC/Desktop/swarm-treasury" || exit 1
mkdir -p logs
# Load .env into this shell (keys stay local; never printed)
set -a; . ./.env; set +a
export PYTHONUNBUFFERED=1
run_agent() {
  local name="$1"; local script="$2"
  echo "[launcher] starting $name"
  nohup python -u "agents/$script" > "logs/$name.log" 2>&1 &
  echo "$!" > "logs/$name.pid"
}
run_agent yield_scout  yield_scout.py
run_agent risk_guard   risk_guard.py
run_agent governor     governor.py
run_agent executor     executor.py
echo "[launcher] all 4 agents started; tail logs/governor.log etc. Run './stop_agents_smoke.sh' to stop."
