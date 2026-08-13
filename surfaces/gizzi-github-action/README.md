# Gizzi Code — GitHub Action

AI-powered code review and generation powered by Allternit.

## Features

- **Code Review** — Automatic review of pull request diffs for bugs, security issues, and quality
- **Code Generation** — Generate tests, documentation, and boilerplate from existing code
- **Code Fix** — Identify and fix issues in target files
- **Code Explain** — Generate detailed explanations of code files

## Usage

### Review a Pull Request

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: allternit/gizzi-github-action@v1
        with:
          action: review
          api-key: ${{ secrets.ALLTERNIT_API_KEY }}
```

### Generate Tests

```yaml
name: Generate Tests
on:
  workflow_dispatch:
    inputs:
      file:
        description: 'File to generate tests for'
        required: true

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: allternit/gizzi-github-action@v1
        with:
          action: generate
          api-key: ${{ secrets.ALLTERNIT_API_KEY }}
          target: ${{ github.event.inputs.file }}
```

### Fix Code

```yaml
- uses: allternit/gizzi-github-action@v1
  with:
    action: fix
    api-key: ${{ secrets.ALLTERNIT_API_KEY }}
    target: src/utils/helpers.ts
```

### Explain Code

```yaml
- uses: allternit/gizzi-github-action@v1
  with:
    action: explain
    api-key: ${{ secrets.ALLTERNIT_API_KEY }}
    target: src/core/engine.ts
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `action` | Yes | `review` | Action to perform: `review`, `generate`, `fix`, `explain` |
| `api-url` | No | `https://api.allternit.com` | Allternit API URL |
| `api-key` | Yes | — | Allternit API key |
| `target` | No | — | Target file path or PR number |
| `model` | No | `default` | Model to use for generation |
| `max-tokens` | No | `4096` | Maximum tokens for the response |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | The full action result text |
| `summary` | A markdown summary of changes or review |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |

## Development

```bash
npm install
npm run build
```
