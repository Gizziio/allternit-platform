# Canvas Academic Notice Modules Spec

## Purpose

Define the Summit OIC `Academic Notices` feature as a governed Canvas workflow that identifies at-risk students, produces the exact institutional notice PDF, stages notice artifacts inside Canvas, and prepares the workflow for signature and audit completion.

This document is the authoritative feature spec for the current proof of concept and the next implementation phase.

## Problem

Faculty and staff currently have to detect at-risk students manually, assemble notice materials by hand, and track completion across disconnected systems. That creates three operational failures:

- identification is inconsistent across sections and terms
- the notice form is easy to miscopy or alter
- follow-up and acknowledgment tracking create avoidable friction

The feature must reduce those failures without changing the institution's official notice form.

## Goals

- Use Canvas course data as the operational system of record for notice generation.
- Apply fixed institutional rules consistently.
- Populate the exact uploaded `Course Academic Status Notification` fillable PDF without structural edits.
- Stage notice artifacts in Canvas in a way faculty can review and send with minimal effort.
- Preserve an audit-safe record of what was generated and for whom.

## Non-Goals

- Replacing Canvas as the gradebook.
- Freeform AI drafting of institutional notice language.
- Production e-sign completion in the current PoC.
- Automatic live sending to real students without human review.

## Users

- `Faculty`
  Reviews the course, triggers the workflow, checks targeted students, and sends notices.

- `Program Manager / Advisor`
  Reviews summary status and escalation outputs.

- `Student`
  Receives the notice package and later acknowledges receipt through the selected signing workflow.

## Canonical Inputs

- Canvas course
- current enrollments
- current grades
- missing assignments
- attendance or attendance proxy if available
- milestone stage
- exact institutional PDF template

## Canonical Outputs

- filled academic notice PDF per targeted student
- missing assignments attachment per targeted student
- Canvas summary page for the generated notice batch
- Canvas module containing the staged artifacts
- anonymized instructor or manager summary
- audit log with minimal operational metadata

## Business Rules

### Eligibility

- A student is targeted when current grade is below `70%`.
- The threshold is policy-driven and must remain configurable, but the current PoC default is `70`.

### Deterministic Behavior

- Given the same course inputs and the same policy settings, the workflow must produce the same targeted students and the same artifact structure.
- Output naming, folder structure, and routing shape must be stable.
- The PDF template must remain the original institutional form.

### Template Fidelity

- The uploaded fillable PDF is the only authoritative notice form.
- The system may fill fields but may not re-layout, rewrite, or redesign the template.
- All generated notices must remain visually and structurally identical to the institutional source apart from student-specific field values.

### Review and Sending

- Generated notices are staged for faculty review before delivery.
- The current PoC stops at staging and documentation of the next handoff.
- Production sending should support email and Canvas messaging, with e-sign status captured through webhook or provider callback.

## User Workflow

### Faculty Experience

1. Faculty selects the active Canvas course.
2. Faculty chooses the milestone stage or trigger window.
3. The system reads current grades and missing assignments from Canvas.
4. The system filters students below the policy threshold.
5. The system fills the exact institutional PDF for each targeted student.
6. The system generates the missing assignments attachment for each targeted student.
7. The system creates a Canvas summary page that explains the batch and lists targeted students.
8. The system creates a Canvas module for the notice batch and uploads the artifacts.
9. Faculty reviews the staged batch.
10. In the next phase, faculty sends or initiates signature requests from the reviewed batch.

### Student Experience

1. Student receives the notice package.
2. Student reviews the filled notice and missing-work details.
3. In the next phase, student signs through the selected hosted signing flow.
4. Completion status returns to staff view without manual chasing.

## Canvas Module Design

Each workflow run creates a dedicated Canvas module representing one notice batch.

### Module Contents

- `Queue Summary` page
- one academic notice PDF per targeted student
- one missing assignments attachment per targeted student

### Design Intent

- Faculty should be able to open one module and see the complete notice batch.
- The module acts as a staging and review surface, not a student-facing course lesson.
- The module should remain unpublished by default unless policy explicitly allows publication.

## Current PoC Implementation

### Implemented

