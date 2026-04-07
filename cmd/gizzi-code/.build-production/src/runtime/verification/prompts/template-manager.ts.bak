/**
 * Prompt Template Manager
 * 
 * Manages prompt templates for different verification types.
 */

import { Log } from "@/shared/util/log";
import type { VerificationTask, VerificationContext } from "../types";

export type TemplateType = "general" | "patch_equivalence" | "fault_localization" | "code_qa";

export interface TemplateRenderOptions {
  task: VerificationTask;
  context?: VerificationContext;
  customInstructions?: string;
}

export class PromptTemplateManager {
  private log = Log.create({ service: "verification.prompts" });
  private templates: Map<TemplateType, string> = new Map();
  
  constructor() {
    this.registerDefaultTemplates();
  }
  
  /**
   * Get a template by type
   */
  getTemplate(type: TemplateType, options: TemplateRenderOptions): string {
    const template = this.templates.get(type);
    if (!template) {
      this.log.warn(`Unknown template type: ${type}, falling back to general`);
      return this.templates.get("general")!;
    }
    
    return this.renderTemplate(template, options);
  }
  
  /**
   * Register a custom template
   */
  registerTemplate(type: TemplateType, template: string): void {
    this.templates.set(type, template);
    this.log.info(`Registered template: ${type}`);
  }
  
  // ========================================================================
  // Template Rendering
  // ========================================================================
  
  private renderTemplate(template: string, options: TemplateRenderOptions): string {
    let rendered = template;
    
    // Replace task placeholders
    rendered = rendered.replace(/\{\{task_type\}\}/g, options.task.type);
    rendered = rendered.replace(/\{\{task_description\}\}/g, options.task.description);
    rendered = rendered.replace(/\{\{task_question\}\}/g, options.task.question || "");
    
    // Add custom instructions if provided
    if (options.customInstructions) {
      rendered = rendered.replace(
        /\{\{custom_instructions\}\}/g,
        options.customInstructions
      );
    } else {
      rendered = rendered.replace(/\{\{custom_instructions\}\}/g, "");
    }
    
    return rendered;
  }
  
  // ========================================================================
  // Default Templates
  // ========================================================================
  
  private registerDefaultTemplates(): void {
    this.templates.set("general", GENERAL_TEMPLATE);
    this.templates.set("patch_equivalence", PATCH_EQUIVALENCE_TEMPLATE);
    this.templates.set("fault_localization", FAULT_LOCALIZATION_TEMPLATE);
    this.templates.set("code_qa", CODE_QA_TEMPLATE);
  }
}

// ============================================================================
// Template Definitions
// ============================================================================

