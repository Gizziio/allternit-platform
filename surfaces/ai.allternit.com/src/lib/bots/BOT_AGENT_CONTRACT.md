# Agent vs Bot Contract

> Version: 1.0  
> Scope: Allternit AI platform (`ai.allternit.com`)  
> Status: Active implementation

## Summary

In the Allternit platform we use **Agent** as the execution primitive and **Bot** as a packaged, user-facing instance of that primitive.

| | Agent | Bot |
|---|---|---|
| **What it is** | The autonomous execution entity: model, harness, tools, skills, character, trust tier, workspace. | A curated, packaged identity layer on top of an Agent. |
| **Created in** | Agent Studio | Agent Studio — bots are created through the same wizard, with a **Bots** filter and **Create Bot** CTA in the studio. No separate Bots hub tab. |
| **Discovered in** | Agent Hub, Swarms, A2A registry, Teammates roster | Bots hub, composer `@` mentions, bot session launcher. |
| **Has identity** | Internal `name` (unique system handle / `@` handle), `description`, `characterLayer`. | `botProfile.displayName`, tagline, accent color, category, welcome message, starter prompts. `agent.name` remains the `@` mention handle. |
| **Can run autonomously** | Yes | Yes — it *is* an Agent. |
| **Can be @-mentioned** | Only if packaged as a bot | Yes — this is the bot UX entry point. |
| **Cardinality** | Many agents may never be surfaced as bots. | Every bot is exactly one Agent. |
| **Connectors & secrets** | Declared via `connectorBindings` and `secretRefs`; resolved at runtime. | Same — a bot carries its own scoped connectors and vault references. |
| **Messaging** | `messagingConfig` (Photon, cross-surface). | Same — bots are addressable on the Photon bus and across surfaces. |
| **Owned channels** | `identityChannels`: email, phone, wallet. | Same — a bot may have its own email, phone number, and Etrid wallet. |
| **Virtual computer** | `vmOperator`: sandboxed VM / computer-use primitive. | Same — a bot can run tasks inside a sandbox (OpenSandbox, Docker, K8s, local). |

**One-line rule:**  
> Every Bot is an Agent; not every Agent is a Bot.

## Why this matters

The previous UI had **7 hard-coded bots** that were not backed by real agents. That violated the contract: a bot must be a packaged agent, not a template or a marketing card. This contract lets us:

1. Author once in **Agent Studio**.
2. Optionally **package** the agent as a bot with UX metadata.
3. Discover and invoke the bot consistently via the **Bots hub** or `@` mentions.
4. Keep the execution layer (agent runtime) unchanged regardless of whether the agent is packaged as a bot.

## Industry alignment

We looked at the current market and aligned with the most common pattern: a **bot** is a named, packaged AI teammate users can summon, while **agent** is the underlying autonomous capability.

- **Allternit Bot** — a packaged AI teammate that runs on its own cloud computer, retains context, handles focused jobs, delegates to other bots, and learns routines. This is the canonical "named bot" pattern.
- **Cursor** — uses **Agent** for the autonomous coding mode (Cursor Agent / Composer) and **Bot** for background/async workers (e.g. Bug Bot). Cursor shows the split: Agent = autonomous mode; Bot = packaged worker identity.
- **ChatGPT / OpenAI** — **Custom GPT** is a reactive specialized assistant packaged with identity and tools; **Agent** (in their API/platform sense) is a multi-step autonomous workflow that gathers context and delivers finished work.
- **Claude / Anthropic / IBM** — **Assistant** = reactive; **Agent** = proactive, autonomous, multi-step, decision-making.

Allternit’s model is closest to **Allternit Bot** plus **Cursor Composer Agent**: the Agent is the autonomous engine, and the Bot is the packaged identity users interact with.

## TypeScript schema

