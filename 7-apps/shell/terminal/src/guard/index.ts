/**
 * A2R Guard Module
 * 
 * Implements the guard policy engine for:
 * - Context/quota pressure monitoring
 * - Threshold-based actions (WARN, COMPACT, HANDOFF)
 * - Baton emission for session handoff
 * - Evidence collection (receipts, state)
 */

export { GuardPolicy } from "./policy"
export { GuardMetrics } from "./metrics"
export { GuardArtifacts } from "./artifacts"
export { GuardCompaction } from "./compaction"
