# Settings Parity Gap Analysis

## Verified

- `http://127.0.0.1:3013/settings-preview` renders the real `SettingsView` without the full shell import graph.
- The Settings modal opens on Infrastructure and the sidebar/content layout renders.
- The new Platform item, `Allternit Plugins`, appears in the Settings sidebar.
- `Allternit Plugins` renders a settings-native Skills and Plugins panel inside the Settings modal.
- Skills render as simple rows with descriptions, metadata, and toggles.
- Plugins render as simple rows with descriptions, metadata, and toggles.
- The Settings modal keeps the normal 1000px settings width.

## Parity Assessment

- General settings panels now follow the quiet modal idiom: grouped sidebar, small section titles, muted controls, shared empty/loading states.
- Infrastructure panels are visually aligned with the settings idiom after the Phase D sweep.
- Allternit Plugins is functionally present in Settings using the same quiet row/toggle idiom as the rest of the modal. It does not embed the full three-pane capability manager.
- The settings-only preview route is useful for review because the full `/shell` route can take a long time to cold-load while Vite discovers and optimizes the shell dependency graph.

## Remaining Gaps

- The Settings-native Skills/Plugins panel currently uses bundled skills and registered feature plugins only. It avoids runtime filesystem scanning so the settings modal does not depend on the heavier capability-manager backend paths.
- A later backend integration can add user-installed local skill discovery to this same settings panel.
- Full `/shell` cold-load remains slow and unstable during Vite dependency optimization; the lightweight `/settings-preview` route avoids that for Settings review.
- Existing unrelated Settings `Models` panel can throw when model data lacks `details.quantization_level`; this was observed in the dev-server console during HMR/review and is outside the plugin/settings-parity change.

## Screenshots

- `output/settings-plugins-skills-modal-final.png` captures the settings-native Allternit Plugins section.

## Recommendation

- Keep `Allternit Plugins` in the Platform settings group.
- Keep the full capability manager as its own operational surface; do not embed it in Settings.
- Treat local user-installed skill discovery as a separate backend integration task.
- Keep `/settings-preview` during this review cycle unless the team wants it removed before merging.