- exact fillable PDF population using the uploaded institutional form
- deterministic targeting using sample or runtime-selected data
- per-student artifact generation
- Canvas module creation
- Canvas summary page creation
- Canvas file upload for notice artifacts
- module item insertion for staged files and summary page
- repeatable command-driven demo runner

### Current Local Components

- [run_canvas_e2e_demo.py](/Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices/run_canvas_e2e_demo.py)
- [fill_notice_pdf.py](/Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices/fill_notice_pdf.py)
- [run_demo.mjs](/Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/poc/academic_notices/run_demo.mjs)
- [academic_notice_demo.skill.md](/Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/skills/canvas/academic_notice_demo.skill.md)
- [academic_notice_demo.form.json](/Users/macbook/Desktop/allternit-workspace/allternit/domains/governance/tenants/summit_oic/forms/academic_notice_demo.form.json)

### Proof of Concept Boundaries

- The current implementation proves the Canvas staging flow.
- It does not yet provide production-grade sending, roster-safe role filtering, or signature completion.
- It should be treated as a controlled operational prototype.

## Architecture

### Runtime Shape

1. Load course and workflow settings.
2. Read or generate the student batch.
3. Evaluate the threshold and identify targeted students.
4. Fill the official notice PDF for each targeted student.
5. Generate supporting attachment files.
6. Authenticate to Canvas.
7. Create a dedicated module for the batch.
8. Create and upload the summary page and notice artifacts.
9. Write a local audit result with Canvas object identifiers.

### Why It Is Deterministic

- policy threshold is fixed
- milestone-to-trigger handling is fixed
- the PDF template is fixed
- field mapping is fixed
- artifact naming is fixed
- module composition is fixed

The PoC may use automation to move through the workflow, but the artifact logic is rule-based rather than generative.

## Risks and Constraints

### Security

- Credentials must not remain embedded in user-facing docs or shared artifacts.
- Production deployment should move secrets into tenant-managed secret storage.

### Privacy

- Real student data must not be used in demos unless explicitly authorized.
- Reports shown to broader audiences should remain anonymized.

### Canvas Operational Constraints

- File upload and module creation must tolerate partial failures and support safe reruns.
- Duplicate module creation on rerun should be handled explicitly.
- Course publishing behavior must remain conservative.

### Template Constraint

- Any change to the institutional notice form requires re-validation of field mapping.

## Next Work For Canvas Modules

This is the immediate implementation roadmap for the feature.

### Phase 1: Make Module Runs Operationally Clean

- add idempotency or rerun naming rules so repeat runs do not create confusing duplicate modules
- add module metadata in the summary page: trigger date, threshold, batch size, reviewer, run timestamp
- mark modules clearly as `review queue` artifacts, not student learning content
- default all generated modules to unpublished

### Phase 2: Replace Demo Inputs With Live Course Reads

- pull enrollments from Canvas directly
- read grades and missing assignments from the selected course in runtime
- map Canvas users to notice recipients safely
- support faculty choice of section or full-course scope

### Phase 3: Add Review and Send Controls

- create a faculty approval step before any delivery event
- support batch send and per-student send
- write send status back to the batch record
- log failures and retries visibly

### Phase 4: Add Signature Completion

- integrate hosted signing through the chosen provider
- return signed status and signed document URL or file receipt to the notice batch
- expose `pending`, `sent`, `signed`, and `failed` states in the Canvas-adjacent queue

### Phase 5: Production Hardening

- move from local credential file to managed secret storage
- add structured error handling and retry policy
- add regression fixtures for the PDF field map
- add audit-safe receipts for every Canvas write
- define retention and cleanup rules for generated files

## Acceptance Criteria

The feature is ready for the next implementation phase when all of the following are true:

- a faculty user can select a course and generate a notice batch from live Canvas data
- the system targets only students below the configured threshold
- every generated notice uses the exact institutional PDF template
- the system stages the batch in an unpublished Canvas module with a summary page
- reruns are understandable and do not create uncontrolled duplication
- the batch can move cleanly into review and signature handoff

## Recommendation

Treat the Canvas module as the review surface, not the final compliance system.

That keeps the faculty workflow simple:

- generate the batch from Canvas
- review inside the generated module
- send from a controlled queue
- track signature and completion outside the module but linked back to the batch

This is the correct next step because it uses Canvas for operational context while keeping compliance-sensitive delivery and acknowledgment logic governed separately.
