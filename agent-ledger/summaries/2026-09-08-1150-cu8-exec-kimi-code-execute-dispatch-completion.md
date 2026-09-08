# Session cu8-exec — /v1/execute dispatch completion (post-audit bug 5)
- Branch session/cu8-exec → PR #155 → merge 104297d6c
- Added 10 missing action handlers (mouse_move, left_click, left_click_drag, middle_click, left_mouse_down/up, cursor_position, hold_key, wait; zoom = explicit UNSUPPORTED_PLATFORM) mapping to Playwright→pyautogui fallback; no-coordinate browser clicks use down/up at virtual cursor. sdk/allternit-sdk capability parses screenshot from artifacts[] with legacy fallback (was always throwing).
- Verified: pytest 124 passed (+19 new), vitest 6/6, tsc clean. Root-caused test placement constraint (test_replay.py sys.modules purge) and documented in test file.
