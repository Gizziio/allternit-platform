# Allternit Pipeline Charter

The pipeline's taste reference. The scout writes briefs through this lens; the
spec-checker REJECTS specs that violate it. Edit this file to steer what the
pipeline builds — it is plain data, deliberately not code.

## What Allternit is

An agent runtime and orchestration platform: rails (agent messaging bus),
agent roles/profiles, memory services, the gizzi-code CLI, the plugin SDK, and
the A://Labs learning platform that teaches this stack.

## We build

- Agent orchestration infrastructure: rails, executor tooling, steering and
  checking systems, memory
- The gizzi-code CLI, agent skills, and plugins
- Platform surfaces (e.g. ai.allternit.com) that showcase the stack
- A://Labs course content about building on this stack
- Tooling that makes agents more autonomous AND more verifiable at once

## We do NOT build

- Consumer apps unrelated to agents or agent infrastructure
- Foundation models or model-training infrastructure
- Crypto/web3 features
- Reimplementations of mature open-source tools we could consume instead
- Features that need always-on human supervision to be safe

## Current priorities

- Autonomous pipelines with independent verification (this system)
- Agent memory and programmatic self-improvement
- Dogfooding: every tool must be used by our own agents before it ships
