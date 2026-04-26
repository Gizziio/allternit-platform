---
wih_version: 1
work_item_id: "T4.4"
title: "Create Skills Hub Component"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Create skills browser component"
    - "Show LLM-specific installations"
    - "Add sync controls"
  context_packs:
    - "surfaces/shell/"
    - "infrastructure/allternit-skill-portability/"
  artifacts_from_deps:
    - "T1.8"
    - "T4.1"
scope:
  allowed_paths:
    - "surfaces/shell/src/components/skills/"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "npm.build"
    - "npm.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "surfaces/shell/src/components/skills/SkillsHub.tsx"
    - "surfaces/shell/src/components/skills/SkillCard.tsx"
  required_reports:
    - "skills_hub_report.md"
acceptance:
  tests:
    - "npm test -- skills"
  invariants:
    - "Skills are displayed correctly"
    - "Sync buttons work"
  evidence:
    - "skills_hub_report.md"
blockers:
  fail_on:
    - "api_error"
stop_conditions:
  escalate_if:
    - "design_issue"
  max_iterations: 5
---

# Create Skills Hub Component

## Objective
Create a component for managing portable skills.

## Components

### SkillsHub
```tsx
interface SkillsHubProps {
  skills: PortableSkill[];
  onSync: (skillId: string, llms: LLMType[]) => void;
  onInstall: (path: string) => void;
  onRemove: (skillId: string, llm: LLMType) => void;
}

export const SkillsHub: React.FC<SkillsHubProps> = ({
  skills,
  onSync,
  onInstall,
  onRemove,
}) => {
  // Show skill list
  // Show LLM installation status
  // Provide sync controls
};
```

### SkillCard
```tsx
interface SkillCardProps {
  skill: PortableSkill;
  installations: LLMInstallation[];
  onSync: () => void;
  onRemove: (llm: LLMType) => void;
}
```

## Features
- Browse available skills
- See installation status per LLM
- Sync to selected LLMs
- Remove from LLMs
- Install from file/directory
