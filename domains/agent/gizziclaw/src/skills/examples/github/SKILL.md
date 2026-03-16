---
id: github
name: GitHub
version: 1.0.0
description: GitHub integration for issues, PRs, and repos
author: GizziClaw Team
license: MIT
capabilities:
  - list-issues
  - create-issue
  - list-prs
  - create-pr
  - list-repos
dependencies:
  - @octokit/rest
---

# GitHub Skill

This skill provides GitHub integration for managing issues, PRs, and repositories.

## Usage

```typescript
// List issues
const issues = await skills.github.listIssues('owner', 'repo');

// Create issue
await skills.github.createIssue('owner', 'repo', 'Title', 'Body');

// List PRs
const prs = await skills.github.listPRs('owner', 'repo');
```

## Configuration

Requires `GITHUB_TOKEN` environment variable.
