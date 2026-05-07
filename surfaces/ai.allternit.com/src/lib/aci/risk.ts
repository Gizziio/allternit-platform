/**
 * ACI Risk Classifier
 *
 * Classifies each ACI action into a risk tier (T0–T4) before execution.
 * T0 = safe read-only, T4 = critical irreversible.
 *
 * Approval gates:
 *   T0–T2 → auto-execute (logged)
 *   T3    → pause → require user approval
 *   T4    → hard block unless explicitly enabled
 */

import type { AciAction, AciActionType, RiskTier } from './types';

// ─────────────────────────────────────────────────────────────
// Base tier by action type
// ─────────────────────────────────────────────────────────────

const BASE_TIER: Partial<Record<AciActionType, RiskTier>> = {
  // T0 — purely read-only
  screenshot:  0,
  observe:     0,
  extract:     0,
  tab_list:    0,

  // T1 — low-risk navigation
  navigate:    1,
  hover:       1,
  scroll:      1,
  tab_switch:  1,

  // T2 — interaction, reversible
  click:       2,
  double_click:2,
  right_click: 2,
  type:        2,
  key:         2,
  hotkey:      2,
  drag:        2,
  tab_create:  1,

  // T3 — potentially irreversible
  tab_close:   3,

  // Done — meta, no risk
  done:        0,
};

// ─────────────────────────────────────────────────────────────
// Heuristic escalation rules
// ─────────────────────────────────────────────────────────────

/** Selectors that indicate sensitive form fields → escalate type to T3 */
const SENSITIVE_SELECTOR_PATTERNS = [
  /password/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv|cvc/i,
  /ssn|social.security/i,
  /billing/i,
  /payment/i,
];

/** URLs that indicate purchasing / destructive flows → escalate navigate to T3 */
const HIGH_RISK_URL_PATTERNS = [
  /checkout/i,
  /purchase/i,
  /buy.now/i,
  /confirm.order/i,
  /delete/i,
  /remove/i,
  /unsubscribe/i,
  /cancel.account/i,
];

/** Button labels that indicate T3/T4 submit-like actions */
const HIGH_RISK_LABEL_PATTERNS = [
  /submit/i,
  /confirm/i,
  /place.order/i,
  /buy/i,
  /purchase/i,
  /pay/i,
  /delete/i,
  /remove/i,
  /deactivate/i,
];

const CRITICAL_LABEL_PATTERNS = [
  /delete.account/i,
  /terminate/i,
  /destroy/i,
  /wipe/i,
  /format/i,
];

// ─────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────

export function classifyRisk(action: AciAction): RiskTier {
  const base: RiskTier = BASE_TIER[action.type] ?? 2;

  // Check for T4 critical patterns first
  if (action.label) {
    for (const pattern of CRITICAL_LABEL_PATTERNS) {
      if (pattern.test(action.label)) return 4;
    }
  }

  // Escalate type actions on sensitive selectors → T3
  if (action.type === 'type' && action.selector) {
    for (const pattern of SENSITIVE_SELECTOR_PATTERNS) {
      if (pattern.test(action.selector)) return 3;
    }
  }

  // Escalate navigate to high-risk URLs → T3
  if (action.type === 'navigate' && action.url) {
    for (const pattern of HIGH_RISK_URL_PATTERNS) {
      if (pattern.test(action.url)) return 3;
    }
  }

  // Escalate click on high-risk labeled buttons → T3
  if ((action.type === 'click' || action.type === 'double_click') && action.label) {
    for (const pattern of HIGH_RISK_LABEL_PATTERNS) {
      if (pattern.test(action.label)) return 3;
    }
  }

  return base;
}

/** Returns true if the action requires explicit user approval before executing */
export function requiresApproval(tier: RiskTier, approvalThreshold: RiskTier = 3): boolean {
  return tier >= approvalThreshold;
}
