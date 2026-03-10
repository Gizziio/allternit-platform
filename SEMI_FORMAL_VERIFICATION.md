# Semi-Formal Verification Implementation

Implementation of Meta's "Agentic Code Reasoning" approach for execution-free code verification in a2rchitech.

## Paper Reference

**Title:** Agentic Code Reasoning  
**Authors:** Shubham Ugare, Satish Chandra (Meta)  
**arXiv:** [2603.01896](https://arxiv.org/pdf/2603.01896)  
**Date:** March 2026

## Key Insight

Structured reasoning templates that force LLMs to show their work with explicit evidence can nearly halve error rates in code verification:

| Task | Standard | Semi-Formal | Improvement |
|------|----------|-------------|-------------|
| Patch Equivalence (curated) | 78% | 88% | +10pp |
| Patch Equivalence (real-world) | 86% | 93% | +7pp |
| Code Question Answering | 78% | 87% | +9pp |
| Fault Localization | baseline | +5-12pp Top-5 | significant |

## Implementation Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verification Orchestrator                     │
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐   │
│  │  Empirical   │    │   Semi-Formal    │    │   Adaptive   │   │
│  │  Verifier    │◄──►│   Verifier       │    │   Strategy   │   │
│  │  (tests)     │    │   (reasoning)    │    │   (default)  │   │
│  └──────────────┘    └──────────────────┘    └──────────────┘   │
│           │                   │                         │        │
│           └───────────────────┴─────────────────────────┘        │
│                           │                                      │
│                    ┌─────────────┐                               │
│                    │  Consensus  │                               │
│                    │   Engine    │                               │
│                    └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
          ┌─────────────────┐    ┌─────────────────┐
          │  Verification   │    │    Certificate  │
          │     Result      │    │      Store      │
          │  (pass/fail)    │    │  (persistent)   │
          └─────────────────┘    └─────────────────┘
```

### Core Components

1. **SemiFormalVerifier** (`src/runtime/loop/semi-formal-verifier.ts`)
   - Implements the structured certificate template
   - Forces explicit premises with file:line citations
   - Requires complete execution traces
   - Generates formal conclusions with evidence

2. **VerificationOrchestrator** (`src/runtime/loop/verification-orchestrator.ts`)
   - Coordinates between empirical and semi-formal verification
   - Supports 4 modes: empirical, semi-formal, both, adaptive
   - Handles fallback when semi-formal is uncertain
   - Detects method disagreement

3. **VerificationStore** (`src/runtime/loop/verification/store.ts`)
   - Persistent storage for certificates
   - Query and statistics capabilities
   - Ground truth feedback for accuracy tracking

4. **API Routes** (`src/runtime/server/routes/verification.ts`)
   - HTTP endpoints for verification
   - Patch equivalence verification
   - Certificate generation

## The Certificate Template

The core of semi-formal verification is a structured template the model must fill:

```
### DEFINITIONS
D1: Two patches are EQUIVALENT MODULO TESTS iff executing the 
    repository test suite produces identical pass/fail outcomes.

### PREMISES (with evidence)
P1: Patch 1 modifies django/utils/dateformat.py by changing 
    the year formatting logic.
    Evidence: dateformat.py:47-52 shows the format() call
    Verified by: Reading the source file

P2: The module-level format() function expects a datetime object.
    Evidence: dateformat.py:23 shows function signature
    Verified by: Tracing the function definition

### EXECUTION TRACES
Trace 1: Two-digit year formatting with year < 1000
- Entry: DateFormat.y() at dateformat.py:47
- Step 1: dateformat.py:47 - format(self.data.year, "04d")
  → Calls module format(), not builtin
- Step 2: dateformat.py:23 - format(value, fmt)
  → Creates DateFormat(value) where value=476
- Step 3: DateFormat.__init__ expects .year attribute
  → AttributeError on integer
- Outcome: FAIL (AttributeError)

Trace 2: Same scenario with Patch 2 (modulo arithmetic)
- Entry: DateFormat.y() at dateformat.py:47
- Step 1: Returns '%02d' % (self.data.year % 100)
  → Direct string formatting, no function call
- Outcome: PASS (returns "76")

### CONCLUSION
Statement: The patches are NOT equivalent. Patch 1 raises 
AttributeError for years < 1000 while Patch 2 handles them correctly.
Follows from: P1, P2, Trace 1, Trace 2
Answer: NO

### COUNTEREXAMPLE
Test: test_dateformat_two_digit_year_with_year_476
Patch 1: AttributeError: 'int' object has no attribute 'year'
Patch 2: Returns "76" (correct)
Location: dateformat.py:47
```

## Usage

### Basic Verification (Adaptive Mode)

```typescript
import { verifyWithAdaptiveStrategy } from "@/runtime/loop/verification";

const result = await verifyWithAdaptiveStrategy(
  sessionId,
  plan,
  receipts,
  {
    patches: [{ path: "src/file.ts", content: diff }],
    description: "Fix null pointer exception",
  }
);

console.log(result.passed);      // true/false
console.log(result.confidence);  // "high" | "medium" | "low"
console.log(result.reason);      // Human-readable explanation
```

### Patch Equivalence (The Meta Use Case)

```typescript
import { VerificationOrchestrator } from "@/runtime/loop/verification";

const orchestrator = new VerificationOrchestrator(sessionId, {
  mode: "semi-formal",
});

const result = await orchestrator.verifyPatchEquivalence(
  {
    path: "django/utils/dateformat.py",
    diff: "...patch 1 diff...",
    description: "Uses format() for year formatting",
  },
  {
    path: "django/utils/dateformat.py", 
    diff: "...patch 2 diff...",
    description: "Uses modulo arithmetic for year formatting",
  },
  {
    repositoryContext: "Django date formatting utilities",
    relevantTests: ["test_dateformat_two_digit_year"],
    testPatch: "...test diff...",
  }
);

// Check if patches produce same outcomes
console.log(result.passed);  // true if equivalent
```

### Running Both Methods

```typescript
const orchestrator = new VerificationOrchestrator(sessionId, {
  mode: "both",  // Run both empirical and semi-formal
});

const result = await orchestrator.verify(plan, receipts);

if (!result.consensus) {
  // Methods disagree - requires human review
  console.log("WARNING: Verification methods disagree!");
  console.log("Empirical:", result.empiricalResult?.passed);
  console.log("Semi-formal:", result.semiFormalResult?.passed);
}
```

## Verification Modes

### 1. Empirical (Traditional)
- Runs actual tests
- Measures outcomes
- High confidence but requires sandbox

### 2. Semi-Formal (Meta's Approach)
- Analyzes code structure
- Traces execution paths
- No execution required (faster)
- 93% accuracy on real-world patches

### 3. Both
- Runs both methods
- Compares results
- Detects disagreements
- Highest confidence when they agree

### 4. Adaptive (Default)
- Tries semi-formal first
- Falls back to empirical if uncertain
- Optimal balance of speed and accuracy

## Storage and Persistence

Verifications are stored with full certificates:

```typescript
import { 
  storeVerification, 
  queryVerifications,
  confirmVerification,
  getVerificationStats 
} from "@/runtime/loop/verification";

// Store a verification
const id = await storeVerification(result, sessionId, {
  type: "patch_equivalence",
  tags: ["critical", "production"],
});

// Query historical verifications
const recent = await queryVerifications({
  type: "patch_equivalence",
  since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  confidence: "high",
});

// Provide ground truth feedback
await confirmVerification(id, true, "human@example.com");

// Get accuracy statistics
const stats = await getVerificationStats();
console.log(stats.confirmedCorrect / stats.total);  // Accuracy rate
```

## API Endpoints

### POST /verification/verify
General verification with configurable mode.

### POST /verification/patch-equivalence
Specific endpoint for patch equivalence verification.

### POST /verification/certificate
Generate a standalone verification certificate.

### GET /verification/template
Get the semi-formal verification prompt template.

## Integration with Existing a2rchitech

The verification system integrates with:

1. **Runtime Loop**: Can replace or augment the existing verifier
2. **Session Management**: Tracks verifications per session
3. **Tool System**: Can verify tool execution results
4. **Agent System**: Builder-Validator pattern validation

## Failure Modes (From Meta Paper)

Even with semi-formal reasoning, watch for:

1. **Incomplete Execution Tracing**
   - Agent assumes function behavior without fully tracing
   - *Mitigation*: Certificate requires code paths for every claim

2. **Third-Party Library Semantics**
   - Agent guesses behavior when source unavailable
   - *Mitigation*: Flag uncertainties in certificate

3. **Dismissing Subtle Differences**
   - Agent identifies difference but incorrectly deems it irrelevant
   - *Mitigation*: Require explicit analysis of all differences

4. **Overconfident Wrong Answers**
   - Thorough but incomplete reasoning leads to confident errors
   - *Mitigation*: Confidence scoring, method consensus

## Trade-offs

| Aspect | Empirical | Semi-Formal | Both |
|--------|-----------|-------------|------|
| Speed | Slow (sandbox) | Fast (reasoning) | Slowest |
| Accuracy | High | High (93%) | Highest |
| Cost (compute) | High (execution) | Medium (LLM) | Highest |
| Cost (time) | High | Low | High |
| Coverage | Tests only | All code paths | Complete |
| Sandbox Required | Yes | No | Yes |

## Future Enhancements

1. **Fine-tuning**: Train models to internalize certificate structure
2. **Hybrid Verification**: Combine with lightweight symbolic execution
3. **Learning from Feedback**: Use confirmed verifications to improve prompts
4. **Parallel Verification**: Run multiple certificate attempts, vote
5. **Domain-Specific Templates**: Specialized certificates for security, performance, etc.

## References

1. Ugare & Chandra. "Agentic Code Reasoning." arXiv:2603.01896, 2026.
2. Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in LLMs." NeurIPS 2022.
3. Yang et al. "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering." NeurIPS 2024.

---

**Implementation Date:** March 2026  
**Status:** Production Ready  
**Maintainer:** a2rchitech Core Team
