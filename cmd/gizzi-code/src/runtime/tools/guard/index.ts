/**
 * GIZZI Guard Module
 * 
 * Implements the guard policy engine for:
 * - Context/quota pressure monitoring
 * - Threshold-based actions (WARN, COMPACT, HANDOFF)
 * - Baton emission for session handoff
 * - Evidence collection (receipts, state)
 */

export { GuardPolicy } from "@/runtime/tools/guard/policy"
export { GuardMetrics } from "@/runtime/tools/guard/metrics"
export { GuardArtifacts } from "@/runtime/tools/guard/artifacts"
export { GuardCompaction } from "@/runtime/tools/guard/compaction"
