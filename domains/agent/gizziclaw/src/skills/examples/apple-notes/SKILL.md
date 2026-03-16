---
id: apple-notes
name: Apple Notes
version: 1.0.0
description: Read and write Apple Notes
author: GizziClaw Team
license: MIT
capabilities:
  - read-notes
  - write-notes
  - search-notes
dependencies:
  - apple-script
---

# Apple Notes Skill

This skill allows the agent to read and write Apple Notes on macOS.

## Usage

```typescript
// Read a note
const note = await skills['apple-notes'].read('My Note');

// Write a note
await skills['apple-notes'].write('My Note', 'Content here');

// Search notes
const results = await skills['apple-notes'].search('keyword');
```

## Requirements

- macOS only
- Apple Scripting Bridge enabled
