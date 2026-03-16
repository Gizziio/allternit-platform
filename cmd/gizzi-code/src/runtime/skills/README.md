# Skill Creator Runtime

AI-guided skill creation for Gizzi Code.

## Quick Reference

```typescript
// Quick create (no interview)
import { skillCreator } from "./creator-tool"
const result = await skillCreator.quickCreate("Process PDFs")

// Full creation with interview
const result = await skillCreator.create(
  "Analyze GitHub PRs",
  async (question) => await askUser(question)
)

// Direct API
import { createSkillWithAI } from "./skill-generator"
const { skillPath, generated } = await createSkillWithAI({
  description: "My skill",
  targetPath: "./.gizzi/skills",
})
```

## Modules

| Module | Purpose |
|--------|---------|
| `creator.ts` | Core skill creation logic, templates, validation |
| `skill-generator.ts` | LLM-powered generation with interview |
| `creator-tool.ts` | Tool interface for AI agents |
| `skill.ts` | Skill loading and management |

## Flow

```
User Description → AI Interview → Generate Skill → Create Files
```

## Templates

- `minimal` - Basic documentation
- `tool-integration` - API integrations
- `data-processing` - Data transformation
- `workflow-automation` - Multi-step workflows

## CLI

```bash
gizzi create-skill                    # Interactive
gizzi create-skill -d "description"   # One-liner
```
