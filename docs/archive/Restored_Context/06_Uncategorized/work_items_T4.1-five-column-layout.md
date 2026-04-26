---
wih_version: 1
work_item_id: "T4.1"
title: "Implement Five-Column Layout in Shell"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Create five-column layout component"
    - "Implement resizable columns"
    - "Add column visibility toggles"
  context_packs:
    - "surfaces/shell/"
    - "vendor/txtx-axel-app/Views/"
  artifacts_from_deps:
    - "T2.7"
    - "T3.6"
scope:
  allowed_paths:
    - "surfaces/shell/src/components/layout/"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "npm.build"
    - "npm.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "surfaces/shell/src/components/layout/FiveColumnLayout.tsx"
    - "surfaces/shell/src/components/layout/ResizableColumn.tsx"
  required_reports:
    - "layout_report.md"
acceptance:
  tests:
    - "npm test -- layout"
    - "npm run build"
  invariants:
    - "Layout is responsive"
    - "Columns can be resized"
  evidence:
    - "layout_report.md"
blockers:
  fail_on:
    - "build_error"
stop_conditions:
  escalate_if:
    - "accessibility_issue"
  max_iterations: 5
---

# Implement Five-Column Layout in Shell

## Objective
Create a five-column workspace layout for the Shell UI.

## Column Structure
```
┌──────────┬──────────┬──────────────┬──────────┬──────────┐
│   DAG    │  Inbox   │  Terminals   │  Skills  │  Mail    │
│  Status  │          │              │          │          │
├──────────┼──────────┼──────────────┼──────────┼──────────┤
│          │          │              │          │          │
│          │          │              │          │          │
│          │          │              │          │          │
└──────────┴──────────┴──────────────┴──────────┴──────────┘
```

## Component
```tsx
interface FiveColumnLayoutProps {
  dagStatus: React.ReactNode;
  inbox: React.ReactNode;
  terminals: React.ReactNode;
  skills: React.ReactNode;
  mail: React.ReactNode;
  columnWidths?: [number, number, number, number, number];
}

export const FiveColumnLayout: React.FC<FiveColumnLayoutProps> = ({
  dagStatus,
  inbox,
  terminals,
  skills,
  mail,
  columnWidths = [1, 1, 2, 1, 1],
}) => {
  // Implementation
};
```

## Features
- Resizable columns
- Collapsible columns
- Responsive design
- Keyboard navigation
