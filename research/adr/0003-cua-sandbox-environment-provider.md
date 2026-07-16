# ADR 0003: Cua Sandbox Behind the Allternit Environment Interface

- Status: Accepted for integration
- Date: 2026-07-15

## Decision

Wrap Cua Sandbox, Lume, QEMU, container, Windows, and Android capabilities behind the canonical Allternit `ComputerEnvironment` lifecycle. Existing Allternit Firecracker and VM components will either implement the same interface or be retired after parity and migration.

Environment/image identity, isolation, resource limits, network policy, shell, files, clipboard, streaming, snapshots, cleanup, and evidence are governed by Allternit.

## Consequences

- Product and agent code do not import upstream environment classes directly.
- Host control becomes one explicit environment type rather than the implicit default.
- Risk policy can select sandbox isolation without changing the planner contract.

