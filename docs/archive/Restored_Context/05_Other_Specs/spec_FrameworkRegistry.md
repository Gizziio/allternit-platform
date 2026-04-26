# FrameworkRegistry
## Framework & Capsule Templates (L4 Skills)

Frameworks define how capsules are spawned and what canvases they produce.

---

## FrameworkSpec (minimum)

- framework_id (fwk_*)
- version (semver)
- status (draft/candidate/active/deprecated)
- capsule_template (capsule type + default canvases)
- required_tools (ToolSpec IDs + scopes)
- directives (DirectivePattern IDs)
- eval_suite (Acceptance/Eval IDs)
- promotion_rules

---

## Lifecycle

draft → candidate → active → deprecated

Promotion requires:
- eval pass
- governance approval (for write/exec)
- journaled decision entry
