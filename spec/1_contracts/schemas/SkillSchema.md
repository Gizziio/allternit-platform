# /spec/SkillSchema.md
# Skill Schema — Software + Robotics

A Skill is a **versioned unit of how you work**. It is a package, not a prompt. fileciteturn5file7L15-L22

## Required package layout (minimum)
- `SKILL.md` — routing + domain knowledge fileciteturn5file7L18-L21
- `Workflows/` — procedures (scientific loop encoded) fileciteturn5file7L18-L21
- `Tools/` — deterministic executables fileciteturn5file7L18-L21

## Execution invariants
- workflows start with OBSERVE and end with VERIFY or LEARN fileciteturn5file7L23-L31
- VERIFY is the anti-hallucination kill-switch fileciteturn5file7L30-L31

## Governance hooks
Skill invocation must pass through the Tool Gateway, which performs pre-execution policy checks. fileciteturn5file0L45-L53

## Robotics extension (reserved)
Robotics/IoT skills extend the same package contract with:
- adapters
- safety envelopes
- simulation-first promotion gates