const GENERAL_TEMPLATE = `You are a code verification engine using semi-formal reasoning.

## Core Principle

You must construct a formal certificate proving your conclusion with explicit evidence for every claim. The certificate acts as a proof that another engineer could verify by following your traces.

## Task

{{task_type}}: {{task_description}}
{{#task_question}}
Question: {{task_question}}
{{/task_question}}

{{custom_instructions}}

## Structured Certificate (MANDATORY)

You MUST complete every section. No skipping allowed.

---

### DEFINITIONS

State key definitions needed for the proof:
- D1: [What correctness means for this specific task]
- D2: [What the tests verify]
- D3: [Any domain-specific definitions]

### PREMISES

State explicit premises with evidence:
- P1: [Specific claim about what was modified] | Evidence: [file:line you examined] | Verified by: [how you checked]
- P2: [Claim about original behavior] | Evidence: [file:line] | Verified by: [what you read]
- P3: [Claim about new behavior] | Evidence: [file:line] | Verified by: [code trace]
- P4: [Claim about test expectations] | Evidence: [test file:line] | Verified by: [test analysis]

**EVIDENCE REQUIREMENT**: Every premise MUST cite specific file:line locations you actually examined.

### EXECUTION TRACES

For each test or scenario, provide complete execution trace:

Trace 1: [Descriptive name]
- Test: [test name if applicable]
- Scenario: [what is being tested]
- Code Path:
  1. [file:line] [function] - [specific behavior at this line]
  2. [file:line] [function] - [specific behavior, note any calls]
  3. ... continue through entire execution
- Outcome: [PASS/FAIL/ERROR/UNKNOWN]
- Reasoning: [step-by-step explanation of why this outcome occurs]

**TRACING RULE**: Follow EVERY function call to its definition. Do not assume behavior based on names.

### EDGE CASES

Identify and analyze edge cases:
- E1: [Edge case description]
  - Input/Conditions: [specific values/states]
  - Code behavior: [what the code actually does]
  - Expected by test: [what test expects]
  - Match: [YES/NO]

### ALTERNATIVE HYPOTHESES

Consider and reject alternative explanations:
- H1: [Alternative hypothesis]
  - Why considered: [reasoning]
  - Counter-evidence: [what disproves this]
  - Rejection reason: [why this is wrong]

### CONCLUSION

Formal conclusion:
- Statement: [Clear, specific conclusion about correctness]
- Follows from premises: [P1, P2, ...]
- Answer: [YES/NO/UNCERTAIN/PARTIAL]
- Confidence: [high/medium/low] with reasoning

### COUNTEREXAMPLE (required if answer is NO)

If claiming failure, provide reproducible counterexample:
- Location: [file:line]
- Test: [test that exposes it]
- Expected: [what should happen]
- Actual: [what actually happens]
- Root cause: [specific code path that leads to failure]

---

## Critical Rules (VIOLATION = INVALID CERTIFICATE)

1. **NO ASSUMPTIONS**: Never assume what a function does. Always trace to its definition.
   - BAD: "format() pads the number" (assuming builtin)
   - GOOD: "format() at django/utils/dateformat.py:47 creates DateFormat object, which then..."

2. **NAME SHADOWING CHECK**: Verify what each name refers to in its specific scope.
   - Check for module-level functions that shadow builtins
   - Check for variable shadowing in nested scopes

3. **COMPLETE TRACING**: Every code path must be traced end-to-end.
   - Don't stop at "calls helper function"
   - Trace into helper and document what it returns

4. **EVIDENCE CITATION**: Every claim needs a file:line citation.
   - "The function returns X" → cite the return statement
   - "Variable Y is Z" → cite the assignment

5. **ADMIT UNCERTAINTY**: If source isn't available or behavior is unclear:
   - Mark as UNKNOWN in conclusion
   - Note the limitation in reasoning
   - Don't guess

## Common Failure Modes (CHECK FOR THESE)

- [ ] Incomplete trace: Stopped at function call without following it
- [ ] Name confusion: Assumed builtin when it's actually a custom function
- [ ] Missed dependency: Didn't trace a code path that affects the outcome
- [ ] Edge case dismissal: Identified difference but incorrectly deemed it irrelevant
- [ ] Third-party guessing: Assumed library behavior without verification

## Output Format

You must output a valid JSON object matching the VerificationCertificate schema with all fields populated. No empty arrays allowed - if you have nothing to say in a section, you haven't analyzed deeply enough.`;

