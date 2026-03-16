# 🐺 GizziClaw - Agent Workspace System

**Version:** 1.0.0  
**Based On:** OpenCLAW v2026.3.14  
**Status:** Active Development

---

## Overview

GizziClaw is a TypeScript implementation of the OpenCLAW agent workspace system, integrated with Gizzi-Code and the A2R platform.

It provides the "agent.so" - the complete agent definition system with 5-layer workspace architecture.

---

## Architecture

### 5-Layer Workspace

```
Workspace/
├── layer1-cognitive/      # Cognition, reasoning, decision-making
├── layer2-identity/       # Agent identity, persona, memory
├── layer3-governance/     # Policy, ethics, constraints
├── layer4-skills/         # Skills, capabilities, tools
└── layer5-business/       # Business logic, workflows, automation
```

### Integration Points

**With Gizzi-Code:**
- Workspace loading on startup
- Layer management via CLI
- Skill installation and execution

**With A2R Platform:**
- UI components for workspace visualization
- Skill installer UI
- Layer panel in platform UI

---

## Installation

```bash
cd domains/agent/gizziclaw
pnpm install
```

---

## Usage

### Create Workspace

```typescript
import { Workspace } from '@a2r/gizziclaw';

const workspace = await Workspace.create('/path/to/workspace', 'My Agent');
await workspace.run();
```

### Load Workspace

```typescript
import { Workspace } from '@a2r/gizziclaw';

const workspace = await Workspace.load('/path/to/workspace');
await workspace.loadSkills();
```

### Manage Skills

```typescript
import { installSkill, uninstallSkill, loadSkills } from '@a2r/gizziclaw';

// Install skill
await installSkill('/path/to/workspace', '/path/to/skill-source', 'skill-name');

// Load skills
const skills = await loadSkills('/path/to/workspace/skills');

// Uninstall skill
await uninstallSkill('/path/to/workspace', 'skill-name');
```

---

## Example Skills

### Apple Notes

Read and write Apple Notes on macOS.

```typescript
await skills['apple-notes'].read('My Note');
await skills['apple-notes'].write('My Note', 'Content');
```

### GitHub

GitHub integration for issues and PRs.

```typescript
await skills.github.listIssues('owner', 'repo');
await skills.github.createIssue('owner', 'repo', 'Title', 'Body');
```

### Canvas

Canvas LMS integration.

```typescript
await skills.canvas.listCourses();
await skills.canvas.getAssignments(courseId);
```

---

## Development

### Build

```bash
pnpm run build
```

### Test

```bash
pnpm run test
```

### Type Check

```bash
pnpm run typecheck
```

---

## Project Structure

```
gizziclaw/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── workspace/
│   │   ├── workspace.ts         # Workspace management
│   │   └── workspace-dirs.ts    # Directory management
│   ├── skills/
│   │   ├── skill-loader.ts      # Skill loading
│   │   └── examples/            # Example skills
│   └── agents/                  # Agent definitions
├── tests/
├── package.json
└── tsconfig.json
```

---

## License

MIT

---

## Credits

Based on [OpenCLAW](https://github.com/OpenCLAW/OpenCLAW) v2026.3.14