```ts
// Agent: the execution primitive
interface Agent {
  id: string;
  name: string;                 // unique system handle / @-mention name
  description: string;
  type: AgentType;
  model: string;
  provider: ModelProvider;
  capabilities: string[];
  tools: string[];
  systemPrompt?: string;
  characterLayer?: CharacterLayerConfig;
  trustTier?: TrustTier;
  harness?: HarnessConfig;
  allowedSkills?: string[];
  allowedTools?: string[];
  category?: AgentCategory;
  tags?: string[];
  agentCard?: AgentCard;        // A2A/discovery metadata
  isBot?: boolean;              // packaging flag
  botProfile?: BotProfile;      // present when isBot === true

  // Autonomous bot primitives (see agent.types.ts)
  connectorBindings?: AgentConnectorBinding[];
  secretRefs?: AgentSecretRef[];
  messagingConfig?: AgentMessagingConfig;
  identityChannels?: AgentIdentityChannels;
  vmOperator?: AgentVMOperatorConfig;
  // ... other agent fields
}

// BotProfile: UX/packaging metadata
interface BotProfile {
  displayName: string;          // required user-facing name
  tagline?: string;
  welcomeMessage?: string;
  starterPrompts?: string[];
  accentColor?: string;
  groupChatEnabled?: boolean;
  defaultPresetId?: string;
  botCategory?: BotCategory;
}

// Bot: a strictly typed packaged Agent
type Bot = Agent & {
  isBot: true;
  botProfile: BotProfile;
};

// Runtime rule
// A bot session carries the underlying Agent id plus bot metadata and is
// entitled to the bot's connectorBindings, secretRefs, messagingConfig, and
// identityChannels. The runtime resolves secrets from the vault at start time
// and enforces the connector/action allow-list.
```

### Validation rules

1. `isBot` must be `true` for a packaged bot.
2. When `isBot === true`, `botProfile` is required and `botProfile.displayName` is required.
3. `agent.name` remains the unique system handle (used for IDs, sessions, A2A, and `@` mentions if no separate handle is introduced).
4. `botProfile.displayName` is the human-readable label shown in the Bots hub, session header, and cards.
5. A bot may be filtered/searched by `displayName`, `tagline`, `description`, and `tags`.

## UX contract

### Bot roster (Hermes Bot Mode inspired)

- A **collapsible Bot Roster Sidebar** lives inside the chat surface.
- It lists every bot the user owns with avatar, display name, and `@handle`.
- Clicking a bot opens the **Bot Home** for that bot.
- A hover/start action still starts a bot session directly.
- Each bot row exposes actions: Start session, Open Inbox, Edit, Duplicate.

### Bot Home / Hub

- Selecting a bot in the roster (or any bot discovery surface) opens a dedicated **Bot Home** view (`bot-home`) rather than immediately launching a chat.
- The Bot Home is the single place to manage one bot:
  - **Home tab** — primary delegation surface with quick tasks, stats, starter prompts, and recent work.
  - **Tasks tab** — lists every task/session scoped to the bot, grouped by date; supports starting a new task or creating a new project/task under the bot.
  - **Artifacts tab** — shows code, markdown, diagrams, browser captures, and images produced by the bot across all sessions.
  - **Runtime tab** — displays the bot's connectors, secret refs, harness mode, owned identity channels (email, phone, wallet), and virtual computer config with missing-secret warnings.
  - **Automation Tasks tab** — bot-scoped cron jobs, routines, and recurring tasks.
- Header actions provide **Inbox**, **Cloud handoff**, **Settings** (edit in Agent Studio), **New Project**, and **New Session** entry points.
- This keeps bot work organized into focused sessions and projects instead of one infinitely long chat, matching the OpenClaw-style session model.

### Runtime context strip in a bot session

- When a bot session is active, an **Agent Context Strip** is rendered above the chat.
- It exposes four drawers:
  - **Workspace** — session scope, tags, canvas count.
  - **Tools** — tools available to the bot.
  - **Automation** — runs and cron status.
  - **Runtime** — resolved env vars (harness, secrets, connectors), connector bindings, secret refs, and missing required keys.
- The Runtime drawer is the in-session view of the same connectors/secrets/connectors shown on the Bot Home Runtime tab, so users can verify what the bot can access while it is running.

### Bot tab in composer

- The composer bottom dock shows a **"Bot"** pill/tab.
- When off, chat is a normal assistant session.
- When on, a bot selector opens; the selected bot is rendered as an `@BotName` pill in the composer.
- Sending a message starts or continues a **bot session** backed by the underlying agent.

### Agent Inbox (bot-to-bot messaging)

- Every bot has a persistent **Inbox** reachable from the roster and from the bot session header.
- The inbox shows threads of `AgentMailMessage`s.
- A user can compose a message to another bot; the runtime delivers it via `sendAgentMail`.
- When a bot is `@mentioned` in a composer, the message is handed off to that bot's inbox.

### Routines / cron pane

- A bot session shows a **Routines** side pane.
- Routines are scoped to the active bot via `agent_id`.
- Users can create, edit, enable/disable, and view history for bot routines.

