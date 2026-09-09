# Allternit Computer Interface (ACI)

The **Allternit Computer Interface (ACI)** is the platform layer that lets an agent observe and control a computer — typically a browser or desktop environment — through a live screenshot stream, mouse/keyboard actions, and human-in-the-loop approvals. ACI routes requests through the Allternit Computer Use (ACU) gateway and surfaces the run state to web, desktop, and iOS clients.

## ACI vs. managed cloud sandboxes

| | ACI / self-hosted | Managed cloud sandbox |
|---|---|---|
| **Hosting** | Runs on the user's machine, a private VPS, or a self-managed WebVM | Runs in a vendor-managed cloud account |
| **Data residency** | Code, screenshots, and credentials stay on the host | Leaves the host by default |
| **Network access** | Same network as the host; can reach internal services | Typically limited to public endpoints unless configured |
| **Approval model** | Pauses for human approval before destructive actions | Depends on the provider |
| **Cost model** | Compute is yours; no per-action sandbox meter | Per-request or per-hour cloud pricing |

ACI is designed for users who want agentic browser automation on infrastructure they control, with the same Clerk identity and session model as the rest of Allternit.

## Documentation

| Page | What it covers |
|------|----------------|
| [Quickstart](./quickstart.md) | Run your first browser automation in one command |
| [Guide](./guide.md) | Integration modes, action space and tool versions, approvals and server-side enforcement, environments and the VM driver, recording and replay, monitoring |
| [Recipes](./recipes.md) | Copy-paste flows for common tasks |
| [Changelog](./changelog.md) | Tool contract versions (`computerToolVersion`) |
