/**
 * Verification Module Tests
 * 
 * Basic smoke tests for the verification module structure.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import {
  // Types
  type VerificationCertificate,
  type VerificationResult,
  type OrchestratedVerificationResult,
  
  // Verifiers
  SemiFormalVerifier,
  EmpiricalVerifier,
  VerificationOrchestrator,
  
  // Storage
  VerificationStore,
  
  // Utils
  formatCertificate,
  calculateConfidence,
  
  // Config
  loadConfig,
  setConfig,
  resetConfig,
  createDevConfig,
  createProdConfig,
  
  // Quick start
  quickVerify,
  VERSION,
} from "../index";

// ============================================================================
// Configuration Tests
// ============================================================================

describe("Configuration", () => {
  afterEach(() => {
    resetConfig();
  });
  
  it("should create dev config", () => {
    const config = createDevConfig();
    expect(config.defaultMode).toBe("both");
    expect(config.storage.backend).toBe("file");
    expect(config.semiFormal.model).toBe("claude-sonnet-4");
  });
  
  it("should create prod config", () => {
    const config = createProdConfig();
    expect(config.defaultMode).toBe("adaptive");
    expect(config.semiFormal.highConfidenceThreshold).toBe(0.90);
    expect(config.empirical.requireCoverage).toBe(true);
  });
  
  it("should load and get config", async () => {
    const config = createDevConfig();
    setConfig(config);
    
    const { getConfig } = await import("../index");
    expect(getConfig()).toBe(config);
  });
});

// ============================================================================
// Type Exports
// ============================================================================

describe("Type Exports", () => {
  it("should export certificate types", () => {
    // Type-only test - just ensure types compile
    const certificate: Partial<VerificationCertificate> = {
      definitions: {
        whatIsBeingVerified: "Test",
        correctnessCriteria: "Test criteria",
      },
      premises: [],
      executionTraces: [],
      edgeCases: [],
      conclusion: {
        verdict: "YES",
        evidence: "Test evidence",
        confidence: 0.9,
      },
    };
    
    expect(certificate).toBeDefined();
  });
  
  it("should export verification result types", () => {
    const result: Partial<OrchestratedVerificationResult> = {
      passed: true,
      confidence: "high",
      reason: "Test passed",
      methodsUsed: ["semi-formal"],
      consensus: true,
    };
    
    expect(result).toBeDefined();
  });
});

// ============================================================================
// Verifier Tests
// ============================================================================

describe("Verifiers", () => {
  it("should instantiate SemiFormalVerifier", () => {
    const verifier = new SemiFormalVerifier("test-session", {
      model: "test-model",
      maxTraceDepth: 5,
    });
    
    expect(verifier).toBeDefined();
  });
  
  it("should instantiate EmpiricalVerifier", () => {
    const verifier = new EmpiricalVerifier("test-session", {
      testRunner: "npm test",
      timeout: 60000,
    });
    
    expect(verifier).toBeDefined();
  });
  
  it("should instantiate VerificationOrchestrator", () => {
    const orchestrator = new VerificationOrchestrator("test-session", {
      mode: "semi-formal",
    });
    
    expect(orchestrator).toBeDefined();
  });
});

// ============================================================================
// Storage Tests
// ============================================================================

describe("Storage", () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "verification-test-"));
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  it("should create storage instance", async () => {
    const store = VerificationStore.getInstance({
      backend: "file",
      storageDir: tempDir,
    });
    
    expect(store).toBeDefined();
  });
  
  it("should store and retrieve verification", async () => {
    const store = VerificationStore.getInstance({
      backend: "file",
      storageDir: tempDir,
    });
    
    const result: VerificationResult = {
      passed: true,
      confidence: "high",
      reason: "Test passed",
      method: "semi-formal",
      timestamp: new Date().toISOString(),
      context: {
        description: "Test verification",
      },
    };
    
    const stored = await store.store(result);
    expect(stored.id).toBeDefined();
    
    const retrieved = await store.get(stored.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.result.passed).toBe(true);
  });
});

// ============================================================================
// Utility Tests
// ============================================================================

describe("Utilities", () => {
  describe("formatCertificate", () => {
    it("should format certificate to string", () => {
      const certificate: VerificationCertificate = {
        definitions: {
          whatIsBeingVerified: "Test",
          correctnessCriteria: "Criteria",
        },
        premises: [
          { claim: "Test claim", evidence: "file.ts:1", source: "code" },
        ],
        executionTraces: [],
        edgeCases: [],
        conclusion: {
          verdict: "YES",
          evidence: "Evidence",
          confidence: 0.9,
        },
      };
      
      const formatted = formatCertificate(certificate);
      expect(typeof formatted).toBe("string");
      expect(formatted).toContain("Test");
      expect(formatted).toContain("YES");
    });
  });
  
  describe("calculateConfidence", () => {
    it("should calculate certificate confidence", () => {
      const certificate: VerificationCertificate = {
        definitions: {
          whatIsBeingVerified: "Test",
          correctnessCriteria: "Criteria",
        },
        premises: [
          { claim: "Claim 1", evidence: "file.ts:1", source: "code" },
          { claim: "Claim 2", evidence: "file.ts:2", source: "code" },
        ],
        executionTraces: [
          {
            scenario: "Test scenario",
            path: ["step1", "step2"],
            result: "success",
          },
        ],
        edgeCases: [],
        conclusion: {
          verdict: "YES",
          evidence: "Evidence",
          confidence: 0.85,
        },
      };
      
      const score = calculateConfidence(certificate);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// Quick Verify Tests
// ============================================================================

describe("quickVerify", () => {
  it("should be exported", () => {
    expect(typeof quickVerify).toBe("function");
  });
  
  // Note: Actual verification requires LLM calls, so we just test the export
  // Integration tests would test the actual functionality
});

// ============================================================================
// Version
// ============================================================================

describe("Version", () => {
  it("should export version", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
