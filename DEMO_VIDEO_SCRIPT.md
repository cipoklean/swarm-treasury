# Swarm Treasury — 40-Second Demo Video Script
**Target:** X/Twitter thread video • **Tone:** Premium, punchy, "ship it" energy • **Aspect:** 16:9 (1920×1080)  
**Music:** Low synth drone → beat drop at 0:08 → steady pulse  
**Voiceover:** None — let the UI speak. Captions only (white, JetBrains Mono, bottom-center).

---

## SHOT LIST (40 seconds = ~120 frames @ 30fps)

| Time | Duration | Shot | Visual Details | Caption |
|------|----------|------|----------------|---------|
| 0:00–0:03 | 3s | **Cold open — Hero band** | Dashboard loads. Cyan left-edge glows. **$100,000** total value counts up (0 → 100k in 1.5s). Sparkline draws left→right. APY badge **12.0%** pulses green. | `SWARM TREASURY · BOT CHAIN TESTNET` |
| 0:03–0:07 | 4s | **Consensus Rail — IDLE → FLOWING** | Pipeline component: 4 nodes (Yield Scout → Risk Guard → Executor → Governor). Gray connectors. Top hairline **cyan pulse** starts. `● FLOWING` badge blinks ON. Each node counter ticks: 0→3, 0→2, 0→1, 0→1. | `ADVERSARIAL CONSENSUS IN 0.75s BLOCKS` |
| 0:07–0:11 | 4s | **Yield Scout proposes** | Live Message Feed: new row slides in **electric blue** — `PROPOSAL #42 • Invest 15,000 sUSD • Strategy 0x6206… • 12.3% APY`. GovernorPanel: card appears with **red countdown bar** (30s → 28s). | `YIELD SCOUT FINDS 12%+ APY` |
| 0:11–0:16 | 5s | **Risk Guard simulates & APPROVES** | Message Feed: **green row** slides in — `APPROVAL #42 • Slippage 0.12% • IL Risk 8% ✓`. Risk Guard node counter 2→3. Pipeline connector **cyan flow animation** races Scout→Guard. | `RISK GUARD VETOES SLIPPAGE >0.5%` |
| 0:16–0:20 | 4s | **Executor settles on-chain** | Message Feed: **amber row** — `EXECUTED #42 • 0xabc123…confirmed • Block 1,247,892`. Executor counter 1→2. Treasury Overview: **Deployed** bar grows 36%→51%, Available shrinks. Sparkline **kicks up**. | `EXECUTOR SETTLES IN <2 BLOCKS` |
| 0:20–0:24 | 4s | **Governor — large-move guard** | ControlPanel: wallet connected (0x51b0…4655). `⚠ Emergency Pause (chain)` button **red pulse**. GovernorPanel: **second proposal card** appears — `⚠ LARGE MOVE • 25% treasury • 30s countdown`. | `GOVERNOR HUMAN-IN-THE-LOOP >20%` |
| 0:24–0:28 | 4s | **Circuit breaker demo** | Rapid cuts: 3 veto messages stack in Feed (red, red, red). Vault **pauses** — ControlPanel status `STOPPED` + red dot. Banner: `CIRCUIT BREAKER TRIGGERED — 3 VETOES`. | `3 VETOES → AUTO-PAUSE VAULT` |
| 0:28–0:33 | 5s | **Wallet-gated Emergency Pause** | Click `⚠ Emergency Pause` → TxConfirmModal opens. **Gas estimate** shows `~42,000 gas`. Click **Confirm** → MetaMask popup (blur background). Tx **Pending → Confirmed** badge green. ControlPanel: `STOPPED` confirmed. | `ON-CHAIN EMERGENCY STOP · GAS PREVIEW` |
| 0:33–0:37 | 4s | **Activity Log — honest receipts** | ActivityLog table: 4 rows with tx hashes, amounts, gas, block #'s, ✓ CONFIRMED. Hover row → explorer link tooltip. | `EVERY MOVE AUDITABLE ON-CHAIN` |
| 0:37–0:40 | 3s | **End card** | Fade to dark. Centered wordmark: `SWARM<span class="cyan">://</span>TREASURY`. Subline: `The AI treasury that can say no.` Chips: `Risk Guard veto` `Circuit breaker` `20% cap` `Timelock + quorum`. Bottom: `Built for @BotChain · Testnet live` | `SWARM://TREASURY` `The AI treasury that can say no.` `github.com/cipoklean/swarm-treasury` |

---

## RECORDING CHECKLIST

