# /spec/AcceptanceTests.md — Executable Truth (v0)

Generated: 2026-01-27

These acceptance tests are platform-level gates. Every major change must reference one or more test IDs.

## AT-BOOT — Deterministic boot

- **AT-BOOT-0001**: Kernel refuses to start if `/SOT.md` missing.
- **AT-BOOT-0002**: Kernel refuses to start if `CODEBASE.md` missing.
- **AT-BOOT-0003**: Kernel refuses to start if `/spec/Contracts/WIH.schema.json` missing.
- **AT-BOOT-0004**: Kernel prints the loaded boot manifest (hashes of law files) into `/.a2r/boot/receipt.json`.

## AT-WIH — WIH/Beads enforcement

- **AT-WIH-0001**: Task dispatch denied if WIH missing.
- **AT-WIH-0002**: Task dispatch denied if WIH invalid against schema.
- **AT-WIH-0003**: Any tool call denied if task state != RUNNING.

## AT-TASK — DAG + resume

- **AT-TASK-0001**: `blockedBy` prevents dispatch until deps COMPLETE.
- **AT-TASK-0002**: `/install` produces immutable preset hash; tasks reference exact hash.
- **AT-TASK-0003**: `/resume <task_id>` restores last run receipts + cursor and continues deterministically.
- **AT-TASK-0004**: COMPLETE requires declared artifacts exist and acceptance checks pass.

## AT-IO — Output law and write scopes

- **AT-IO-0001**: Any write outside `/.a2r/` is denied.
- **AT-IO-0002**: Any write outside WIH declared globs is denied.
- **AT-IO-0003**: Run produces filesystem diff manifest + artifact manifest.

## AT-TOOLS — Tool registry + safety

- **AT-TOOLS-0001**: Tool must exist in tool registry to be callable.
- **AT-TOOLS-0002**: Tool call denied if tool safety level exceeds WIH allowance.
- **AT-TOOLS-0003**: PreToolUse hook runs before every tool call and can deny.

## AT-MEM — Layered memory + promotion

- **AT-MEM-0001**: Memory access requires WIH-declared pack/layer.
- **AT-MEM-0002**: Session writes cannot mutate law memory.
- **AT-MEM-0003**: Proposals written to `/.a2r/proposals/` only.
- **AT-MEM-0004**: Deterministic auto-approve promotion requires rules + checks; promotion creates diff + receipt.

## AT-NET — Gateway law

- **AT-NET-0001**: UI/CLI only talks to Gateway endpoint.
- **AT-NET-0002**: Internal services are not externally reachable.
- **AT-NET-0003**: Service addressing is name-based; ports are centralized in generated config.

