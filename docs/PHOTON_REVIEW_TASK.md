# Task: Review Photon / Messaging Architecture

You are reviewing work done by another agent on the Allternit platform. Do NOT write implementation code. Produce a written review and recommendations.

## Files to read

1. `surfaces/ai.allternit.com/src/views/bots/BotRuntimeConfigModal.tsx`
2. `surfaces/ai.allternit.com/src/views/agent-view/steps/IdentityChannelsStep.tsx`
3. `surfaces/ai.allternit.com/src/lib/messaging/photon.service.ts`
4. `surfaces/ai.allternit.com/src/lib/bots/bot-photon.ts`
5. `surfaces/ai.allternit.com/src/lib/bots/BOT_AGENT_CONTRACT.md`
6. `cmd/allternit-api/src/photon_routes.rs`
7. `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts` (focus on `AgentMessagingConfig`)

## Context

- The agent recently added a "Photon Cloud Messaging" card to `BotRuntimeConfigModal` and `IdentityChannelsStep`, with state for `photonEnabled`, `photonEndpoint`, `crossSurfaceEnabled`, and `allowedSurfaces`.
- It was later discovered that **Photon is a third-party service**: https://photon.codes. It runs **Spectrum**, a framework for connecting agents to iMessage, WhatsApp, Telegram, Slack, SIP voice, etc.
- Allternit already has internal code named `photon` (service, routes, client) that appears to be a naming collision or placeholder, NOT the real Photon.codes service.

## Questions to answer

1. Is the recent UI work technically correct? Does it persist `messagingConfig` properly? Are there type errors or runtime issues?
2. Should the internal Allternit "Photon" bus be renamed to avoid confusion with Photon.codes? If so, to what?
3. How should Photon.codes Spectrum actually integrate with Allternit?
   - As a phone/messaging provider in `identityChannels.phone`?
   - As a connector in `connectorBindings`?
   - Both?
4. What is the current state of the internal Photon bus? Is it production-ready? What are its gaps?
5. Are there any obvious bugs or design issues in the recent changes?

## Constraints

- Do NOT start implementing changes.
- Do NOT run dev servers or builds.
- Match the repo's existing conventions in any example snippets you provide.

## Deliverable

Write `docs/PHOTON_MEMORY_REVIEW_NOTES.md` starting with this YAML frontmatter:

```yaml
---
agent: kimi
status: done
files_reviewed: []
findings: []
recommendations: []
deviations: []
remaining: []
---
```

Fill in the lists. Then add prose notes explaining each finding and recommendation.
