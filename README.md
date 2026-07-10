# Swarm Treasury

> **Multi-Agent Autonomous Treasury Management on BOT Chain**

A fleet of specialized AI agents (Yield Scout, Risk Guard, Executor, Governor) that autonomously manage a treasury on BOT Chain, exploiting its 0.75s block finality for real-time multi-agent consensus.

![Swarm Treasury Dashboard](https://via.placeholder.com/800x400/0a0a0f/00d4ff?text=Swarm+Treasury+Dashboard)

## 🚀 Features

- **⚡ Sub-Second Finality**: Exploits BOT Chain's 0.75s blocks for real-time multi-agent consensus (impossible on Ethereum mainnet)
- **🤖 Multi-Agent System**: 4 specialized agents coordinate via on-chain events + lightweight message bus
- **🏦 Complete Demo**: Deploy contracts, fund treasury, watch agents rebalance live
- **📊 Visual Dashboard**: Bloomberg Terminal meets cyberpunk - shows agent messages, tx hashes, block times
- **🔒 Production-Ready**: Reentrancy guards, access control, input validation, no raw transfers

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWARM TREASURY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Yield Scout  │    │ Risk Guard   │    │  Executor    │      │
│  │              │    │              │    │              │      │
│  │• Monitors    │    │• Simulates   │    │• Bundles    │      │
│  │  yields      │    │  slippage/IL │    │  actions     │      │
│  │• Proposes    │    │• Approves/  │    │• Submits    │      │
│  │  rebalances  │    │  vetoes      │    │  transactions│      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                      │
│                    ┌────────▼────────┐                           │
│                    │  Message Bus     │                           │
│                    │  (On-chain events)│                           │
│                    └────────┬────────┘                           │
│                             │                                      │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐        │
│  │TreasuryVault │    │AgentRegistry │    │  Governor   │        │
│  │• Holds funds │    │• Role-based  │    │• Emergency  │        │
│  │• Multi-sig   │    │  access      │    │  pause      │        │
│  │• Executes    │    │  control     │    │• Parameters │        │
│  └──────────────┘    └──────────────┘    └──────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (React + Vite)                       │
├─────────────────────────────────────────────────────────────────┤
│  • AgentStatusPanel - 4 agent cards with live status              │
│  • LiveMessageFeed - Real-time scrolling feed of MessageBus events  │
│  • TreasuryMetrics - Animated balance, APY, sparkline chart        │
│  • TransactionLog - Recent txs with status badges                 │
│  • GovernorPanel - Pending approvals with APPROVE/VETO buttons     │
│  • BlockTimeTicker - Live block number, avg time, network status   │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
swarm-treasury/
├── contracts/                    # Smart contracts (Foundry)
│   ├── TreasuryVault.sol        # Core vault — holds funds, proposals, multi-sig
│   ├── AgentRegistry.sol        # Role-based agent registration
│   ├── MessageBus.sol           # On-chain event bus for agent coordination
│   ├── YieldStrategy.sol        # Abstract yield source + MockYieldStrategy
│   ├── Governor.sol             # Emergency pause, parameter governance
│   ├── MintableERC20.sol        # ERC20 with public mint() for demo
│   ├── ITreasury.sol            # Treasury interface
│   ├── IAgentRegistry.sol       # Agent registry interface
│   ├── IMessageBus.sol          # Message bus interface
│   ├── IYieldStrategy.sol       # Yield strategy interface
│   └── IGovernor.sol            # Governor interface
├── agents/                      # Off-chain agents (Python / asyncio)
│   ├── botchain_client.py      # Web3.py wrapper for BOT Chain
│   ├── config_loader.py         # Shared config + ABI loader
│   ├── yield_scout.py          # Scans strategies, creates proposals
│   ├── risk_guard.py           # Assesses risk, approves/vetoes
│   ├── executor.py             # Votes + executes approved proposals
│   ├── governor.py             # Votes on proposals, handles large moves
│   └── requirements.txt         # web3, plyer, python-dotenv
├── script/                      # Foundry deploy scripts
│   ├── Deploy.s.sol            # Full system deploy + wiring
│   ├── DeployVaultV2.s.sol     # Vault-only deploy (variant)
│   ├── DeployVaultV3.s.sol     # Vault-only deploy with fresh strategy
│   ├── RedeployVault.s.sol     # Re-deploy vault + strategy
│   ├── MintTokens.s.sol        # Deploy MintableERC20 + mint supply
│   ├── SetupAgentRoles.s.sol   # Grant agent roles on the vault
│   └── FundVault.s.sol         # Whitelist token, add strategy, deposit
├── test/                        # Foundry tests (88 tests, 100% pass)
│   ├── TreasuryVault.t.sol
│   ├── AgentRegistry.t.sol
│   ├── MessageBus.t.sol
│   ├── Governor.t.sol
│   └── YieldStrategy.t.sol
├── dashboard/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── index.tsx              # TreasuryMetrics, TransactionLog, GovernorPanel, BlockTimeTicker
│   │   │   ├── AgentStatusPanel.tsx   # 4 agent cards with live pulses
│   │   │   └── LiveMessageFeed.tsx    # Scrolling message bus feed
│   │   ├── hooks/useBlockchain.ts     # Web3 provider + mock data
│   │   ├── chainConfig.ts            # Deployed addresses per chain
│   │   ├── theme.ts                  # Shared design system
│   │   ├── App.tsx                    # Main layout
│   │   └── main.tsx                  # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── demo/
│   ├── start.sh                # Demo launcher (one command)
│   └── run_demo.sh             # Full deployment + agent launch
├── lib/                         # OZ v4 + upgradeable-v4 (manual)
├── config.json                 # Contract addresses + ABIs
├── foundry.toml                # Solidity compiler config
├── .env                        # Private keys (gitignored)
├── .env.example                # Environment template
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://python.org/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cipoklean/swarm-treasury.git
   cd swarm-treasury
   ```

2. **Install dependencies:**
   ```bash
   # Install Python dependencies
   pip install -r agents/requirements.txt
   
   # Install Node.js dependencies
   cd dashboard && npm install && cd ..
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your 5 private keys (see .env.example for format)
   ```

4. **Compile & test:**
   ```bash
   forge build
   forge test  # 88 tests, 0 failures
   ```

### Running the Demo

```bash
# One command to start everything:
bash demo/start.sh
```

That script:
1. Verifies RPC connection
2. Shows current on-chain state (proposals, messages, agent balances)
3. Launches all 4 agent processes in background
4. Press Ctrl+C to stop all agents

## 🤖 Agent Coordination Flow

```
1. YIELD SCOUT
   ├─ Polls YieldStrategy contracts every 3 blocks
   ├─ If APY > 10%, creates proposal on MessageBus
   └─ Posts: "PROPOSAL: Invest X in Strategy Y for Z% APY"

2. RISK GUARD
   ├─ Listens for Yield Scout proposals
   ├─ Simulates slippage using current pool state
   ├─ If slippage < 0.5% AND APY confirmed: approves
   ├─ If risk too high: vetoes with reason
   └─ Posts: "APPROVAL" or "VETO: [reason]"

3. EXECUTOR
   ├─ Listens for dual approval (Yield Scout + Risk Guard)
   ├─ Bundles approved actions
   ├─ Submits transaction to TreasuryVault
   ├─ Confirms within 2 blocks or retries once
   └─ Posts: "EXECUTED: [tx_hash]"

4. GOVERNOR
   ├─ Monitors for large moves (>20% treasury)
   ├─ Shows CLI prompt: "Approve [Y/n]" with 30s timeout
   ├─ Auto-vetoes if no response within timeout
   └─ Can trigger emergency pause of the treasury vault
```

## 🔧 Smart Contracts

### TreasuryVault.sol
- **Purpose:** Holds sUSD funds, executes multi-sig transactions
- **Security:** Reentrancy guard, pausable, ownable, input validation
- **Features:**
  - Requires Yield Scout proposal + Risk Guard approval before execution
  - Withdrawal timelock of 2 blocks minimum
  - Asset whitelisting with limits
  - Strategy management (deposit, withdraw, harvest)

### AgentRegistry.sol
- **Purpose:** Registers agent addresses with roles
- **Security:** Role-based access control using OpenZeppelin AccessControl
- **Features:**
  - Only GOVERNOR role can add/remove agents
  - No agent can hold more than one role
  - Emits events on every role change

### MessageBus.sol
- **Purpose:** On-chain event log for agent coordination
- **Features:**
  - Agents post structured messages (proposalId, agentRole, action, timestamp, data)
  - Messages indexed and queryable by proposalId
  - Message expiry after 10 blocks

### YieldStrategy.sol
- **Purpose:** Pluggable interface for yield sources
- **Features:**
  - Abstract base with: getAPY(), deposit(), withdraw(), getBalance()
  - Mock implementation simulates 12% APY for demo
  - Fixed-point arithmetic (no floating point)
  - Slippage tolerance check built in

### Governor.sol
- **Purpose:** Emergency pause and parameter updates
- **Features:**
  - Emergency pause of the treasury vault and itself
  - Parameter updates with 24-block timelock
  - Large move threshold: >20% of treasury requires Governor signature
  - Detailed audit log events

## 🛡️ Security Features

### All Contracts Include:
- ✅ Reentrancy guards on all external calls
- ✅ Integer overflow protection (Solidity 0.8+)
- ✅ Access control on every state-changing function
- ✅ Front-running protection on proposals
- ✅ No tx.origin usage
- ✅ No block.timestamp for critical logic (uses block.number)
- ✅ All return values checked
- ✅ Events emitted for every state change
- ✅ Constructor input validation
- ✅ No selfdestruct

### Additional Protections:
- **TreasuryVault:** No raw .transfer() or .send() — uses .call() with return value checks
- **AgentRegistry:** Only GOVERNOR role can add/remove agents
- **MessageBus:** No sensitive data on-chain — only hashes + action types
- **YieldStrategy:** All math uses fixed-point arithmetic
- **Governor:** Timelocked parameter changes (24 block delay)

## 📊 Dashboard Features

### Visual Design
- **Theme:** Dark navy (#06080d) with animated radial orbs and glass-morphism cards
- **Colors:** Blue (#58a6ff), Cyan (#39d2c0), Green (#3fb950), Amber (#d29922), Red (#f85149), Purple (#bc8cff)
- **Typography:** Inter for UI, JetBrains Mono for data/addresses

### Components
1. **AgentStatusPanel** — 4 agent cards with role-colored top border, pulsing ONLINE dot, live "last action" timestamps

2. **LiveMessageFeed** — Scrolling feed of MessageBus events, color-coded by agent role, animated slide-in, "LIVE" badge on newest

3. **TreasuryMetrics** — Large monospace numbers (current + projected balance), APY badge with gradient, area chart sparkline

4. **TransactionLog** — Table with monospace tx hashes, status badges (CONFIRMED/PENDING/FAILED)

5. **GovernorPanel** — Pending proposals with countdown progress bar, strategy/amount details

6. **BlockTimeTicker** — Top bar with network name, block number, block time

## 🎯 Demo Script

Run `bash demo/start.sh` — it:

1. Checks RPC connectivity
2. Shows live on-chain state (proposals, messages, agent sUSD balances)
3. Launches Yield Scout, Risk Guard, Executor, and Governor simultaneously
4. Agents begin scanning strategies, creating proposals, voting, and executing within seconds
5. Press Ctrl+C to stop all agents cleanly

Open the dashboard in a second terminal:

```bash
cd dashboard && npm run dev
```

Then visit `http://localhost:3000` to see:
- Agent status cards with live pulses
- Message bus feed updating in real-time
- Treasury balance chart with APY projection
- Transaction log with block numbers

## 📝 Development

### Adding New Strategies

1. **Implement IYieldStrategy interface:**
   ```solidity
   contract MyStrategy is IYieldStrategy {
       function getAPY() external view override returns (uint256) {
           return 1500; // 15% APY
       }
       
       function deposit(uint256 amount) external override returns (bool) {
           // Implementation
       }
       
       // ... other required functions
   }
   ```

2. **Register with TreasuryVault:**
   ```javascript
   // In your deployment script
   await treasuryVault.addStrategy(
       myStrategyAddress,
       susdAddress,
       maxAllocation,
       minReturnBps,
       maxSlippageBps
   );
   ```

### Extending Agents

Each agent follows the same pattern:
1. Initialize with private key and address
2. Load contract references
3. Implement main loop with polling
4. Handle specific agent logic
5. Post messages to MessageBus

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [BOT Chain](https://botchain.io) - For the fast, efficient blockchain
- [OpenZeppelin](https://openzeppelin.com) - For secure contract patterns
- [Foundry](https://book.getfoundry.sh) - For excellent Solidity tooling
- [Vite](https://vitejs.dev) - For fast frontend development
- [Framer Motion](https://framer.com/motion) - For beautiful animations

---

**Built with ❤️ for the BOT Chain ecosystem**

*Swarm Treasury - Where AI meets DeFi on BOT Chain*
