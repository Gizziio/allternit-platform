/**
 * Certificate Validator
 * 
 * Validates verification certificates for completeness and correctness.
 */

import { Log } from "@/shared/util/log";
import type {
  VerificationCertificate,
  CertificateValidationResult,
  CertificateValidationError,
  CertificateValidationWarning,
} from "../types";

export class CertificateValidator {
  private log = Log.create({ service: "verification.certificate-validator" });
  
  /**
   * Validate a certificate
   */
  validate(certificate: VerificationCertificate): CertificateValidationResult {
    this.log.debug("Validating certificate", { certificateId: certificate.id });
    
    const errors: CertificateValidationError[] = [];
    const warnings: CertificateValidationWarning[] = [];
    
    // Validate structure
    this.validateStructure(certificate, errors, warnings);
    
    // Validate premises
    this.validatePremises(certificate, errors, warnings);
    
    // Validate execution traces
    this.validateExecutionTraces(certificate, errors, warnings);
    
    // Validate conclusion
    this.validateConclusion(certificate, errors, warnings);
    
    // Validate consistency
    this.validateConsistency(certificate, errors, warnings);
    
    // Calculate completeness
    const completeness = this.calculateCompleteness(certificate, errors);
    
    const result: CertificateValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      completeness,
      metrics: {
        premiseCount: certificate.premises.length,
        traceCount: certificate.executionTraces.length,
        avgEvidenceQuality: this.calculateEvidenceQuality(certificate),
        citationCoverage: this.calculateCitationCoverage(certificate),
      },
    };
    
    this.log.debug("Certificate validation complete", {
      certificateId: certificate.id,
      valid: result.valid,
      errors: errors.length,
      warnings: warnings.length,
      completeness,
    });
    
