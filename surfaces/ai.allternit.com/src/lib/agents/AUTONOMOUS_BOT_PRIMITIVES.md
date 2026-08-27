# Autonomous Bot Primitives — Gap Analysis & Architecture

> Version: 1.0  
> Scope: Allternit AI platform (`ai.allternit.com`) + adjacent backend services  
> Status: Production implementation

## 1. Goal

Bots must be able to work autonomously across surfaces and outside the platform. That means a bot needs:

1. **A clear creation path** — bot-first wizard in Agent Hub.
2. **Connectors & integrations** — OAuth/API-key authenticated access to external systems.
3. **Contained secrets** — keys and credentials scoped to the bot, not the user, and usable by the runtime.
4. **Native messaging** — send/receive messages across cloud orchestration and cross-surface sessions.
5. **Owned identity channels** — its own email, phone, and payment/wallet identity.

## 2. Current state

### 2.1 Bot creation & hub

- Creation happens through an 8-step wizard (`CreateAgentForm`) that supports both agent and bot-first modes.
- **Bot-first mode** is entered from the **Bots** filter in Agent Studio; it exposes bot identity up front (`IdentityStep`).
- Bot mode collects: handle (`agent.name`), `displayName`, `tagline`, `welcomeMessage`, `starterPrompts`, `accentColor`, `botCategory`, and `groupChatEnabled` (default `true`).
- `validateBotProfile()` is wired into `agent-creation-checklist.ts`.
- `ReviewStep` shows bot profile, connectors, secrets, identity channels, and messaging config.
- `EditAgentForm` can edit bot status and profile.
- Duplicating a bot preserves `isBot`/`botProfile`.
- A dedicated **Bot Home** view (`src/views/bots/BotHomeView.tsx`) is registered as the `bot-home` view type. Selecting a bot opens its home instead of immediately launching a chat, with tabs for Sessions, Artifacts, Runtime, and Routines.

### 2.2 Connectors & secrets

- **Owned-connector standard** (`src/lib/design/owned-connector.ts`) supports OAuth2, device flow, and API-key auth for 1,000+ providers via the open-connector sidecar.
- **Agent harness** supports BYOK API keys (`anthropic`, `openai`, `google`) and arbitrary subprocess `env` vars.
- **Mini-app secrets** use the desktop broker (`window.allternit.miniApps.setSecret`) and are kept out of the renderer.
- **Cloud credentials** (`cloud-credentials.ts`) are sealed server-side.
- **Agent-scoped connectors & secrets** are now declared via `connectorBindings` and `secretRefs` on `Agent` / `CreateAgentInput`.
- The wizard's **ConnectorsStep** lists real installed connectors from `useConnectors()` and quick-pick integrations; values are never stored in the agent record.
- **Production:** `agent-secrets-resolver.ts` resolves `secretRefs` at session start. Backend `POST /api/v1/agents/:agent_id/secrets/:key` seals values with `token_crypto::seal` into the `agent_secrets` table, and `POST /api/v1/agents/:agent_id/secrets/resolve` returns decrypted values via `token_crypto::open`.
- **Production:** `agent-connectors-resolver.ts` calls `POST /api/v1/agents/:agent_id/connectors/resolve`, which reads from `connector_connections` and falls back to `allternit_vault_credentials`.
- **Production:** `src/lib/bots/bot-runtime-env.ts` merges harness env vars (BYOK, cloud, subprocess), resolved secrets, and resolved connectors into a single `runtimeEnv` map that is passed to the backend in `AgentContext` on every agent message.
- **Production:** `AgentContextStrip` (`src/components/agents/context-strip/AgentContextStrip.tsx`) renders above bot sessions with a **Runtime** drawer that shows resolved env vars, connector bindings, secret refs, and missing required keys. It reads the same `connectorBindings`, `secretRefs`, `resolvedSecrets`, `resolvedConnectors`, and `missingSecrets` that the runtime uses.

### 2.3 Messaging

- `AgentMailMessage` / `AgentMailThread` types exist and the store has hooks.
- `sendAgentMail` in `agent.service.ts` serializes `body`, `toAgentId`, `subject`, and `priority`.
- Backend `MailMessage` stores `to_agent`, `subject`, and `priority`.
- **Photon** backend endpoints are implemented in `cmd/allternit-api/src/photon_routes.rs` and persist to SQLite (`agent_photon_inbox`):
  - `POST /api/v1/photon/agents/:agent_id/inbox`
  - `GET /api/v1/photon/agents/:agent_id/inbox`
  - `POST /api/v1/photon/sessions/:session_id/bridge`
