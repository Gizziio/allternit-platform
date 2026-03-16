import { Log } from "@/shared/util/log";
import { Planner } from "./planner";
import { Executor } from "./executor";
import { ContextPacker } from "@/runtime/context/pack";
import type { BudgetManager } from "./budget";
import type { 
  VerificationStrategy,
  OrchestratedVerificationResult,
} from "./verification";
import { VerificationOrchestrator } from "./verification-orchestrator";
import { storeVerification } from "./verification/store";
import type { VisualCaptureManagerOptions } from "@/runtime/verification/visual";

export interface TurnResult {
  status: "continue" | "completed" | "failed" | "needs_user";
  error?: Error;
  verification?: OrchestratedVerificationResult;
  /** Hash of the plan for loop detection */
  planHash?: string;
}

export interface TurnOptions {
  /**
   * Verification strategy to use
   * @default "adaptive"
   */
  verificationMode?: VerificationStrategy["mode"];
  
  /**
   * Whether to enable semi-formal verification
   * @default true
   */
  enableSemiFormal?: boolean;
  
  /**
   * Whether to store verification results
   * @default true
   */
  storeVerifications?: boolean;
  
  /**
   * Minimum confidence required for verification to pass
   * @default "medium"
   */
  minConfidence?: "high" | "medium" | "low";
  
  /**
   * Additional context for verification
   */
  verificationContext?: VerificationStrategy["context"];
  
  /**
   * Visual evidence capture configuration
   */
  visualCapture?: VisualCaptureManagerOptions;
}

export class Turn {
  private log = Log.create({ service: "runtime.turn" });
  private sessionId: string;
  private budget: BudgetManager;
  private options: TurnOptions;

  constructor(
    sessionId: string,
    budget: BudgetManager,
    options: TurnOptions = {}
  ) {
    this.sessionId = sessionId;
    this.budget = budget;
    this.options = options;
  }

  async execute(): Promise<TurnResult> {
    this.log.info("Executing production turn", { 
      sessionId: this.sessionId,
      verificationMode: this.options.verificationMode || "adaptive",
    });

    try {
      // 1. GATHER: Build the context pack with real snapshot
      const context = await ContextPacker.pack(this.sessionId, this.budget.getSnapshot());

      // 2. PLAN
      const planner = new Planner(this.sessionId);
      const plan = await planner.generatePlan(context);

      // 3. ACT: Returns receipts for each step
      const executor = new Executor(this.sessionId, this.budget);
      const receipts = await executor.run(plan);

      // 4. VERIFY: Use orchestrated verification (empirical + semi-formal)
      const strategy: VerificationStrategy = {
        mode: this.options.verificationMode || "adaptive",
        fallbackOnUncertainty: true,
        context: {
          description: this.options.verificationContext?.description || "Verify execution results",
          patches: this.options.verificationContext?.patches,
          testFiles: this.options.verificationContext?.testFiles,
        },
      };

      const orchestrator = new VerificationOrchestrator(this.sessionId, {
        mode: strategy.mode,
        visualCapture: this.options.visualCapture ?? { enabled: true },
      });
      const verification = await orchestrator.verify(plan, receipts, strategy.context);

      // Store verification result if enabled and we have a certificate
      if (this.options.storeVerifications !== false && verification.certificate) {
        try {
          await storeVerification(verification, this.sessionId, {
            type: "general",
            tags: [strategy.mode],
          });
        } catch (storeError) {
          this.log.warn("Failed to store verification", { error: storeError });
        }
      }

      // Check confidence requirement
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const requiredConfidence = confidenceOrder[this.options.minConfidence || "medium"];
      const actualConfidence = confidenceOrder[verification.confidence];
      const confidenceMet = actualConfidence >= requiredConfidence;

      // Determine status based on verification result
      if (verification.passed && confidenceMet) {
        this.log.info("Turn completed successfully", {
          confidence: verification.confidence,
          methods: verification.methodsUsed,
        });
        return { 
          status: "completed",
          verification,
        };
      }

      // Handle different next actions
      switch (verification.nextAction) {
        case "stop":
          // Verification failed but recommends stopping (high confidence failure)
          this.log.warn("Verification failed with high confidence", {
            reason: verification.reason,
            confidence: verification.confidence,
          });
          return { 
            status: "failed",
            verification,
          };
          
        case "ask_user":
          // Uncertain or disagreement - needs human review
          this.log.warn("Verification uncertain, needs user input", {
            reason: verification.reason,
            consensus: verification.consensus,
          });
          return { 
            status: "needs_user",
            verification,
          };
          
        case "replan":
          // Failed but can retry with new plan
          this.log.info("Verification failed, will replan", {
            reason: verification.reason,
          });
          return { 
            status: "continue",
            verification,
          };
          
        case "continue":
        default:
          // Continue with next turn
          this.log.info("Verification passed, continuing", {
            confidence: verification.confidence,
          });
          return { 
            status: "continue",
            verification,
          };
      }

    } catch (error) {
      this.log.error("Turn execution failed", { sessionId: this.sessionId, error });
      return { 
        status: "failed", 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  }
}