    return result;
  }
  
  // ========================================================================
  // Validation Methods
  // ========================================================================
  
  private validateStructure(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[],
    warnings: CertificateValidationWarning[]
  ): void {
    // Check required fields
    if (!certificate.id) {
      errors.push({
        code: "MISSING_ID",
        message: "Certificate is missing an ID",
        path: "id",
        severity: "critical",
      });
    }
    
    if (!certificate.timestamp) {
      errors.push({
        code: "MISSING_TIMESTAMP",
        message: "Certificate is missing a timestamp",
        path: "timestamp",
        severity: "error",
      });
    }
    
    if (!certificate.task) {
      errors.push({
        code: "MISSING_TASK",
        message: "Certificate is missing task information",
        path: "task",
        severity: "critical",
      });
    }
    
    if (!certificate.metadata) {
      errors.push({
        code: "MISSING_METADATA",
        message: "Certificate is missing metadata",
        path: "metadata",
        severity: "error",
      });
    }
    
    // Check version
    if (certificate.version !== "1.0") {
      warnings.push({
        code: "UNKNOWN_VERSION",
        message: `Unknown certificate version: ${certificate.version}`,
        path: "version",
      });
    }
  }
  
  private validatePremises(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[],
    warnings: CertificateValidationWarning[]
  ): void {
    if (certificate.premises.length === 0) {
      errors.push({
        code: "NO_PREMISES",
        message: "Certificate has no premises",
        path: "premises",
        severity: "critical",
        suggestion: "Add at least one premise with supporting evidence",
      });
      return;
    }
    
    const premiseIds = new Set<string>();
    
    for (let i = 0; i < certificate.premises.length; i++) {
      const premise = certificate.premises[i];
      const path = `premises[${i}]`;
      
      // Check ID
      if (!premise.id) {
        errors.push({
          code: "PREMISE_MISSING_ID",
          message: `Premise at index ${i} is missing an ID`,
          path: `${path}.id`,
          severity: "error",
        });
      } else {
        // Check for duplicates
        if (premiseIds.has(premise.id)) {
          errors.push({
            code: "DUPLICATE_PREMISE_ID",
            message: `Duplicate premise ID: ${premise.id}`,
            path: `${path}.id`,
            severity: "error",
          });
        }
        premiseIds.add(premise.id);
      }
      
      // Check statement
      if (!premise.statement || premise.statement.length < 10) {
        errors.push({
          code: "PREMISE_SHORT_STATEMENT",
          message: `Premise ${premise.id || i} has a very short statement`,
          path: `${path}.statement`,
          severity: "error",
          suggestion: "Provide a clear, detailed statement of the claim",
        });
      }
      
      // Check evidence
      if (!premise.evidence) {
        errors.push({
          code: "PREMISE_MISSING_EVIDENCE",
          message: `Premise ${premise.id || i} is missing evidence`,
          path: `${path}.evidence`,
          severity: "critical",
          suggestion: "Every premise must have supporting evidence",
        });
      } else {
        // Check evidence source locations
        if (premise.evidence.sourceLocations.length === 0) {
          errors.push({
            code: "EVIDENCE_NO_LOCATIONS",
            message: `Premise ${premise.id || i} evidence has no source locations`,
            path: `${path}.evidence.sourceLocations`,
            severity: "critical",
            suggestion: "Provide file:line citations for all evidence",
          });
        }
        
        // Check for assumed premises without good reason
        if (premise.certainty === "assumed" && premise.evidence.verificationMethod !== "assumption") {
          warnings.push({
            code: "ASSUMED_WITHOUT_REASON",
            message: `Premise ${premise.id || i} is marked as assumed but doesn't indicate why`,
            path: `${path}.certainty`,
            suggestion: "Explain why this premise must be assumed rather than proven",
          });
        }
      }
    }
    
    // Check that dependencies reference existing premises
    for (let i = 0; i < certificate.premises.length; i++) {
      const premise = certificate.premises[i];
      if (premise.dependsOn) {
        for (const depId of premise.dependsOn) {
          if (!premiseIds.has(depId)) {
            errors.push({
              code: "INVALID_DEPENDENCY",
              message: `Premise ${premise.id} depends on non-existent premise ${depId}`,
              path: `premises[${i}].dependsOn`,
              severity: "error",
            });
          }
        }
      }
    }
  }
  
  private validateExecutionTraces(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[],
    warnings: CertificateValidationWarning[]
  ): void {
    if (certificate.executionTraces.length === 0) {
      errors.push({
        code: "NO_TRACES",
        message: "Certificate has no execution traces",
        path: "executionTraces",
        severity: "critical",
        suggestion: "Add at least one execution trace showing code behavior",
      });
      return;
    }
    
    const traceIds = new Set<string>();
    
    for (let i = 0; i < certificate.executionTraces.length; i++) {
      const trace = certificate.executionTraces[i];
      const path = `executionTraces[${i}]`;
      
      // Check ID
      if (!trace.id) {
        errors.push({
          code: "TRACE_MISSING_ID",
          message: `Trace at index ${i} is missing an ID`,
          path: `${path}.id`,
          severity: "error",
        });
      } else if (traceIds.has(trace.id)) {
        errors.push({
          code: "DUPLICATE_TRACE_ID",
          message: `Duplicate trace ID: ${trace.id}`,
          path: `${path}.id`,
          severity: "error",
        });
      } else {
        traceIds.add(trace.id);
      }
      
      // Check scenario
      if (!trace.scenario || trace.scenario.length < 10) {
        warnings.push({
          code: "TRACE_SHORT_SCENARIO",
          message: `Trace ${trace.id || i} has a short scenario description`,
          path: `${path}.scenario`,
          suggestion: "Describe the scenario being traced in detail",
        });
      }
      
      // Check steps
      if (trace.steps.length === 0) {
        errors.push({
          code: "TRACE_NO_STEPS",
          message: `Trace ${trace.id || i} has no steps`,
          path: `${path}.steps`,
          severity: "critical",
          suggestion: "Add execution steps showing the code path",
        });
      } else {
        // Validate step numbers are sequential
        for (let j = 0; j < trace.steps.length; j++) {
          const step = trace.steps[j];
          if (step.stepNumber !== j + 1) {
            warnings.push({
              code: "TRACE_STEP_NUMBER_MISMATCH",
              message: `Step ${j} in trace ${trace.id} has stepNumber ${step.stepNumber}, expected ${j + 1}`,
              path: `${path}.steps[${j}].stepNumber`,
            });
          }
          
          // Check location
          if (!step.location || !step.location.file) {
            errors.push({
              code: "STEP_MISSING_LOCATION",
              message: `Step ${j} in trace ${trace.id} is missing file location`,
              path: `${path}.steps[${j}].location`,
              severity: "error",
            });
          }
        }
      }
      
      // Check outcome
      if (!trace.outcome) {
        errors.push({
          code: "TRACE_MISSING_OUTCOME",
          message: `Trace ${trace.id || i} is missing an outcome`,
          path: `${path}.outcome`,
          severity: "critical",
        });
      }
      
      // Check reasoning
      if (!trace.reasoning || trace.reasoning.length < 20) {
        warnings.push({
          code: "TRACE_SHORT_REASONING",
          message: `Trace ${trace.id || i} has short reasoning`,
          path: `${path}.reasoning`,
          suggestion: "Provide detailed reasoning about why this outcome occurs",
        });
      }
    }
  }
  
  private validateConclusion(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[],
    warnings: CertificateValidationWarning[]
  ): void {
    if (!certificate.conclusion) {
      errors.push({
        code: "MISSING_CONCLUSION",
        message: "Certificate is missing a conclusion",
        path: "conclusion",
        severity: "critical",
      });
      return;
    }
    
    // Check statement
    if (!certificate.conclusion.statement || certificate.conclusion.statement.length < 20) {
      errors.push({
        code: "CONCLUSION_SHORT_STATEMENT",
        message: "Conclusion statement is too short",
        path: "conclusion.statement",
        severity: "error",
        suggestion: "Provide a detailed conclusion statement",
      });
    }
    
    // Check answer
    if (!certificate.conclusion.answer) {
      errors.push({
        code: "CONCLUSION_MISSING_ANSWER",
        message: "Conclusion is missing an answer",
        path: "conclusion.answer",
        severity: "critical",
      });
    }
    
    // Check followsFrom references valid premises/traces
    if (!certificate.conclusion.followsFrom || certificate.conclusion.followsFrom.length === 0) {
      errors.push({
        code: "CONCLUSION_NO_PREMISES",
        message: "Conclusion does not cite any premises",
        path: "conclusion.followsFrom",
        severity: "critical",
        suggestion: "List the premise IDs that support this conclusion",
      });
    } else {
      const validIds = new Set([
        ...certificate.premises.map(p => p.id),
        ...certificate.executionTraces.map(t => t.id),
        ...certificate.definitions.map(d => d.id),
      ]);
      
      for (const ref of certificate.conclusion.followsFrom) {
        if (!validIds.has(ref)) {
          errors.push({
            code: "CONCLUSION_INVALID_REFERENCE",
            message: `Conclusion references non-existent item: ${ref}`,
            path: "conclusion.followsFrom",
            severity: "error",
          });
        }
      }
    }
    
    // Check confidence
    if (!certificate.conclusion.confidence) {
      errors.push({
        code: "CONCLUSION_MISSING_CONFIDENCE",
        message: "Conclusion is missing confidence information",
        path: "conclusion.confidence",
        severity: "error",
      });
    }
    
    // Check counterexample for negative conclusions
    if (certificate.conclusion.answer === "NO" && !certificate.counterexample) {
      errors.push({
        code: "NEGATIVE_WITHOUT_COUNTEREXAMPLE",
        message: "Conclusion is NO but no counterexample is provided",
        path: "counterexample",
        severity: "error",
        suggestion: "Provide a specific counterexample showing the failure",
      });
    }
    
    // Check counterexample validity
    if (certificate.counterexample) {
      if (!certificate.counterexample.location) {
        errors.push({
          code: "COUNTEREXAMPLE_NO_LOCATION",
          message: "Counterexample is missing a location",
          path: "counterexample.location",
          severity: "error",
        });
      }
      
      if (!certificate.counterexample.failureTrace || certificate.counterexample.failureTrace.length === 0) {
        errors.push({
          code: "COUNTEREXAMPLE_NO_TRACE",
          message: "Counterexample is missing a failure trace",
          path: "counterexample.failureTrace",
          severity: "error",
        });
      }
    }
  }
  
  private validateConsistency(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[],
    warnings: CertificateValidationWarning[]
  ): void {
    // Check that conclusion answer matches passed/failed logic
    const hasNegativeConclusion = certificate.conclusion.answer === "NO";
    const hasCounterexample = !!certificate.counterexample;
    
    if (hasNegativeConclusion && !hasCounterexample) {
      // Already reported in validateConclusion
    }
    
    // Check for traces that don't match any scenario
    const scenarios = new Set(certificate.executionTraces.map(t => t.scenario));
    if (scenarios.size < certificate.executionTraces.length) {
      warnings.push({
        code: "DUPLICATE_SCENARIOS",
        message: "Some execution traces have duplicate scenarios",
        path: "executionTraces",
        suggestion: "Each trace should cover a unique scenario or code path",
      });
    }
    
    // Check for edge cases not covered by traces
    for (const edgeCase of certificate.edgeCases) {
      const covered = certificate.executionTraces.some(t => 
        t.scenario.toLowerCase().includes(edgeCase.description.toLowerCase()) ||
        edgeCase.description.toLowerCase().includes(t.scenario.toLowerCase())
      );
      
      if (!covered) {
        warnings.push({
          code: "EDGE_CASE_NOT_TRACED",
          message: `Edge case "${edgeCase.description}" is not covered by any execution trace`,
          path: "edgeCases",
          suggestion: "Add an execution trace that demonstrates this edge case",
        });
      }
    }
  }
  
  // ========================================================================
  // Helper Methods
  // ========================================================================
  
  private calculateCompleteness(
    certificate: VerificationCertificate,
    errors: CertificateValidationError[]
  ): number {
    let score = 1.0;
    
    // Deduct for errors
    const criticalErrors = errors.filter(e => e.severity === "critical").length;
    const regularErrors = errors.filter(e => e.severity === "error").length;
    
    score -= criticalErrors * 0.2;
    score -= regularErrors * 0.1;
    
    // Deduct for missing components
    if (certificate.premises.length === 0) score -= 0.3;
    if (certificate.executionTraces.length === 0) score -= 0.3;
    if (!certificate.conclusion) score -= 0.3;
    
    // Deduct for sparse evidence
    const avgEvidenceLocations = certificate.premises.reduce(
      (sum, p) => sum + p.evidence?.sourceLocations.length || 0, 
      0
    ) / Math.max(1, certificate.premises.length);
    
    if (avgEvidenceLocations < 1) score -= 0.1;
    
    return Math.max(0, score);
  }
  
  private calculateEvidenceQuality(certificate: VerificationCertificate): number {
    if (certificate.premises.length === 0) return 0;
    
    const scores = certificate.premises.map(p => {
      if (!p.evidence) return 0;
      
      let score = 0;
      if (p.evidence.sourceLocations.length > 0) score += 0.4;
      if (p.evidence.verificationMethod !== "assumption") score += 0.3;
      if (p.certainty === "proven") score += 0.3;
      
      return score;
    });
    
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  private calculateCitationCoverage(certificate: VerificationCertificate): number {
    let totalPossible = 0;
    let totalCited = 0;
    
    // Check premises
    for (const premise of certificate.premises) {
      totalPossible++;
      if (premise.evidence?.sourceLocations.length > 0) {
        totalCited++;
      }
    }
    
    // Check trace steps
    for (const trace of certificate.executionTraces) {
      for (const step of trace.steps) {
        totalPossible++;
        if (step.location?.file && step.location?.line) {
          totalCited++;
        }
      }
    }
    
    return totalPossible > 0 ? totalCited / totalPossible : 0;
  }
}