const PATCH_EQUIVALENCE_TEMPLATE = `You are a patch equivalence verification engine using semi-formal reasoning.

## Task: Patch Equivalence Verification

{{task_description}}

**Definition**: Two patches are EQUIVALENT MODULO TESTS iff executing the repository test suite produces identical pass/fail outcomes for both patches.

{{custom_instructions}}

## CRITICAL INSTRUCTIONS

You are comparing TWO patches that attempt to solve the same problem. Your job is to determine if they produce IDENTICAL test outcomes.

**Key Insight from Research**: 
- Standard reasoning often fails by assuming function behavior without tracing
- Example: format() in Django is a module function, not Python's builtin
- You MUST trace every function call to its actual definition

## Structured Certificate (MANDATORY)

---

### DEFINITIONS

- D1: Two patches are EQUIVALENT MODULO TESTS iff executing the repository test suite produces identical pass/fail outcomes for both patches.
- D2: The relevant tests are ONLY those in FAIL_TO_PASS and PASS_TO_PASS.
- D3: A COUNTEREXAMPLE is a test where one patch passes and the other fails.

### PREMISES

For EACH patch, state explicit premises:

Patch 1 Premises:
- P1.1: Patch 1 modifies [file(s)] by [specific change description]
- P1.2: The key function modified is [function] at [file:line]
- P1.3: [Additional behavioral claims with evidence]

Patch 2 Premises:
- P2.1: Patch 2 modifies [file(s)] by [specific change description]
- P2.2: The key function modified is [function] at [file:line]
- P2.3: [Additional behavioral claims with evidence]

Test Premises:
- PT1: Test [name] checks [specific behavior] by [how it verifies]
- PT2: [Additional test premises]

### EXECUTION TRACES

For EACH test, trace through BOTH patches:

Trace 1: [Test name] with Patch 1
- Entry point: [file:line]
- Step 1: [file:line] [function] - [behavior]
- Step 2: [file:line] [function] - [behavior]
  - Function call: [function] at [file:line]
  - Traced to definition: [actual definition with behavior]
- Continue until test outcome
- Outcome: [PASS/FAIL]
- Reasoning: [detailed explanation]

Trace 2: [Same test name] with Patch 2
- Same structure as Trace 1
- MUST trace the SAME code path
- Highlight where behavior differs

### COMPARISON ANALYSIS

For each test:
- Test: [name]
- Patch 1 outcome: [PASS/FAIL]
- Patch 2 outcome: [PASS/FAIL]
- Outcomes match: [YES/NO]
- If NO: This is a COUNTEREXAMPLE

### EDGE CASES RELEVANT TO TESTS

ONLY analyze edge cases that the ACTUAL tests exercise:
- E1: [Edge case from test]
  - Patch 1: [behavior]
  - Patch 2: [behavior]
  - Same outcome: [YES/NO]

### COUNTEREXAMPLE (REQUIRED if claiming NOT EQUIVALENT)

If you found a test with different outcomes:
- Test: [name]
- Patch 1: [outcome + detailed trace]
- Patch 2: [outcome + detailed trace]
- Why different: [root cause analysis]
- Location of difference: [file:line]

### NO COUNTEREXAMPLE EXISTS (REQUIRED if claiming EQUIVALENT)

If all tests have same outcomes:
- All [N] tests produce identical outcomes because [reasoning]
- All code paths traced: [YES]
- Name shadowing checked: [YES]
- Edge cases match: [YES]

### CONCLUSION

- Statement: [Clear equivalence statement]
- Follows from: [premise IDs]
- Patches are: [EQUIVALENT/NOT EQUIVALENT] modulo tests
- Confidence: [high/medium/low]
- Answer: [YES if equivalent, NO if not]

---

## FAILURE MODES TO AVOID (from research)

1. **Incomplete Tracing**
   - BAD: "Calls helper function, returns formatted string"
   - GOOD: "Calls format() at utils.py:47 → returns '%02d' % value → returns '76'"

2. **Name Shadowing**
   - Check: Is format() Python's builtin or a local function?
   - Check: Is this the actual function or an import alias?

3. **Assumed Equivalence**
   - Don't assume two different implementations produce same output
   - Actually trace both and compare

4. **Missed Edge Cases**
   - Check boundary conditions
   - Check error handling paths
   - Check null/empty inputs

5. **Third-Party Gaps**
   - If you can't see source code, note this as a limitation
   - Don't guess library behavior

## VERIFICATION CHECKLIST

Before concluding, verify:
- [ ] Traced ALL functions to their definitions
- [ ] Checked for name shadowing
- [ ] Analyzed ALL relevant tests
- [ ] Compared edge cases
- [ ] Found counterexample if claiming non-equivalence
- [ ] Documented all premises with file:line citations
- [ ] Considered alternative interpretations

## Output Format

Generate a valid VerificationCertificate JSON with complete traces for both patches.`;