### Authoring

- **Agent Studio** is the single place to create and configure both agents and bots.
- The studio header has an **All / Bots / Agents** filter and a context-aware **Create Bot / Create Agent** button.
- In **bot-first mode** the wizard exposes bot identity up front:
  - **Bot Handle** (`agent.name`) — lowercase, no spaces, used for `@` mentions and routing.
  - **Display Name** (`botProfile.displayName`) — human-readable name shown in cards and session headers.
  - **Tagline** — short description shown in the bot picker.
- The **Harness** step still includes a **Package as Bot** toggle for agents created in agent mode.
- `groupChatEnabled` defaults to `true` for bots so they can participate in group-chat mentions.
- When packaged as a bot, the author must provide:
  - `displayName` (required)
  - `tagline` (optional but recommended)
  - `accentColor` (optional)
  - `botCategory` (optional)
  - `welcomeMessage` (optional)
  - `starterPrompts` (optional, max 5)

### Discovery

- The **Bots** filter inside **Agent Studio** shows only agents where `isBot === true`.
- The **All** filter shows every agent the user owns or has access to.
- Cards use `botProfile.displayName`, tagline, accent color, and `@` handle.

### Invocation

- In the chat composer, **Bot mode** replaces the old "Agent mode".
- Turning on Bot mode opens a bot selector populated from `isBot === true` agents.
- The selected bot is rendered as an `@BotName` pill in the composer.
- Sending a message starts a **bot session** backed by the underlying agent.

### Runtime

- A bot session is a regular agent session with `metadata.isBot = true`, `metadata.botProfile`, and the bot's autonomous primitives copied in.
- The agent runtime uses the same `systemPrompt`, `tools`, `characterLayer`, `trustTier`, and `harness` regardless of packaging.
- A bot session carries:
  - `connectorBindings` — scoped connectors the bot may use autonomously.
  - `secretRefs` — declared secret keys; values are resolved at session start via `agent-secrets-resolver.ts`.
  - `messagingConfig` — Photon orchestration and cross-surface bridging flags.
  - `identityChannels` — owned email, phone, and wallet channels.
  - `vmOperator` — virtual computer / sandbox configuration; injected into `runtimeEnv` as `ALLTERNIT_VM_*` vars and dispatched to OpenSandbox or another provider.
  - `runtimeEnv` — merged env map from harness, VM config, resolved secrets, and resolved connectors, passed in `AgentContext` on every message.
- The bot identity is for presentation, routing, and discovery; execution entitlement comes from the underlying agent plus the scoped primitives above.

## Migration notes

- The hard-coded `bots.manifest.ts` and `bot-icons.tsx` files have been removed.
- Existing agent records that should appear as bots need `isBot: true` and a populated `botProfile`.
- UI copy is being standardized: "Bot mode", "Bots hub", "Package as Bot", while "Agent Studio" remains the authoring surface.

## Backend support

All endpoints are implemented in `cmd/allternit-api` and persist to SQLite with `token_crypto` encryption for secrets and wallet keys.

- `POST /api/v1/photon/agents/:agent_id/inbox` — deliver a message to a bot's Photon inbox (`agent_photon_inbox`).
- `GET /api/v1/photon/agents/:agent_id/inbox` — poll a bot's Photon inbox.
- `POST /api/v1/photon/sessions/:session_id/bridge` — bridge a session to another surface.
- `PUT /api/v1/agents/:agent_id/secrets/:key` — seal a secret value into `agent_secrets`.
- `POST /api/v1/agents/:agent_id/secrets/resolve` — resolve `secretRefs` to runtime env values.
- `POST /api/v1/agents/:agent_id/connectors/resolve` — resolve `connectorBindings` to runtime credentials.
- `GET /api/v1/agents/:agent_id/identity` — read the agent's identity channels.
- `POST /api/v1/agents/:agent_id/identity/email` — provision an agent-owned email address.
- `POST /api/v1/agents/:agent_id/identity/phone` — provision an agent-owned phone number.
- `POST /api/v1/agents/:agent_id/identity/wallet` — provision an agent-owned wallet (Ed25519 key pair + encrypted private key).

## Open decisions

1. **Group chat**: `botProfile.groupChatEnabled` defaults to `true`; multi-recipient routing and group-thread persistence are not yet implemented.
2. **Marketplace vs personal bots**: `isPublic` on the underlying Agent controls marketplace discoverability; `isBot` controls in-product bot UX.
