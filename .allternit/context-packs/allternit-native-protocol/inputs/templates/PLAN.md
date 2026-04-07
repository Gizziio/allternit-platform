# A2R Native: PLAN.md

Executable task plan for a single execution wave.

---
phase: XX-name
plan: NN
type: execute
wave: N
depends_on: []
files_modified: []
requirements: []
---

<objective>
[Detailed description of what this plan accomplishes]

Purpose: [Why this matters for the project]
Output: [Specific artifacts created]
</objective>

<context>
- PROJECT.md
- ROADMAP.md
- STATE.md
- [Relevant source files]
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <files>path/to/file.ext</files>
  <read_first>path/to/reference.ext</read_first>
  <action>[Specific implementation details with concrete values and reasoning]</action>
  <verify>[Command or check to prove it worked]</verify>
  <done>[Measurable acceptance criteria]</done>
</task>

<!-- Add more tasks as needed -->

</tasks>

<verification>
Before declaring plan complete:
- [ ] [Test command]
- [ ] [Build check]
- [ ] [Behavioral validation]
</verification>

<success_criteria>
- All tasks completed successfully
- Verification checks pass without regression
- Final output matches the objective
</success_criteria>
