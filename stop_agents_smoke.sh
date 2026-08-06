#!/usr/bin/env bash
# Stop the 4 smoke-test agents started by run_agents_smoke.sh
cd "C:/Users/HomePC/Desktop/swarm-treasury" || exit 1
for n in yield_scout risk_guard governor executor; do
  if [ -f "logs/$n.pid" ]; then
    pid=$(cat "logs/$n.pid")
    kill "$pid" 2>/dev/null && echo "stopped $n (pid $pid)"
    rm -f "logs/$n.pid"
  fi
done
