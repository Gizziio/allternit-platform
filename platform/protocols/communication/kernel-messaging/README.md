# A2rchitech Messaging Package

The messaging package provides the transport substrate for the A2rchitech kernel, including task queues, event buses, agent mail, and coordination leases.

## Features

- Task Queue for durable workflow scheduling
- Event Bus for real-time system coordination
- Agent Mail for asynchronous multi-agent coordination
- Coordination Leases for conflict-avoidance signaling
- Canonical envelopes for tasks, events, and messages
- Integration with history ledger for auditability

## Components

- Task Queue: Durable scheduling surface with retries and idempotency
- Event Bus: Lifecycle and observability events
- Agent Mail: Asynchronous coordination fabric with identities
- Coordination Leases: Advisory reservations on resources