#!/bin/bash
# Swarm Treasury Demo Launcher
# Run this from the project root:  bash demo/start.sh

set -e
cd "$(dirname "$0")/.."

# Load env
source .env
export PATH="$HOME/.foundry/bin:$PATH"

echo "============================================"
echo "  SWARM TREASURY — Multi-Agent Demo"
echo "  Chain: $BOT_CHAIN_ID  |  RPC: $BOT_CHAIN_RPC_URL"
echo "============================================"
echo ""

# Verify RPC
echo "[1/4] Checking RPC..."
if ! cast block-number --rpc-url "$BOT_CHAIN_RPC_URL" > /dev/null 2>&1; then
    echo "ERROR: Cannot reach $BOT_CHAIN_RPC_URL"
    exit 1
fi
echo "  OK: block $(cast block-number --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1)"

# Verify contracts
echo "[2/4] Verifying contracts..."
VAULT_PROPS=$(cast call 0xDE3b01A9f936170e09089CB15A187CaE3442559c "proposalCount()(uint256)" --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1)
BUS_MSGS=$(cast call 0xA9e5FF4F6284c22dD98bac50bEd86A2E3ED5d43D "messageCount()(uint256)" --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1)
echo "  TreasuryVault: 0xDE3b01... ($VAULT_PROPS proposals)"
echo "  MessageBus:    0xA9e5FF... ($BUS_MSGS messages)"

# Check agent balances
echo "[3/4] Agent balances:"
echo "  Yield Scout: $(cast balance 0x9888825Acb1C2a2874728a850C2cD930f8d4a7fD --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1 | awk '{printf "%.2f BOT\n", $1/1e18}')"
echo "  Risk Guard:  $(cast balance 0xA27E03FF51A18755CeA47b08207f1A0443793c11 --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1 | awk '{printf "%.2f BOT\n", $1/1e18}')"
echo "  Executor:    $(cast balance 0x5bF3fCD659C23d3C558b44B9f92A02d58025D0ae --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1 | awk '{printf "%.2f BOT\n", $1/1e18}')"
echo "  Governor:    $(cast balance 0x7aA3155487E3db1d4811Eab11A52BC764e7C7fe0 --rpc-url "$BOT_CHAIN_RPC_URL" 2>/dev/null | tail -1 | awk '{printf "%.2f BOT\n", $1/1e18}')"

# Launch agents
echo "[4/4] Launching all 4 agents..."
echo ""
echo "  Agents running. Press Ctrl+C to stop."
echo "  Monitor: cast call 0xDE3b01... 'proposalCount()(uint256)' --rpc-url $BOT_CHAIN_RPC_URL"
echo "============================================"

# Launch in background so one Ctrl+C kills all
trap 'kill 0; exit' INT TERM

python -u agents/yield_scout.py &
python -u agents/risk_guard.py &
python -u agents/executor.py &
python -u agents/governor.py &

wait
