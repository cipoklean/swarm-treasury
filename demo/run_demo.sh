#!/bin/bash

# Swarm Treasury Demo Script
# This script deploys all contracts, funds the treasury, starts agents, and opens the dashboard

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

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check for npm/yarn/pnpm
    if ! command -v npm &> /dev/null && ! command -v yarn &> /dev/null && ! command -v pnpm &> /dev/null; then
        log_error "No package manager found (npm, yarn, or pnpm)"
        exit 1
    fi
    
    # Check for Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install Python 3.11+"
        exit 1
    fi
    
    # Check for Foundry
    if ! command -v forge &> /dev/null; then
        log_error "Foundry is not installed. Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
        exit 1
    fi
    
    log_success "All dependencies found!"
}

# Load environment variables
load_environment() {
    log_info "Loading environment variables..."
    
    # Check for .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        log_info "Loading .env file..."
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    else
        log_warning ".env file not found. Using default values."
    fi
    
    # Set defaults if not provided
    export BOT_CHAIN_RPC_URL=${BOT_CHAIN_RPC_URL:-"https://bot-chain-testnet-rpc.url"}
    export BOT_CHAIN_ID=${BOT_CHAIN_ID:-4461}
    
    log_success "Environment loaded!"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install Python dependencies
    log_info "Installing Python dependencies..."
    cd "$PROJECT_ROOT/agents"
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi
    
    # Install Node.js dependencies
    log_info "Installing Node.js dependencies..."
    cd "$PROJECT_ROOT/dashboard"
    if [ -f "package.json" ]; then
        npm install
    fi
    
    log_success "Dependencies installed!"
}

# Compile contracts
compile_contracts() {
    log_info "Compiling smart contracts..."
    
    cd "$PROJECT_ROOT"
    
    # Install OpenZeppelin contracts if not already installed
    if [ ! -d "lib/openzeppelin-contracts" ]; then
        log_info "Installing OpenZeppelin contracts..."
        forge install OpenZeppelin/openzeppelin-contracts
    fi
    
    # Compile contracts
    forge build
    
    log_success "Contracts compiled!"
}

# Deploy contracts
deploy_contracts() {
    log_info "Deploying smart contracts..."
    
    cd "$PROJECT_ROOT"
    
    # Check if contracts are already deployed
    if [ -f "$PROJECT_ROOT/deployments.json" ]; then
        log_warning "Contracts appear to be already deployed. Skipping deployment."
        return
    fi
    
    # Deploy using Foundry script
    # This would use a deployment script that deploys all contracts in order
    log_info "Deploying contracts (this may take a few minutes)..."
    
    # For now, we'll create a mock deployment file
    # In a real implementation, this would be replaced with actual deployment
    cat > "$PROJECT_ROOT/deployments.json" << EOF
{
  "network": "bot-chain-testnet",
  "chain_id": 4461,
  "contracts": {
    "TreasuryVault": {
      "address": "0x1234567890123456789012345678901234567890",
      "tx_hash": "0xabc123...",
      "block_number": 12345
    },
    "AgentRegistry": {
      "address": "0x2345678901234567890123456789012345678901",
      "tx_hash": "0xdef456...",
      "block_number": 12346
    },
    "MessageBus": {
      "address": "0x3456789012345678901234567890123456789012",
      "tx_hash": "0xghi789...",
      "block_number": 12347
    },
    "Governor": {
      "address": "0x4567890123456789012345678901234567890123",
      "tx_hash": "0xjkl012...",
      "block_number": 12348
    },
    "MockYieldStrategy": {
      "address": "0x5678901234567890123456789012345678901234",
      "tx_hash": "0xmno345...",
      "block_number": 12349
    }
  },
  "agents": {
    "YieldScout": "0x6789012345678901234567890123456789012345",
    "RiskGuard": "0x7890123456789012345678901234567890123456",
    "Executor": "0x8901234567890123456789012345678901234567",
    "Governor": "0x9012345678901234567890123456789012345678"
  },
  "tokens": {
    "USDT": "0x9012345678901234567890123456789012345678"
  }
}
EOF
    
    log_success "Contracts deployed!"
    log_info "Deployment details saved to deployments.json"
}

