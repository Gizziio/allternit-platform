# Bot Payments & Wallet Primitives — Gap Analysis

> Version: 1.0  
> Scope: Allternit AI platform (`ai.allternit.com`) + backend wallet/settlement services  
> Status: Gap analysis / roadmap

## 1. Goal

Bots must be able to hold, receive, and spend value autonomously. This requires a wallet primitive that is as native to a bot as email and phone are today. The wallet must be secure, policy-controlled, and interoperable with both crypto rails and traditional payment flows.

This document analyses the current state, industry patterns, and the gaps that must close for Allternit bots to become first-class economic actors.

## 2. Current state

### 2.1 Wallet schema (implemented)

`AgentIdentityChannels.wallet` is already part of the `Agent` contract:

```ts
interface AgentWalletChannel {
  provider: 'etrid' | 'metamask' | 'coinbase_wallet' | 'rainbow' | 'phantom' | 'custom';
  address?: string;
  chainId?: string | number;
  keyVaultRef?: string;
  allowedMethods?: ('send' | 'receive' | 'swap' | 'stake' | 'invoice')[];
}
```

- `etrid` is reserved as the Allternit-native wallet.
- External providers are accepted as pass-through / user-owned wallets.
- `allowedMethods` is the policy surface for autonomous capability.

### 2.2 Provisioning (implemented)

`src/lib/agents/agent-identity-provisioning.ts` exposes:

- `provisionAgentWallet(agentId)` → `POST /api/v1/agents/:agent_id/identity/wallet`

Backend behaviour (per `AUTONOMOUS_BOT_PRIMITIVES.md`):

- Generates an Ed25519 key pair.
- Encrypts the private key with `token_crypto`.
- Stores it in `agent_identity_channels`.
- Returns the public address.

This gives every bot a **self-custodial identity key**, but it is currently only a signing/address primitive. It is not yet connected to a settlement layer.

### 2.3 Secrets & runtime env (implemented)

- `agent-secrets-resolver.ts` resolves vault-backed secrets at session start.
- `bot-runtime-env.ts` merges harness env, secrets, and connectors into `AgentContext`.
- Hard-ban category `payments` exists in `HardBanCategory`.

### 2.4 Connector ecosystem (partial)

`services/open-connector` includes payment-adjacent providers:

- Skyfire (agent payments)
- Plisio (crypto payments)
- Alchemy (node / wallet infra)
- Uniswap (DEX)
- Blocknative (MEV / tx monitoring)
- Razorpay (fiat)

These are available as generic connectors, but there is no bot-native payment orchestration layer on top of them.

### 2.5 Marketplace settlement (not implemented)

`CheckoutModal.tsx` and `useCapabilityMarketplace.ts` use a `NoopCharger` placeholder. There is no real settlement backend for capability purchases.

## 3. Industry patterns

### 3.1 Grok Bot / xAI

- Grok Bot is a packaged teammate that can run background tasks, but payments are not a public primitive yet.
- The relevant pattern is **named, persistent bots with owned cloud runtime** — the packaging model we already mirror.

### 3.2 Cursor

- Cursor Agent runs autonomously inside the editor.
- Cursor has not shipped native agent wallets; any payments go through the user's SaaS subscription.
- Lesson: agent autonomy is limited until the agent has its own budget.

### 3.3 Skyfire / Send AI / other agent-payment startups

- **Agent-owned wallets** funded by a master wallet.
- **Allow-lists** for recipient addresses and spend caps.
- **Streaming micropayments** for API usage and compute.
- **Settlement rails** across EVM chains and Solana.
- Common primitives:
  - `wallet_get_balance`
  - `wallet_send`
  - `wallet_create_invoice`
  - `wallet_sign_message`
  - `wallet_swap`

### 3.4 MCP / A2A wallet standards (emerging)

- Model Context Protocol (MCP) servers for wallets expose tools like `get_balance`, `send_transaction`, `sign_message`.
- A2A (Agent-to-Agent) payment protocols use cryptographic receipts and escrow.
- Standards are still fragmented, but the shape is converging on:
  1. A wallet address per agent.
  2. A policy layer (spend limits, allow-lists).
  3. A receipt / attestation layer for agent-to-agent settlement.

### 3.5 Crypto wallet SDKs

- **MetaMask SDK**, **Coinbase Wallet SDK**, **RainbowKit**, **Phantom** — user-owned wallets, not agent-owned.
- **Turnkey**, **Privy**, **Magic**, **Fireblocks** — custodial / MPC wallets that can be provisioned programmatically.
- **Ethers.js / Viem / Solana web3.js** — runtime libraries for transaction building.

## 4. Gaps

### 4.1 Etrid is a name, not a service

- `provider: 'etrid'` is in the schema and UI, but there is no `etrid` service in the repo.
- Missing:
  - Etrid daemon / service definition.
  - Chain support (EVM? Solana? Bitcoin? stablecoin rails?).
  - Key-derivation strategy (one key per bot vs. HD wallet per user).
  - Gas sponsorship / relayer model.
  - Recovery / rotation policy.

### 4.2 No payment policy engine

