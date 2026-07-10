#!/bin/bash

# Swarm Treasury Demo Script
# Compiles contracts, starts the agents and the dashboard.
# NOTE: This script does NOT deploy contracts or fabricate addresses.
# Deploy once with:  forge script script/Deploy.s.sol --rpc-url $BOT_CHAIN_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
# (or point deployments.json at already-deployed addresses) before running this.

set -e

echo "=========================================="
echo "  SWARM TREASURY DEMO SCRIPT"
echo "=========================================="
echo ""

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    for cmd in node npm python3 forge; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is not installed. Please install it and retry."
            exit 1
        fi
    done
    log_success "All dependencies found!"
}

# Load environment variables
load_environment() {
    log_info "Loading environment variables..."
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    else
        log_warning ".env file not found. Using default values."
    fi
    export BOT_CHAIN_RPC_URL=${BOT_CHAIN_RPC_URL:-"https://bot-chain-testnet-rpc.url"}
    export BOT_CHAIN_ID=${BOT_CHAIN_ID:-968}
    log_success "Environment loaded! (chain_id=$BOT_CHAIN_ID)"
}

# Install dependencies
install_dependencies() {
    log_info "Installing Python dependencies..."
    (cd "$PROJECT_ROOT/agents" && [ -f requirements.txt ] && pip install -r requirements.txt)
    log_info "Installing dashboard dependencies..."
    (cd "$PROJECT_ROOT/dashboard" && [ -f package.json ] && npm install)
    log_success "Dependencies installed!"
}

# Compile contracts
compile_contracts() {
    log_info "Compiling smart contracts..."
    (cd "$PROJECT_ROOT" && forge build)
    log_success "Contracts compiled!"
}

# Verify deployment (do NOT fabricate addresses)
require_deployment() {
    if [ ! -f "$PROJECT_ROOT/deployments.json" ]; then
        log_error "deployments.json not found. Deploy the contracts first, e.g.:"
        log_error "  forge script script/Deploy.s.sol --rpc-url \$BOT_CHAIN_RPC_URL --private-key \$DEPLOYER_PRIVATE_KEY --broadcast"
        log_error "Then re-run this script."
        exit 1
    fi
    log_success "Found deployments.json"
}

# Start agents (cross-platform: background processes)
start_agents() {
    log_info "Starting agents in the background..."
    cd "$PROJECT_ROOT/agents"
    python3 yield_scout.py > /tmp/swarm_yield_scout.log 2>&1 &
    sleep 2
    python3 risk_guard.py  > /tmp/swarm_risk_guard.log 2>&1 &
    sleep 2
    python3 executor.py    > /tmp/swarm_executor.log 2>&1 &
    sleep 2
    python3 governor.py    > /tmp/swarm_governor.log 2>&1 &
    log_success "All agents started! Logs: /tmp/swarm_*.log"
    log_info "Stop them with: pkill -f 'agents/.*\.py'"
}

# Start dashboard
start_dashboard() {
    log_info "Starting dashboard (Vite dev server)..."
    cd "$PROJECT_ROOT/dashboard"
    npm run dev &
    sleep 5
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000"
    elif command -v open &> /dev/null; then
        open "http://localhost:3000"
    else
        log_warning "Could not open a browser. Please open http://localhost:3000 manually."
    fi
    log_success "Dashboard started at http://localhost:3000!"
}

main() {
    check_dependencies
    echo ""
    load_environment
    echo ""
    install_dependencies
    echo ""
    compile_contracts
    echo ""
    require_deployment
    echo ""
    start_agents
    echo ""
    start_dashboard
    echo ""
    log_success "Demo setup complete!"
    log_info "Agents are coordinating to manage the treasury autonomously."
    log_info "Watch the dashboard at http://localhost:3000 for real-time updates."
}

main "$@"
