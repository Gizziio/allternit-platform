# ACI Tool Contract Changelog

Changes to the **Allternit Computer Use** tool contract
(`allternitToolType: "computer"`, selected by `computerToolVersion`). The
version id selects the action set a model is allowed to emit; nothing else in
the contract changes between versions.

## 20251124

- Adds the **`zoom`** action — zoom into a screen region. The capability must
  be created with `enableZoom: true` for the model to be allowed to emit it;
  the input is a `region` of `[x1, y1, x2, y2]` pixel corners, not a point
  coordinate.

## 20250124

- Initial Allternit Computer Use action set (also the default when no version
  is specified): `mouse_move`, `left_click`, `right_click`, `double_click`,
  `triple_click`, `left_click_drag`, `scroll`, `type`, `key`, `hold_key`,
  `screenshot`, `cursor_position`, `wait`.
- Tool metadata carries `display_width_px` / `display_height_px` (absolute
  pixel coordinates) and `requiresVision: true`.

## Legacy compatibility note

During the transition the tool metadata still carries `anthropicType`
(`computer_20250124` / `computer_20251124`) as a legacy-compat adapter for
upstream integrations. It is not part of the Allternit contract — nothing
user-facing should depend on it.