- The wizard's **Identity Channels** step includes Photon orchestration and cross-surface toggles.
- **Telephony** UI supports Vapi/Twilio/Telnyx providers; provisioning requires the operator to configure `ALLTERNIT_BOT_PHONE_POOL`.

### 2.4 Identity channels

- Agents have `id`, `name` (system handle), `BotProfile.displayName`.
- `AgentIdentityChannels` is now part of `Agent` / `CreateAgentInput`:
  - `email` — CommRails / Google Workspace / Microsoft 365 / custom.
  - `phone` — Vapi / Twilio / Telnyx.
  - `wallet` — Etrid native or external wallet providers.
- The wizard's **Identity Channels** step exposes UI for all three channels plus messaging toggles.
- **Production provisioning** in `src/lib/agents/agent-identity-provisioning.ts` calls backend `POST /api/v1/agents/:agent_id/identity/{email,phone,wallet}`:
  - **Email** provisions an address under `ALLTERNIT_BOT_EMAIL_DOMAIN`; returns 501/503 if not configured, letting the user enter a value manually.
  - **Phone** provisions a number from `ALLTERNIT_BOT_PHONE_POOL`; returns 501/503 if not configured, letting the user enter a value manually.
  - **Wallet** is always real: generates an Ed25519 key pair, stores the encrypted private key in `agent_identity_channels`, and returns the public address.
- Hard-ban categories include `email_send` and `external_communication`, enforced by the runtime according to channel capabilities.

### 2.5 VM Operator (virtual computer)

- `AgentVMOperatorConfig` is part of `Agent` / `CreateAgentInput`.
- Lets a bot run tasks inside a sandboxed virtual computer:
  - `provider` — `opensandbox`, `docker`, `kubernetes`, `local`, or `custom`.
  - `image` — sandbox environment image (e.g. `opensandbox/desktop:v1.0.0`).
  - `allowedActions` — `command`, `browser`, `file`, `desktop`, `code`.
  - `networkPolicy` — `isolated`, `restricted`, `open`.
  - `persistence` — `ephemeral`, `session`, `persistent`.
  - `resources`, `timeoutMinutes`, `vncEnabled`, `autoStart`.
- UI surfaces:
  - **VM Operator step** in the bot creation/edit wizard.
  - **Runtime tab** in Bot Home shows VM status and config.
  - **BotRuntimeConfigModal** has a **Computer** section to edit VM settings.
- Runtime injection via `bot-runtime-env.ts`:
  - `ALLTERNIT_VM_OPERATOR_ENABLED`
  - `ALLTERNIT_VM_PROVIDER`, `ALLTERNIT_VM_IMAGE`
  - `ALLTERNIT_VM_ALLOWED_ACTIONS`, `ALLTERNIT_VM_NETWORK_POLICY`, `ALLTERNIT_VM_PERSISTENCE`
  - `ALLTERNIT_VM_TIMEOUT_MINUTES`, `ALLTERNIT_VM_VNC_ENABLED`, `ALLTERNIT_VM_AUTO_START`
  - `ALLTERNIT_VM_CPU`, `ALLTERNIT_VM_MEMORY`, `ALLTERNIT_VM_DISK`
- Integration point in `src/lib/bots/vm-operator.ts`:
  - Thin wrapper around sandbox lifecycle API (`createSandbox`, `runCommand`, `runBrowserTask`, `destroySandbox`, `healthCheck`).
  - Returns a clear "not configured" result when `ALLTERNIT_SANDBOX_URL` is not set.
  - Designed for OpenSandbox but provider-agnostic.

### 2.5 Payments & wallets

- **Etrid** is reserved as the Allternit-native agent wallet provider in the schema. Wallet provisioning is production-ready for key generation and sealed storage; full Etrid settlement service is still in development.
- Existing primitives:
  - `cmd/agent-daemon` mints an Ed25519 runtime identity key.
  - `cmd/allternit-api` has `token_crypto.rs` (AES-256-GCM seal/unseal), `allternit_vault.rs`, `external_keys_routes.rs` (BYO KMS), and cloud-credentials sealing.
  - `services/open-connector` has Skyfire, Plisio, Alchemy, Uniswap, Blocknative, Razorpay providers.
  - Marketplace uses a `NoopCharger` placeholder.
- **Gap:** full Etrid settlement service, agent-to-agent payment protocol, and EVM/ERC interaction layer are not yet implemented.