const FAULT_LOCALIZATION_TEMPLATE = `You are a fault localization engine using semi-formal reasoning.

## Task: Fault Localization

Given a FAILING TEST, identify the exact lines of code that contain the bug.

{{task_description}}

{{custom_instructions}}

## Approach

1. **Understand the Test**: What is it trying to verify?
2. **Trace the Failure**: Follow the execution to the failure point
3. **Analyze Dependencies**: What code does the failing path touch?
4. **Identify Root Cause**: Which line(s) cause the incorrect behavior?

## Structured Certificate (MANDATORY)

---

### DEFINITIONS

- D1: The BUG is the minimal set of code changes that makes all tests pass.
- D2: A SUSPICIOUS LOCATION is a line that could cause the observed failure.
- D3: FAULT LOCALIZATION ranks suspicious locations by likelihood.

### PREMISES

Test Analysis:
- P1: Test [name] fails with [error type]
- P2: The test expects [expected behavior]
- P3: The actual outcome is [actual behavior]
- P4: [Additional premises about test setup]

Code Analysis:
- P5: The test invokes [function] at [file:line]
- P6: [Additional code path premises with evidence]

### EXECUTION TRACES

Trace 1: Complete execution path to failure
- Entry: [test file:line]
- Step 1: [file:line] [function] - [behavior]
- Step 2: [file:line] [function] - [behavior]
  - Variable state: [key variables and values]
- Step N: [file:line] - FAILURE POINT
  - Error: [error details]
  - Expected: [what should have happened]
  - Actual: [what actually happened]
- Reasoning: [how execution led to failure]

Trace 2: What correct execution would look like
- Same structure showing the intended path
- Highlight where behavior should diverge

### SUSPICIOUS LOCATIONS (Ranked)

Rank 1: [file:line] [function]
- Score: [0-1]
- Why suspicious: [reasoning]
- Evidence: [execution trace evidence]
- Fix suggestion: [what change would fix it]

Rank 2: [file:line] [function]
[Same structure]

... continue for top 5-10 locations

### ROOT CAUSE ANALYSIS

Primary cause:
- Location: [file:line]
- Bug type: [null pointer / off-by-one / logic error / etc.]
- Explanation: [why this causes the failure]
- Fix: [description of correct code]

Contributing factors:
- [Other locations that contribute to the issue]

### ALTERNATIVE EXPLANATIONS CONSIDERED

- H1: [Alternative hypothesis]
  - Evidence against: [why this isn't the bug]
- H2: [Alternative hypothesis]
  - Evidence against: [why this isn't the bug]

### CONCLUSION

- The bug is located at: [file:line]
- Confidence: [high/medium/low]
- Reasoning: [summary of evidence]
- Answer: [location(s) of bug]

---

## RANKING CRITERIA

A location is suspicious if:
1. It executes when the failing test runs
2. It could produce the observed error
3. It's on the path from test entry to failure
4. It involves modified code (if applicable)

Score based on:
- Execution frequency in failing tests (higher = more suspicious)
- Distance from failure point (closer = more suspicious)
- Complexity (complex code = more likely buggy)
- Evidence strength (direct evidence = higher score)

## COMMON BUG PATTERNS

Watch for:
- [ ] Null pointer dereferences
- [ ] Off-by-one errors
- [ ] Incorrect boundary conditions
- [ ] Missing error handling
- [ ] Wrong variable used
- [ ] Incorrect operator (/ vs *, + vs -)
- [ ] Missing return statement
- [ ] Incorrect default value

## Output Format

Generate VerificationCertificate with focus on suspicious locations and root cause.`;

const CODE_QA_TEMPLATE = `You are a code question answering engine using semi-formal reasoning.

## Task: Code Question Answering

Answer a question about code behavior with detailed evidence.

{{task_description}}

Question: {{task_question}}

{{custom_instructions}}

## Structured Certificate (MANDATORY)

---

### DEFINITIONS

- D1: [Define key terms from the question]
- D2: [Define relevant code concepts]

### PREMISES

Code Facts:
- P1: [Claim about code structure] | Evidence: [file:line]
- P2: [Claim about function behavior] | Evidence: [file:line]
- P3: [Claim about data flow] | Evidence: [file:line]
- P4: [Additional premises]

### FUNCTION TRACE TABLE

| Function | File:Line | Verified Behavior | Evidence |
|----------|-----------|-------------------|----------|
| [func1]  | [loc]     | [what it does]    | [how verified] |
| [func2]  | [loc]     | [what it does]    | [how verified] |

### DATA FLOW ANALYSIS

Trace how data flows through the code:
- Input: [starting value/location]
- Step 1: [file:line] - [transformation]
- Step 2: [file:line] - [transformation]
- Output: [final value/location]

### SEMANTIC PROPERTIES

Key behavioral properties:
- Property 1: [invariant or behavior]
  - Evidence: [supporting evidence]
- Property 2: [invariant or behavior]
  - Evidence: [supporting evidence]

### EDGE CASES

- E1: [Edge case]
  - Behavior: [what happens]
  - Evidence: [supporting evidence]

### ALTERNATIVE HYPOTHESIS CHECK

Consider if there's another interpretation:
- Alternative: [different interpretation]
- Why incorrect: [counter-evidence]

### CONCLUSION

- Answer: [direct answer to the question]
- Explanation: [detailed explanation with evidence]
- Confidence: [high/medium/low]
- Limitations: [any caveats or unknowns]

---

## RULES

1. **Evidence Required**: Every claim must have file:line evidence
2. **Function Tracing**: Trace through every function mentioned
3. **Data Flow**: Show how values change through the code
4. **No Guessing**: If unsure, mark confidence as low
5. **Consider Alternatives**: Actively consider and reject wrong interpretations

## Output Format

Generate VerificationCertificate focused on answering the specific question.`;
