/**
 * GIZZI Verification System
 * 
 * Semi-formal verification based on Meta's Agentic Code Reasoning paper.
 * Combines empirical testing with logical reasoning for robust verification.
 */

import type {
  VerificationRequest,
  VerificationResult,
  VerificationCertificate,
  Verifier,
  VerificationType,
} from "./types"

export namespace Verification {
  // Registry of available verifiers
  const verifiers = new Map<VerificationType, Verifier[]>()

  /**
   * Register a verifier
   */
  export function register(verifier: Verifier): void {
    const list = verifiers.get(verifier.type) ?? []
    list.push(verifier)
    verifiers.set(verifier.type, list)
  }

  /**
   * Get registered verifiers for a type
   */
  export function getVerifiers(type: VerificationType): Verifier[] {
    return verifiers.get(type) ?? []
  }

  /**
   * Run verification
   */
  export async function run(
    request: VerificationRequest
  ): Promise<VerificationResult> {
    const typeVerifiers = getVerifiers(request.type)
    
    for (const verifier of typeVerifiers) {
      if (await verifier.canVerify(request.target)) {
        return verifier.verify(request)
      }
    }

    // No verifier found
    return {
      request,
      certificate: {
        id: request.id,
        timestamp: Date.now(),
        type: request.type,
        status: "error",
        premises: [],
        reasoning: [],
        conclusion: {
          statement: "No suitable verifier found",
          confidence: 0,
        },
        evidence: [],
        metadata: {
          verifier_version: "1.0.0",
          runtime_ms: 0,
          tokens_used: 0,
        },
      },
      passed: false,
      issues: [
        {
          severity: "error",
          message: `No verifier available for type: ${request.type}`,
        },
      ],
    }
  }

  /**
   * Quick empirical verification (test-based)
   */
  export async function empirical(
    target: string,
    context?: string
  ): Promise<VerificationResult> {
    return run({
      id: `emp-${Date.now()}`,
      target,
      type: "empirical",
      context,
      priority: "medium",
    })
  }

  /**
   * Deep semi-formal verification (reasoning-based)
   */
  export async function semiFormal(
    target: string,
    context?: string
  ): Promise<VerificationResult> {
    return run({
      id: `sf-${Date.now()}`,
      target,
      type: "semi-formal",
      context,
      priority: "high",
    })
  }
}

export * from "./types"