## 3. Proposed architecture

### 3.1 Bot-first creation wizard

Implemented in **Agent Studio** (no separate Bots hub tab):

- The studio header has an **All / Bots / Agents** filter and a context-aware **Create Bot / Create Agent** button.
- Wizard steps (bot mode):
  1. **Identity** — bot handle (`agent.name`), display name, tagline, purpose.
  2. **Character** — same as agent wizard.
  3. **Avatar** — visual representation.
  4. **Runtime** — model, provider, voice.
  5. **Connectors & Secrets** — bind installed connectors and declare required secrets.
  6. **Channels** — email, phone, wallet, Photon messaging, cross-surface bridging.
  7. **Package** — harness, allowed surfaces, bot profile review.
  8. **Review** — preview all primitives and launch.

The existing agent wizard stays available; bot mode is a packaging layer on top.

### 3.2 Agent-scoped connectors & secrets

New schema fields on `Agent`:

```ts
interface Agent {
  // ... existing fields

  /** Connectors bound to this agent for autonomous use */
  connectorBindings?: AgentConnectorBinding[];

  /** Secrets required by the agent runtime (keys, tokens, passwords).
   *  Values are references; actual material is stored in the vault. */
  secretRefs?: AgentSecretRef[];
}

interface AgentConnectorBinding {
  /** Reference to an owned connector instance */
  connectorId: string;
  /** Provider slug, e.g. slack, gmail, github */
  provider: string;
  /** Capability labels this connector satisfies */
  capabilities: string[];
  /** Whether the runtime may use this connector without human approval */
  autonomous: boolean;
  /** Hard-ban override for this connector */
  allowedActions?: string[];
}

interface AgentSecretRef {
  /** Human-readable label */
  name: string;
  /** Environment variable or config key injected at runtime */
  key: string;
  /** Vault reference (backend-resolved) */
  vaultRef?: string;
  /** Optional hint shown during setup */
  description?: string;
  /** Whether the runtime requires this secret to start */
  required: boolean;
}
```

- Connector bindings reference existing owned connectors; they do not duplicate credentials.
- Secrets are **references** in the agent record. The runtime resolves them from the vault at execution time.
- UI uses the existing connector registry + a secrets panel.

### 3.3 Native messaging

```ts
interface AgentMessagingConfig {
  /** Enable Photon-style cloud orchestration messaging */
  photonEnabled?: boolean;
  /** Agent's inbound Photon endpoint / topic */
  photonEndpoint?: string;
  /** Cross-surface session routing */
  crossSurfaceEnabled?: boolean;
  /** Allowed surface types this bot may bridge to */
  allowedSurfaces?: AppMode[];
}
```

- Photon is the working name for the cloud-orchestration message bus.
- Agent mail is fixed to send real `body`/`toAgentId` and backend `MailMessage` extended.
- Telephony integrated as a future phase (Vapi/Twilio providers).

### 3.4 Identity channels

```ts
interface AgentIdentityChannels {
  /** Agent-owned email address */
  email?: AgentEmailChannel;
  /** Agent-owned phone / SMS channel */
  phone?: AgentPhoneChannel;
  /** Wallet / payment identity */
  wallet?: AgentWalletChannel;
}

interface AgentEmailChannel {
  address: string;
  provider: 'commrails' | 'custom' | 'google_workspace' | 'microsoft_365';
  /** Whether the agent may send email autonomously */
  sendEnabled: boolean;
  /** Whether the agent may receive email */
  receiveEnabled: boolean;
}

interface AgentPhoneChannel {
  number: string;
  provider: 'vapi' | 'twilio' | 'telnyx';
  voiceEnabled: boolean;
  smsEnabled: boolean;
}

interface AgentWalletChannel {
  /** Wallet provider; 'etrid' is the Allternit-native wallet */
  provider: 'etrid' | 'metamask' | 'coinbase_wallet' | 'rainbow' | 'phantom' | 'custom';
  /** Public address / identifier */
  address?: string;
  /** Chain identifier when applicable */
  chainId?: string | number;
  /** Vault reference to the encrypted key material */
  keyVaultRef?: string;
  /** Allowed payment capabilities */
  allowedMethods?: ('send' | 'receive' | 'swap' | 'stake' | 'invoice')[];
}
```

