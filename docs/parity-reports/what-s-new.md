---
status: done
files_changed:
  - docs/public/parity/what-s-new.md
  - docs/parity-reports/what-s-new.md
items_covered:
  - April 13–17, 2026
  - April 20–24, 2026
  - April 6–10, 2026
  - Automate trusted workflows
  - Branch earlier and choose tools from the composer
  - Build and deploy websites with Sites
  - Collaborate in a dedicated academic research workspace
  - Compare security scans and manage findings
  - Connect partner tools with Sign in with ChatGPT
  - Continue a chat on another host
  - Control parallel Codex work with Codex Micro
  - February 2–6, 2026
  - February 9–13, 2026
  - Find chats that need your attention
  - Find useful context across your browser and open tabs
  - Follow long-running goals
  - Give Codex context from any Mac app with Appshots
  - July 13–17, 2026
  - July 20–24, 2026
  - July 27–31, 2026
  - July 6–10, 2026
  - June 15–19, 2026
  - June 1–5, 2026
  - June 8–12, 2026
  - Keep Work conversations and Projects together on desktop
  - Let Codex operate the browser and review approvals
  - March 16–20, 2026
  - March 23–27, 2026
  - March 2–6, 2026
  - March 9–13, 2026
  - May 11–15, 2026
  - May 18–22, 2026
  - May 25–29, 2026
  - May 4–8, 2026
  - Move chats between Local and Worktree
  - Organize sessions and extend Codex CLI 0.146.0
  - Package workflows as plugins
  - Preview and operate work in one place
  - Refine generated images in your conversation
  - Review and ship pull requests in the app
  - Review changes across repositories
  - Run Codex natively on Windows
  - Run security scans from the terminal, CI, or TypeScript
  - Schedule work with the right environment
  - Start with a chat and keep it moving
  - Steer active work and add files
  - Take on ambitious work in ChatGPT
  - Talk through work with ChatGPT Voice
  - Turn demonstrated workflows into reusable skills
  - Use Codex with Amazon Bedrock
  - Use Windows apps and control Codex remotely
  - Work across browser tabs with the Chrome extension
  - Work across multiple folders in one local project
items_missing:
  - "Build and deploy websites with Sites: no first-party managed hosting surface; BYOC deployment is the current path."
  - "Collaborate in a dedicated academic research workspace: generic workspaces and research primitives exist, but no dedicated academic UI."
  - "Compare security scans and manage findings: no repository scanner, finding model, comparison API, or workbench."
  - "Control parallel Codex work with Codex Micro: child sessions and work queues exist, but no Micro product/controller."
  - "Find chats that need your attention: session filtering exists, but no attention classifier/inbox."
  - "Give Codex context from any Mac app with Appshots: ACI and screenshots exist, but no Appshots share-sheet flow."
  - "Refine generated images in your conversation: no native iterative image generation/editing tool."
  - "Review and ship pull requests in the app: possible through repository tools/MCP, but no first-party PR inbox."
  - "Run security scans from the terminal, CI, or TypeScript: external BYOC scanners are supported, but Allternit has no native repository scanner."
notes: "Docs-only change; no build was run. Weekly source headings are mapped to Allternit's month-level release notes rather than treated as features. OpenAI-specific identity and hosted-product concepts are marked not applicable or roadmap."
---

# What's new parity report

Created a single category page that maps every assigned ChatGPT/Codex What's
new item to an audited Allternit capability or an explicit gap. Concrete
examples cover durable child sessions, cron deployments, approval policy,
computer-use sessions, plugins, remote MCP, and Amazon Bedrock.

The page distinguishes self-host/BYOC differences from genuine missing product
surfaces. In particular, it does not claim parity for managed Sites hosting,
Codex Security scanning, Codex Micro, Appshots, conversational image editing,
or dedicated hosted inbox/workbench experiences.