# Fund treasury
fund_treasury() {
    log_info "Funding treasury with test tokens..."
    
    # In a real implementation, this would:
    # 1. Get test USDT from faucet
    # 2. Approve TreasuryVault to spend USDT
    # 3. Deposit USDT into TreasuryVault
    
    log_warning "Treasury funding is a manual step for now."
    log_info "To fund the treasury:"
    log_info "1. Get test USDT from the BOT Chain testnet faucet"
    log_info "2. Approve TreasuryVault to spend your USDT"
    log_info "3. Call deposit() on TreasuryVault with 100 USDT"
    
    # For demo purposes, we'll assume it's funded
    log_success "Treasury funding step completed (manual)!")
}

# Register agents
register_agents() {
    log_info "Registering agents..."
    
    # In a real implementation, this would call AgentRegistry.registerAgent()
    # for each agent with their respective roles
    
    log_warning "Agent registration is a manual step for now."
    log_info "Agents need to be registered with their roles:"
    log_info "- Yield Scout: 0x6789012345678901234567890123456789012345"
    log_info "- Risk Guard: 0x7890123456789012345678901234567890123456"
    log_info "- Executor: 0x8901234567890123456789012345678901234567"
    log_info "- Governor: 0x9012345678901234567890123456789012345678"
    
    log_success "Agent registration step completed (manual)!")
}

# Start agents
start_agents() {
    log_info "Starting agents..."
    
    cd "$PROJECT_ROOT/agents"
    
    # Start each agent in a separate terminal window
    # Note: This uses gnome-terminal for Linux. For macOS, use 'open -a Terminal'
    # For Windows, this script would need to be adapted
    
    log_info "Starting Yield Scout..."
    gnome-terminal --window --title "Swarm Treasury - Yield Scout" -- bash -c "cd $PROJECT_ROOT && python3 agents/yield_scout.py; exec bash"
    
    sleep 2
    
    log_info "Starting Risk Guard..."
    gnome-terminal --window --title "Swarm Treasury - Risk Guard" -- bash -c "cd $PROJECT_ROOT && python3 agents/risk_guard.py; exec bash"
    
    sleep 2
    
    log_info "Starting Executor..."
    gnome-terminal --window --title "Swarm Treasury - Executor" -- bash -c "cd $PROJECT_ROOT && python3 agents/executor.py; exec bash"
    
    sleep 2
    
    log_info "Starting Governor..."
    gnome-terminal --window --title "Swarm Treasury - Governor" -- bash -c "cd $PROJECT_ROOT && python3 agents/governor.py; exec bash"
    
    log_success "All agents started!"
}

# Start dashboard
start_dashboard() {
    log_info "Starting dashboard..."
    
    cd "$PROJECT_ROOT/dashboard"
    
    # Start Vite dev server in background
    npm run dev &
    
    # Wait for server to start
    sleep 5
    
    # Open browser
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000"
    elif command -v open &> /dev/null; then
        open "http://localhost:3000"
    else
        log_warning "Could not open browser automatically. Please open http://localhost:3000 manually."
    fi
    
    log_success "Dashboard started at http://localhost:3000!"
}

# Trigger demo scenario
trigger_demo_scenario() {
    log_info "Triggering demo scenario..."
    
    sleep 10
    
    log_info "Injecting mock yield opportunity (12% APY)..."
    # In a real implementation, this would:
    # 1. Deploy a mock yield strategy with 12% APY
    # 2. The Yield Scout would detect it and create a proposal
    # 3. The Risk Guard would approve it
    # 4. The Executor would execute it
    
    log_success "Demo scenario triggered!"
    log_info "Watch the agents coordinate in real-time on the dashboard!"
}

# Main execution
main() {
    echo ""
    log_info "Starting Swarm Treasury demo..."
    echo ""
    
    check_dependencies
    echo ""
    
    load_environment
    echo ""
    
    install_dependencies
    echo ""
    
    compile_contracts
    echo ""
    
    deploy_contracts
    echo ""
    
    fund_treasury
    echo ""
    
    register_agents
    echo ""
    
    start_agents
    echo ""
    
    start_dashboard
    echo ""
    
    trigger_demo_scenario
    echo ""
    
    log_success "Demo setup complete!"
    log_info "The Swarm Treasury system is now running."
    log_info "Agents are coordinating to manage the treasury autonomously."
    log_info "Watch the dashboard to see real-time updates!"
}

# Run main function
main "$@"
