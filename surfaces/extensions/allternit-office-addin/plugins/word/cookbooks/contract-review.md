# Cookbook: Contract Review and Redline

## Prerequisites
- A contract, agreement, or legal document is open
- You want AI-assisted review with tracked changes

---

## Step 1: Read Document Structure

**Command**: `word:structure` → "show me the structure of this contract"

Typical contract sections to verify:
- [ ] Parties (definitions section)
- [ ] Recitals / Background
- [ ] Definitions
- [ ] Term and Termination
- [ ] Scope of Services / Obligations
- [ ] Payment Terms
- [ ] Intellectual Property / Ownership
- [ ] Confidentiality / NDA
- [ ] Liability and Indemnification
- [ ] Dispute Resolution
- [ ] Governing Law
- [ ] Signatures

Flag any missing sections.

---

## Step 2: Summarize Key Terms

**Command**: `word:summarize` → "summarize the key terms of this contract — parties, dates, payment, obligations"

The summary covers:
- Who are the parties?
- What is the effective date and term?
- What are the core obligations of each party?
- What are the payment terms?
- What are the termination conditions?
- What IP provisions are included?

---

## Step 3: Identify Risk Areas

**Command**: `word:improve` → "review for legal risk — flag one-sided clauses, missing protections, and unusual terms"

Common flags:
- Unlimited liability clauses
- Overly broad IP assignment ("all work product ever")
- No limitation on scope ("as directed by Client from time to time")
- Auto-renewal without notice requirement
- Missing arbitration/mediation step before litigation
- Jurisdiction choices that disadvantage one party

---

## Step 4: Redline Problematic Clauses

**Command**: `word:redline` → "redline the liability clause to add a cap at 2× contract value"

Example redline sequence:
```
1. word:redline → "add mutual limitation of liability at 2× annual fees"
2. word:redline → "soften the IP assignment — change 'all work product' to 'work product created specifically for this engagement'"
3. word:redline → "add 30-day cure period before termination for cause"
```

All changes tracked — review in Review tab.

---

## Step 5: Generate Summary of Changes

After redlining:
**Command**: `word:summarize` → "summarize all the tracked changes I should review"

Output:
```
## Changes Made (Tracked)
1. Liability cap: added mutual cap at 2× annual contract value (§8.2)
2. IP assignment: narrowed to "engagement-specific work product" (§9.1)
3. Termination for cause: added 30-day written cure notice period (§12.3)

Review and accept/reject each change in Review → Track Changes → Show Markup
```

---

## Step 6: Template Population (if NDA/MSA Template)

**Command**: `word:template` → "fill in: Party A = Allternit Inc, Party B = Acme Corp, Effective Date = April 7 2026, Governing Law = Delaware"

---

## Important Caveats
- This plugin provides drafting assistance, not legal advice
- All tracked changes should be reviewed by qualified legal counsel before signing
- Do not rely on AI-generated clause language for high-stakes contracts without attorney review
