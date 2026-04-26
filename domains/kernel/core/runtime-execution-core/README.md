# Allternit Runtime Core Package

The runtime-core package provides the sovereign execution substrate of Allternit, including session management, scheduling, eventing, artifacts, checkpoints, and replay capabilities.

## Features

- Session lifecycle management
- Deterministic scheduling with concurrency controls
- Event emission backbone
- Artifact storage with content-addressing
- Checkpoint creation and rollback
- Replay driver for deterministic execution
- Integration with policy, messaging, workflows, and history

## Components

- Session System: Create/close sessions with metadata and tenant binding
- Scheduler: Dispatch tasks with retry policies and concurrency limits
- Eventing Backbone: Emit lifecycle events with trace IDs
- Artifacts + Checkpoints: Immutable storage with checkpoint capabilities
- Replay Driver: Rehydrate and replay execution deterministically