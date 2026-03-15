# A2R Computer Use — Threat Model

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

## Scope
Threats specific to automated browser and desktop workflows (v0.1). Retrieval and hybrid workflow threats will be added in v0.2 when those families are implemented.

## v0.1 Threat Coverage

All 8 threats below apply to the current v0.1 implementation. T1 and T8 are partially mitigated because browser-use (LLM-driven) and UI-TARS adapters are not yet production-grade.

## T1: Prompt Injection via Web Content
**Vector:** Malicious website content injects instructions into LLM-powered adapters (browser-use, UI-TARS).
**Impact:** Adapter performs unintended actions — data exfiltration, credential theft, navigation to malicious sites.
**Mitigation:**
- Policy engine evaluates all actions before execution (G2)
- Domain denylist enforcement (P-001)
- Destructive action approval gate (P-002)
- Receipt trail for forensic review (G3)

## T2: Domain Escape
**Vector:** Adapter navigates outside allowed domain set during execution.
**Impact:** Unauthorized access to internal systems, credential exposure.
**Mitigation:**
- Domain allowlist/denylist in policy rules
- URL validation before each navigation action
- Route decision receipt tracks all navigation targets

## T3: Destructive Actions
**Vector:** Adapter performs delete, submit payment, send message, or other irreversible actions without user approval.
**Impact:** Data loss, financial loss, unauthorized communications.
**Mitigation:**
- Destructive action keywords trigger require_approval (P-002)
- High-risk adapters force headed + user-present mode (P-003)
- Receipt with before/after evidence for all destructive actions

## T4: Auth Leakage
**Vector:** Credentials stored in session leak to another session or adapter.
**Impact:** Unauthorized access, privilege escalation.
**Mitigation:**
- auth_ref is a reference, never inline credentials (session contract)
- Cross-session auth blocked (P-004)
- Session isolation enforced (P-007)

## T5: Artifact Exfiltration
**Vector:** Adapter writes artifacts (screenshots, downloads, extracted data) outside declared artifact_root.
**Impact:** Data leakage, unauthorized file access.
**Mitigation:**
- Artifact path enforcement (P-005)
- Session artifact_root is isolated per session
- Receipt tracks all artifact references

## T6: Unsafe Fallback Chains
**Vector:** Primary adapter fails, fallback adapter has weaker security posture.
**Impact:** Policy bypass via less restrictive adapter.
**Mitigation:**
- Fallback chain is policy-aware — each fallback re-evaluated by policy engine
- Policy-sensitive tasks fail closed (no fallback)
- Experimental adapters excluded from fallback chains

## T7: Session Hijacking
**Vector:** Attacker gains access to session_id and uses it to control an active automation session.
**Impact:** Unauthorized control of browser/desktop, data theft.
**Mitigation:**
- Session IDs are UUIDs (not guessable)
- Session manager enforces lifecycle (destroyed sessions cannot be reused)
- API key verification on operator endpoints

## T8: VLM Model Poisoning
**Vector:** Compromised or manipulated VLM returns malicious action proposals.
**Impact:** Desktop/browser automation performs attacker-controlled actions.
**Mitigation:**
- Action proposals pass through policy engine before execution
- All vision-proposed actions emit receipts
- Human-in-the-loop for high-risk vision actions