- Email maps to CommRails email routing or a custom domain. With the mailflare rail configured (`ALLTERNIT_MAILFLARE_*`), email maps to a **real mailbox** on the installation's own mailflare worker: agents receive internet email (bridged into Rails Mail threads) and send it through a human approval gate. See `docs/AGENT_EMAIL_RAIL.md`.
- Phone maps to the telephony program (Vapi/Twilio).
- Wallet defaults to **Etrid** as the native Allternit agent wallet. Etrid does not exist yet; this schema reserves the integration point.

### 3.5 Etrid-native wallet

Etrid is proposed as the Allternit-native agent wallet:

- Each agent gets a vault-sealed key pair generated at provisioning time (Ed25519 for identity; future EVM support will add secp256k1).
- Keys are generated during bot creation/edit and stored encrypted in `agent_identity_channels`.
- The wallet is exposed to the runtime as a tool set:
  - `wallet_sign_message`
  - `wallet_send_transaction`
  - `wallet_get_balance`
  - `wallet_create_invoice`
- Policy is enforced by the `payments` hard-ban category and explicit allowed methods.
- The schema accepts `provider: 'etrid'`; the UI supports provisioning real keys now and will bind to Etrid settlement once the service is live.

## 4. Implementation phases

### Phase 1 — Bot wizard ✅
- Bot-first entry point in Bots tab.
- Complete `BotProfile` UI fields.
- Wire `validateBotProfile()` into the checklist.
- Show bot metadata in Review step.
- Preserve bot metadata on duplicate.
- Add bot editing to `EditAgentForm`.

### Phase 2 — Schema foundation ✅
- Add `connectorBindings`, `secretRefs`, `messagingConfig`, and `identityChannels` to `Agent` / `CreateAgentInput`.
- Add zod schemas and validation helpers.
- Add a Connectors & Secrets step in the bot wizard.

### Phase 3 — Connectors/secrets runtime ✅
- Backend resolves `connectorBindings` and `secretRefs` at agent start.
- Runtime injects secrets as env vars / config.
- UI shows resolved/missing secrets and connectors in `useBotSession`.

### Phase 4 — Messaging ✅ (core backend)
- Fix `sendAgentMail` to send real body/recipient.
- Extend backend `MailMessage` with `to_agent`, `subject`, `priority`.
- Photon inbox persistence in SQLite (`agent_photon_inbox`).

### Phase 5 — Identity channels ✅ (core backend)
- Agent email provisioning endpoint (requires operator email domain config). With the mailflare rail configured this provisions a real mailbox + mailbox-scoped sealed API key (provider `"mailflare"`); otherwise it mints an address record only (provider `"commrails"`).
- Phone provisioning endpoint (requires operator phone pool config).
- Wallet key generation and vault sealing is production-ready.

