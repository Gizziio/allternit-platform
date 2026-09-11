# Harness install channels — fold agy/antigravity (rq-20260908-028 follow-up)

- **Date:** 2026-09-10
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/291 · merge commit `d363492c0bc560f29679b58e44bf4071a73cc567`

## What landed

agy **is** Google's Antigravity CLI (`agy` binary). Removed the duplicate `antigravity` manifest key (16 tools).

Install recipes for every remaining tool that had been marked `unsupported`:

- npm: grok `@xai-official/grok@1.0.25`, gizzi `@allternit/gizzi-code@2.0.7`, codebuddy `@tencent-ai/codebuddy-code@2.148.0`, qoder `@qoder-ai/qodercli@1.1.49`, workbuddy `@workbuddy/cli@1.0.3`
- script (new method): agy `antigravity.google/cli/install.sh --dir {bin}`, cursor `cursor.com/install`

Proprietary installs still require `--accept-terms`. dsh PyPI pin still missing. npm `cursor-agent` is a squatter — not used.

Brain Ops `harness.json` kept byte-identical (`2fc9aef`).
