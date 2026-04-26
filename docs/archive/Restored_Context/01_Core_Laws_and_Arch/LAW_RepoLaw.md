
# APPENDIX A — PROJECT ORGANIZATION LAW
## Agentic Engineering Techniques (Formalized)

Status: Append-only  
Scope: Project organization, execution hygiene, agent alignment  
Compatibility: Fully compliant with Baseline + Deltas + SOT enforcement

This appendix operationalizes five agentic engineering techniques as non-negotiable system law.
They are organizational constraints, not advice.

---

## A1. PRD-FIRST DEVELOPMENT (INTENT ANCHOR)

Law:
No execution may occur without a canonical intent document.

Framework Binding:
PRDs are part of the Baseline truth layer.

Required Location:
/spec/Baseline/PRD.md (or embedded in Vision + Requirements)

Enforcement:
- All tasks must reference PRD sections.
- Brownfield projects must maintain a reverse-PRD.

---

## A2. MODULAR RULES ARCHITECTURE (CONTEXT ISOLATION)

Law:
Context must be explicitly loaded, never ambient.

Framework Binding:
Rules live in /agent/* and /references/* and are loaded on demand.

Required Structure:
/agent/POLICY.md  
/references/api.md  
/references/components.md  
/references/auth.md  
/references/deploy.md  

Enforcement:
- Agents must declare loaded context.
- Irrelevant context halts execution.

---

## A3. COMMAND-IFY EVERYTHING (DETERMINISM LAYER)

Law:
Repeated actions become commands or workflows.

Framework Binding:
Commands are execution tools, not reasoning skills.

Required Location:
/tools/commands.md  
/tools/workflows.md  

Enforcement:
- Instructions repeated twice must be formalized.
- Commands are deterministic.

---

## A4. CONTEXT RESET (SESSION BOUNDARY LAW)

Law:
Planning and execution must not share degraded context.

Framework Binding:
Enforced through session orchestration.

Mandatory Flow:
Research → Build Context → Plan → DOC → RESET → EXEC → Report

Enforcement:
- Execution agents only consume written artifacts.

---

## A5. SYSTEM EVOLUTION MINDSET (COMPOUNDING LAW)

Law:
Every failure must upgrade the system.

Framework Binding:
Handled by the Meta Agent.

Required Outcome:
One of the following must be updated:
- /agent/*
- /references/*
- /tools/*
- /spec/Deltas/*
- Acceptance tests

---

## A6. UNIFIED INVARIANT

Agents operate inside the system.  
The system evolves.  
Memory is written, not remembered.

---

## A7. ENFORCEMENT SUMMARY

Execution halts if:
- PRD missing
- Context not declared
- Commands repeated manually
- No context reset
- Failures not converted into system updates

---

End of Appendix A
