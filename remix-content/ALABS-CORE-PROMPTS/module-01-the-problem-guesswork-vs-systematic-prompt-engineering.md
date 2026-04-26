# The Problem: Guesswork vs. Systematic Prompt Engineering

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

Most people treat prompt engineering as magic: type a wish into the model and hope for the best. When it fails, they add more adjectives. When it still fails, they blame the model. This module replaces guesswork with a systematic framework: prompts are interfaces, and like any interface, they should be designed, tested, and versioned.

We introduce the Prompt Engineering Stack: context, constraints, examples, and evaluation. You will learn to treat a prompt as a deployable artifact that lives in version control, not a chat message that disappears into Slack.

## Learning Objectives

- [ ] Distinguish between exploratory prompting (chat) and production prompting (system interfaces).
- [ ] Apply the four layers of the Prompt Engineering Stack to a real task.
- [ ] Write a prompt test suite that catches regression when the model or context changes.

## Demo Outline (10 min)

1. **The Guesswork Loop:** Show a "vibe prompt" for a support ticket classifier. Run it 5 times. Show inconsistent labels.
2. **The Systematic Rewrite:** Add a role, output schema, few-shot examples, and a constraint. Run it 5 times. Show consistency.
3. **Regression Test:** Change the model temperature. Show how the structured prompt is more robust than the vibe prompt.

## Challenge (5 min)

> **The One-Prompt Test:** Pick a simple classification task. Write one "vibe" prompt and one "systematic" prompt. Run 10 examples through both. Score accuracy and consistency. The systematic prompt must win on both.

## Allternit Connection

- **Internal system:** agui-gateway stores all production prompts in \"prompts/\" as versioned YAML files.
- **Reference repo/file:** \"prompts/support_classifier_v2.yaml\" in agui-gateway.
- **Key difference from standard approach:** Allternit never allows prompt changes in production without passing a regression test suite. Prompts are code.
