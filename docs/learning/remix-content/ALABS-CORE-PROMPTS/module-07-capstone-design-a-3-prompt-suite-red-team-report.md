# Capstone: Design a 3-Prompt Suite + Red-Team Report

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

The capstone tests whether you can design a complete prompt system for a real-world agent task. You will write three interlocking prompts for a customer-support agent:
1. **Classifier Prompt:** Routes the ticket to the right department.
2. **Response Prompt:** Drafts the reply based on the classification.
3. **Safety Prompt:** Scans the draft for PII, toxicity, or policy violations.

Then you will red-team your own prompts: try to make them fail with adversarial inputs, edge cases, and jailbreak attempts. The deliverable is the prompt suite plus a red-team report documenting the failures and mitigations.

## Learning Objectives

- [ ] Design a multi-prompt system where each prompt has a single, clear responsibility.
- [ ] Write a structured evaluation dataset that covers normal, edge, and adversarial cases.
- [ ] Red-team a prompt system and implement concrete mitigations for each failure mode.

## Demo Outline (10 min)

1. **The Suite:** Walk through the three prompts. Show how the classifier's JSON output feeds into the response prompt's context.
2. **Red-Team Examples:** Show three successful attacks: a category the classifier missed, a rude customer message that triggered an inappropriate tone, and a ticket containing fake PII.
3. **The Fix:** Show the mitigations: expanded few-shot examples, a tone constraint, and a PII regex filter in the safety prompt.

## Challenge (Capstone — 60 min)

> **Build:** A 3-prompt suite for a support agent:
> - Prompt 1: Classify incoming tickets into 5 categories with confidence scores.
> - Prompt 2: Draft a polite, helpful response using internal knowledge-base snippets.
> - Prompt 3: Validate the draft for safety, accuracy, and policy compliance.
> - Red-team the suite with at least 10 adversarial inputs.
> - Write a 1-page red-team report with findings and fixes.
>
> **Deliverable:** A GitHub repo or PDF containing the prompts, test dataset, and red-team report.

## Allternit Connection

- **Internal system:** agui-gateway uses a classifier → drafter → validator pipeline for all customer-facing messages.
- **Reference repo/file:** \"prompts/support_suite/\" in agui-gateway.
- **Key difference from standard approach:** Allternit runs every production prompt through a quarterly red-team exercise. The prompts that survive are the ones that have been explicitly hardened against known failure modes.
