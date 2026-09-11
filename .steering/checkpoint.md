# Checkpoint — fabric machine sessions first

## Goal
Selecting a machine on Fabric Transport opens the node session dashboard, not live desktop/VNC. Desktop remains an opt-in tab.

## Just did
- Stop auto-opening the first session.
- Reset driveKind to chat on runtime change.
- Mobile: session list is the landing view; Desktop/VNC is behind a tab + back.
- Remote-control PWA: default tab is Sessions, not Desktop.

## Next
- Commit, PR, bump caches (v25 / remote-control v3).