- `allowedMethods` is only an enum array.
- Missing:
  - Spend caps per method / per window.
  - Recipient allow-lists / denylists.
  - Require-approval thresholds.
  - Multi-signature / quorum for high-value sends.
  - Hard-ban `payments` is not enforced at the transaction layer yet.

### 4.3 No settlement backend

- `NoopCharger` means marketplace capabilities cannot be purchased.
- Missing:
  - Pricing engine (credits, crypto, fiat).
  - Invoice / receipt generation.
  - Escrow for agent-to-agent work.
  - Dispute / refund flow.

### 4.4 No runtime wallet tools

- The runtime has no built-in wallet tools.
- Missing:
  - `wallet_get_balance`
  - `wallet_send`
  - `wallet_create_invoice`
  - `wallet_sign_message`
  - `wallet_swap`
  - `wallet_stake`
  - `wallet_get_transaction_history`

### 4.5 No fiat bridge

- Razorpay connector exists but is not wired to bot wallets.
- Missing:
  - On-ramp / off-ramp for bot wallets.
  - Fiat-denominated spending limits.
  - KYC / compliance boundaries.

### 4.6 No cross-chain / multi-asset view

- `chainId` is a single field.
- Missing:
  - Multi-chain balances.
  - Token registry.
  - Swap / bridge routing.

### 4.7 Audit & observability

- Missing:
  - Immutable transaction log per bot.
  - Real-time alerts on outbound sends.
  - Spending dashboards in Bot Home.

## 5. Roadmap

### Phase A — Etrid wallet foundation (0–4 weeks)

1. Define Etrid service scope:
   - EVM-first (ERC-20 / ETH) plus Solana.
   - One wallet per bot, derived from a platform master key.
   - Ed25519 identity key reused for message signing; secp256k1 added for EVM transactions.
2. Implement backend service skeleton (`services/etrid` or `cmd/etrid`):
   - `POST /wallets` — create wallet for agent.
   - `GET /wallets/:agent_id` — read address + balances.
   - `POST /wallets/:agent_id/sign` — sign a message or tx.
   - `POST /wallets/:agent_id/send` — submit a transaction.
3. Update `agent-identity-provisioning.ts` to call Etrid instead of the generic wallet endpoint when `provider === 'etrid'`.
4. Store `keyVaultRef` and `address` in `agent_identity_channels`.

### Phase B — Policy engine (4–8 weeks)

1. Design `AgentWalletPolicy` schema:
   ```ts
   interface AgentWalletPolicy {
     dailySpendLimit?: string; // decimal string in native units or USD
     perTransactionLimit?: string;
     allowedRecipients?: string[];
     blockedRecipients?: string[];
     requireApprovalAbove?: string;
     allowedAssets?: string[];
     allowedChains?: (string | number)[];
   }
   ```
2. Enforce policy in Etrid before signing/submitting.
3. Wire `payments` hard-ban into runtime so a banned agent cannot invoke wallet tools.
4. Add policy UI in Bot Home Runtime tab and wizard Identity Channels step.

### Phase C — Runtime tools (8–12 weeks)

1. Add wallet tools to the agent runtime:
   - `wallet_get_balance`
   - `wallet_send`
   - `wallet_create_invoice`
   - `wallet_sign_message`
   - `wallet_get_history`
2. Implement MCP server wrapper so external agents can use an Allternit bot wallet via MCP.
3. Return tool results in `AgentContext` so the bot knows its balance before spending.

### Phase D — Settlement & marketplace (12–20 weeks)

1. Replace `NoopCharger` with real charger backed by Etrid.
2. Implement capability pricing in credits or stablecoins.
3. Implement invoice / receipt model for agent-to-agent services.
4. Add escrow for multi-step agent work.
5. Build payout flow for bot creators.

### Phase E — Fiat & compliance (20–30 weeks)

1. Integrate on-ramp provider (e.g., Stripe, Moonpay, Transak).
2. Add fiat-denominated spend caps.
3. Implement transaction reporting and export.
4. Add compliance hooks (sanctions screening, velocity checks).

## 6. Recommended primitives to add now

These are low-cost schema additions that unblock later work without building the full Etrid service:

1. **`AgentWalletChannel.policy`** — optional policy object (even if enforcement is Phase B).
2. **`AgentWalletChannel.createdAt` / `updatedAt`** — audit timestamps.
3. **`AgentWalletChannel.fundingSource`** — how the wallet is funded (master wallet, user deposit, on-ramp).
4. **`Agent.transactionLog`** — array of wallet transactions displayed in Bot Home.
5. **`AgentWalletChannel.multiChain`** — array of `{ chainId, address }` for multi-chain bots.

## 7. One-line principle

> A bot wallet must be as self-contained as a bot email: provisioned with the bot, scoped by policy, auditable, and usable by the runtime without human approval for allowed operations.

## 8. Open decisions

1. **Custody model**: self-custodial keys in platform vault vs. MPC vs. user-controlled signer.
2. **Primary chain**: EVM first, Solana first, or multi-chain from day one.
3. **Gas model**: user-funded, platform-sponsored, or paymaster relayer.
4. **Stablecoin default**: USDC, USDT, or platform credit token.
5. **Etrid relationship**: separate service, or a module inside `cmd/allternit-api`.
