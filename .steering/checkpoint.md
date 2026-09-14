# session/bot-computer-window-0914

**Goal:** Open the bot's computer in a dedicated full-size Electron window instead of the half-open ACI pane.

**Just did:** Implemented `shell:open-bot-computer`, chrome-free detached `/shell?detachedSurface=bot-computer`, pane button now "Open in window", VNC claim priority `window: 4`. Rebased onto main after PR #515 (noVNC CPU tame) auto-merged the viewport.

**Next:** Re-run tests after rebase, push, PR, merge, attest.

**Open questions:** none. #515 owns RFB pause; this session only changed the pane button label in that file.

**Do not touch:** noVNC decode/scale path; Incus/Tart substrate; ACI rail itself.