### Phase 5.6 — Real email transport ✅ (mailflare rail)
- Vendored mailflare fork in `services/mailflare/` (per-installation Cloudflare worker; see `docs/AGENT_EMAIL_RAIL.md`).
- Inbound internet email → HMAC webhook → Rails Mail threads (`mail:email-in-<agent>`), visible in Mail Monitor / agent activity.
- Outbound email held as `pending_approval` and released by the existing Rails Mail review gate (`POST /api/rails/mail/decide`).
- Per-installation setup via `services/mailflare/setup.sh` (deploys to the installing user's own Cloudflare account).

### Phase 5.5 — VM Operator ✅ (frontend contract + integration point)
- `vmOperator` schema added to `Agent` / `CreateAgentInput`.
- VM Operator step in bot creation/edit wizard.
- Bot Home Runtime tab and modal expose VM config.
- `bot-runtime-env.ts` injects `ALLTERNIT_VM_*` env vars.
- `src/lib/bots/vm-operator.ts` provides OpenSandbox-compatible lifecycle wrapper.

### Phase 6 — Payments
- Replace marketplace `NoopCharger`.
- Agent-to-agent payment protocol using ACP signatures.
- Etrid settlement service.

## 5. Gaps to watch

- **Field-level encryption** is handled by backend sealing (`token_crypto`); no raw secret values are stored in the agent record.
- **OAuth app registry** is hardcoded; custom OAuth clients need admin UI.
- **Renderer exposure of secrets** is minimal — values are typed into `ConnectorsStep` and immediately sealed by the backend; responses never include `value`.
- **Cross-surface authorization** needs a policy model beyond hard bans.
- **Photon transport** currently uses SQLite-backed inbox polling; a real-time transport (WebSocket, SSE, or Rails bus) is the next scaling step.

## 6. One-line principle

> A bot is an agent with packaged identity, scoped connectors, contained secrets, owned channels, and autonomous runtime permissions.


## 7. Implementation status

### Completed in this pass

- **Agent/Bot contract** hardened in `src/lib/bots/BOT_AGENT_CONTRACT.md` and `src/lib/agents/agent.types.ts`:
  - `BotProfile.displayName` is required.
  - Strict `Bot` type alias and `isBot()` type guard in `src/lib/bots/bot-profile.ts`.
- **Autonomous primitive schemas** added to `Agent` / `CreateAgentInput`:
  - `connectorBindings`
  - `secretRefs` (with optional `value` captured at edit time and stripped from responses)
  - `messagingConfig`
  - `identityChannels` (email, phone, wallet with Etrid native support)
- **Persistence** round-tripped through `agent.service.ts`, `local-agent-registry.ts`, and dedicated backend tables.
- **Bots merged into Agent Studio**:
  - Removed separate `Bots` hub tab.
  - Added **All / Bots / Agents** filter and context-aware **Create Bot / Create Agent** button in `AgentView.tsx`.
- **Bot-first wizard improvements**:
  - `IdentityStep` exposes bot handle, display name, and tagline when in bot mode.
  - `HarnessStep` defaults `groupChatEnabled` to `true` for bots.
  - `ReviewStep` shows bot profile, connectors, secrets, identity channels, and messaging summary.
- **Connectors & Secrets step** (`ConnectorsStep`) lists real installed connectors from `useConnectors()` plus quick-pick integrations; secret values are sealed by the backend.
- **Identity Channels step** (`IdentityChannelsStep`) collects email, phone, wallet, and Photon/cross-surface messaging toggles, and supports real provisioning when editing an existing agent.
- **EditAgentForm production wiring**:
  - Integrated `ConnectorsStep` and `IdentityChannelsStep`.
  - `connectorBindings`, `secretRefs`, `messagingConfig`, and `identityChannels` are editable and persisted via `updateAgent`.
- **Agent mail handoff** in `agent.service.ts`:
  - `handoffToBot` delivers `@mention` messages to a bot's inbox.
  - `sendAgentMail` sends `body`, `to_agent_id`, `subject`, and `priority`.
- **Runtime wiring**:
  - `useBotSession` and `useStartBotSession` both resolve secrets and connectors at session start and include results in session metadata.
  - `agent-secrets-resolver.ts` and `agent-connectors-resolver.ts` handle backend resolution.
  - `bot-runtime-env.ts` builds a unified runtime env map from harness, secrets, and connectors and injects it into `AgentContext` via `mode-session-store.ts`.
- **Backend production implementation**:
  - Migration `V47__agent_secrets_photon_identity.sql` adds `agent_secrets`, `agent_photon_inbox`, and `agent_identity_channels` tables.
  - `cmd/allternit-api/src/photon_routes.rs` uses SQLite + `token_crypto` encryption.
  - `cmd/allternit-api/src/agent_routes.rs` merges primitives into `config`, persists encrypted secrets, and persists identity channels.
  - Wallet provisioning generates Ed25519 keys via `ed25519-dalek` and stores encrypted private keys.
- **Bot roster sidebar**, **Bot pill in composer**, **persistent bot inbox**, and **bot-scoped routines panel** implemented in previous passes.
- **Bot Home view** (`src/views/bots/BotHomeView.tsx`):
  - Registered in `src/shell/ViewRegistry.tsx` as `bot-home` and added to the `ViewType` union in `src/nav/nav.types.ts`.
  - Clicking a bot in `BotRosterSidebar` or `ShellRail` opens `bot-home` instead of starting a session immediately.
  - Tabs: Sessions (with date grouping + project labels), Artifacts, Runtime, Routines.
  - Header actions: Inbox, Cloud handoff, Settings (Agent Studio), New Project, New Session.
- **Runtime context strip in bot sessions** (`src/views/agent-sessions/ChatModeAgentSession.tsx`):
  - Renders `AgentContextStrip` above the chat for `isBot === true` sessions.
  - Runtime drawer populated with `runtimeEnvEntries`, `connectorBindings`, `secretRefs`, and `missingRuntimeKeys` derived from the bot record + session metadata.

### Still to build

- **Real-time Photon transport** beyond SQLite-backed inbox polling (queue, SSE, or Rails bus).
- **Etrid settlement service** for agent-to-agent payments.
- **Marketplace settlement backend** replacing mock settlement.
- **Telephony provider integrations** beyond schema/UI support (requires Vapi/Twilio/Telnyx accounts).
- **Cross-surface authorization policy model** beyond hard bans.
