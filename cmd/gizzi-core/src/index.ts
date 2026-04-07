/**
 * GIZZI Core
 * 
 * Central export for all GIZZI primitives.
 * 
 * Modules:
 *   - Brand: GIZZIBrand, GIZZICopy constants
 *   - Bus: Event bus for decoupled communication
 *   - Workspace: .gizzi/ workspace management
 *   - Continuity: Session handoff and context transfer
 *   - Verification: Semi-formal verification system
 */

// Brand
export { GIZZIBrand, GIZZICopy } from "./brand"
export type { GIZZIBrand as GIZZIBrandType, GIZZICopy as GIZZICopyType } from "./brand"

// Bus
export { Bus, BusEvent } from "./bus"
export * from "./bus/events"
export type * from "./bus/types"

// Workspace
export { Workspace } from "./workspace"
export type * from "./workspace/types"

// Continuity
export type * from "./continuity/types"

// Verification
export { Verification } from "./verification"
export type { 
  VerificationRequest,
  VerificationResult,
  VerificationCertificate,
  VerificationType,
  VerificationStatus,
  Premise,
  ReasoningStep,
  Conclusion,
  VerificationEvidence,
  VerificationMetadata,
  EmpiricalVerification,
  SemiFormalVerification,
  VerificationIssue,
  Verifier,
} from "./verification/types"

// UI Components
export { ShimmeringBanner } from "./ui/components/ShimmeringBanner"
