# Steering checkpoint

Goal: Unify ACI with Gizzi runtime selection, shrink ACI logos, replace HAR setup with teach-the-agent skill/workflow recording, and wire the Allternit computer-use engine + bot connection into the ACI panel.

Just did: Implemented in `session/aci-unify` worktree. ACI/page-agent/computer-use now resolve the persisted Gizzi picker (`claude-cli/…`) instead of a separate API-key brain. Chrome extension DEMO_CONFIG no longer points at the Shanghai test proxy. Logos on mini-apps, extensions, and the ACI sidepanel wordmark are smaller (`object-contain`). Site APIs is Teach-first (record walkthrough → distill skill → replay; HAR import is advanced). ACI sidecar has an engine bar: Allternit CUA (local) / sub-agent / page-agent, plus bot connection. 11 targeted tests passing.

Next: Owner review in the desktop app. Then PR from `session/aci-unify`. Remaining: Office add-in still has its own API key pane; lifting ModelSelectionProvider to the shell so ACI can open the same picker in-place.

Open questions: None blocking.
