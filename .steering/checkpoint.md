# Checkpoint — fabric desktop fullscreen from follow branch

## Goal
Restore the live `session/desktop-follow-0911` FabricDesktopDrive (full-screen
viewer, pill toolbar). Open it from a top Monitor icon, not a rail tab.
Keep machine-select → session list.

## Just did
- Checked out FabricDesktopDrive.tsx from origin/session/desktop-follow-0911.
- Dashboard: Monitor in the node header; same visualViewport fullscreen overlay.
- Back from overlay returns to sessions. Desktop removed from the rail.

## Next
- Commit, PR, deploy if asked.