### Before you hit record
- [ ] Dashboard running at `http://localhost:3000` (or deployed Vercel URL)
- [ ] Agents **running** (`bash demo/start.sh` in separate terminal)
- [ ] MetaMask connected as **Governor wallet** (0x51b0…4655)
- [ ] Browser: **1920×1080**, hide bookmarks bar, disable extensions
- [ ] Screen recorder: **OBS / Xbox Game Bar / Kap** @ 30fps, 16:9
- [ ] Clear cache / hard-refresh so demo mode data loads clean

### During recording
- **Mouse**: Smooth, deliberate movements. Pause 0.5s on each UI element before clicking.
- **No narration** — captions added in post.
- **If something lags**: wait, don't narrate "waiting…" — cut in post.
- **Capture 2–3 takes** of each shot; pick smoothest.

### Post-production (CapCut / DaVinci / Premiere / even iMovie)
1. **Trim to exactly 40s** — tight pacing wins on X.
2. **Captions**: White JetBrains Mono, 18pt, bottom-center, 40px margin. Fade in/out 0.15s.
3. **Color grade**: Slight contrast boost, cyan lift in shadows (matches dashboard).
4. **Audio**: Low synth drone (0:00–0:08) → subtle beat (0:08–0:38) → fade 0:38–0:40.
5. **Export**: H.264, 1920×1080, 30fps, 8–12 Mbps → **< 8 MB** for X upload.

---

## X THREAD TEMPLATE (paste after video upload)

```
1/ Swarm Treasury — the AI treasury that can say no. 🧵👇

[VIDEO: 40s demo]

2/ Problem: Protocols sit on billions idle. Single AI agent with treasury keys = one hallucination from drain.

Solution: A SWARM of narrow agents in adversarial consensus. No single agent moves funds alone.

3/ The loop (all on-chain, all <1s on BotChain):
🔵 Yield Scout — finds 12%+ APY, proposes
🟢 Risk Guard — simulates slippage/IL, APPROVES or VETOES
🟡 Executor — bundles, settles on-chain
🔴 Governor — human-in-the-loop >20%, emergency pause

4/ Trust enforced on-chain, not by hope:
✅ Risk Guard veto (dedicated "say no" agent)
✅ Circuit breaker — 3 vetoes = auto-pause vault
✅ 20% single-move cap
✅ Execution timelock + quorum
✅ Governor emergency pause (wallet-gated, gas-previewed)

5/ Why BotChain? This workload *cannot* work on Ethereum:
⚡ 0.75s blocks → real-time multi-agent consensus
💰 Near-zero fees → loops cost fractions of a cent
🛡️ Native MEV resistance → protects treasury capital
🔧 Full EVM → Solidity + Foundry, instant portability

6/ Live on BotChain testnet (chain 968):
✅ 5 contracts deployed (TreasuryVault, AgentRegistry, MessageBus, Governor, YieldStrategy)
✅ 4 Python agents running the full loop
✅ 88 passing tests + security hardening
✅ Real-time command-center dashboard

7/ Next: Real yield adapter (lending/LP on BotChain DEX), audit, mainnet.
Applying to BotChain ecosystem program — grant + flagship partnership.

Repo: github.com/cipoklean/swarm-treasury
Demo: [your Vercel URL]
Builder: @Cipoklean

#BotChain #DeFi #AIAgents #Web3
```

---

## QUICK SHOT REFERENCE (for editing)

| Shot # | Component | Key Visual Cue |
|--------|-----------|----------------|
| 1 | TreasuryOverview | $100k count-up, cyan left border, sparkline draw |
| 2 | Pipeline | 4 nodes, FLOWING badge, cyan hairline, counters tick |
| 3 | LiveMessageFeed + GovernorPanel | Blue PROPOSAL row slides in, red countdown bar |
| 4 | LiveMessageFeed + Pipeline | Green APPROVAL row, connector flow Scout→Guard |
| 5 | LiveMessageFeed + TreasuryOverview | Amber EXECUTED row, Deployed bar grows, sparkline kicks |
| 6 | ControlPanel + GovernorPanel | Wallet connected, red Emergency Pause pulse, 30s countdown |
| 7 | LiveMessageFeed + ControlPanel | 3 red VETO rows, STOPPED status, circuit breaker banner |
| 8 | TxConfirmModal + ControlPanel | Gas estimate, MetaMask, Pending→Confirmed, STOPPED |
| 9 | ActivityLog | Table rows with tx hashes, explorer links, ✓ CONFIRMED |
| 10 | End card | Wordmark, tagline, 4 chips, repo link |

---

## ALTERNATE 30-SECOND CUT (if X compresses hard)

Drop shots 6 & 7 (Governor + circuit breaker) — keep the core propose→vet→execute flow.  
End card at 0:30.

---

**File:** `DEMO_VIDEO_SCRIPT.md` — save, print, or keep open on second monitor while recording.