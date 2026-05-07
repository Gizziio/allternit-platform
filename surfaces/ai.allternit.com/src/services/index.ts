/**
 * Services
 * 
 * Business logic services ported from 6-ui/shell-ui Rust code.
 */

// Browser automation
export { BrowserEngine, type BrowserEngineOptions, createBrowserEngine, useBrowserEngine } from './browserEngine';

// Budget calculations
export { BudgetCalculator, type BudgetPercentages, calculateBudgetPercentages, createBudgetCalculator, defaultQuotaForm, formatBytes, formatHours } from './budgetCalculator';

// Pool management
export { PoolManager, type PoolManagerOptions, createDefaultPoolForm, createPoolManager } from './poolManager';

// Workflow engine
export { type LayoutOptions, type ValidationResult, WorkflowDesignerEngine, autoLayoutNodes, createWorkflowEngine, validateWorkflow } from './workflowEngine';

// Visual verification
export { type Artifact, type ArtifactType, type BatchVerificationRequest, type BatchVerificationResponse, type TrendDataPoint, type VerificationPolicy, type VerificationResult, type VerificationStatus, VerificationWebSocketClient, useVerificationWebSocket, visualVerificationApi } from './visualVerificationApi';
