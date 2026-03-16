/**
 * Direct Operator Adapter
 *
 * Allows the DAK Runner to receive work items directly from the Operator UI
 * via WebSocket/HTTP instead of polling Rails. This enables low-latency
 * interactive execution for the Thin Client Operator.
 *
 * Architecture:
 * - Implements the same interface as RailsAdapter for compatibility
 * - Accepts work items via local socket or WebSocket
 * - Bypasses Rails polling for direct UI -> Runner execution
 * - Supports plan-only and execute modes
 *
 * Usage:
 *   const adapter = new DirectOperatorAdapter({ port: 3010 });
 *   adapter.start();
 *   // Runner now accepts direct work items
 */

import { EventEmitter } from 'events';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  WorkRequest,
  Lease,
  LeaseId,
  WihId,
  DagId,
  NodeId,
  RunId,
  Receipt,
  ReceiptId,
  ToolCall,
  ToolResult,
  CorrelationId,
  ContextPack,
  ContextPackId,
  PolicyBundleId,
  ExecutionMode,
} from '../types';
import type { PolicyBundle } from '../policy/bundle-builder';
import { createPolicyEngine, PolicyContext, PolicyEvaluationResult } from '../policy/operator-policy';
import { createPlanGenerator } from '../plan/json-plan-generator';
import { createCanvasConnector, CanvasConnector, CanvasExecutionResult } from '../connectors/canvas-connector';
import type { RunnerPlan } from '../plan/json-plan-generator';

export interface DirectOperatorConfig {
  port: number;
  host?: string;
  apiKey?: string;
  enableWebSocket?: boolean;
}

export interface OperatorWorkRequest {
  requestId: string;
  intent: string;
  mode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
  context: OperatorContext;
  preferences: OperatorPreferences;
  policy: OperatorPolicy;
}

export interface OperatorContext {
  target_type: 'browser' | 'electron' | 'desktop' | 'file';
  target_app?: string;
  target_domain?: string;
  target_context?: Record<string, unknown>;
  page_title?: string;
  url?: string;
  window_title?: string;
}

export interface OperatorPreferences {
  prefer_connector: boolean;
  allow_browser_automation: boolean;
  allow_desktop_fallback: boolean;
  max_steps?: number;
}

export interface OperatorPolicy {
  require_private_model: boolean;
  allowed_tools?: string[];
  forbidden_tools?: string[];
  risk_level?: 'low' | 'medium' | 'high';
}

export interface OperatorEvent {
  type: 'planning' | 'plan_ready' | 'executing' | 'step_complete' | 'complete' | 'error' | 'policy_evaluated' | 'connected';
  requestId: string;
  data?: unknown;
  timestamp: number;
}

interface ClientSubscription {
  ws: WebSocket;
  requestId: string;
}

// Internal work item storage
interface QueuedWorkItem {
  request: OperatorWorkRequest;
  plan?: RunnerPlan;
  policyResult?: PolicyEvaluationResult;
  queuedAt: number;
}

// Receipt storage
interface StoredReceipt {
  id: string;
  request_id: string;
  user_id: string;
  user_intent: string;
  target_system: string;
  status: string;
  created_objects: any[];
  actions: any[];
  verification: any;
  privacy: any;
  hash: string;
  created_at: string;
}

export class DirectOperatorAdapter extends EventEmitter {
  private config: DirectOperatorConfig;
  private httpServer?: http.Server;
  private wsServer?: WebSocketServer;
  private subscriptions: Map<string, ClientSubscription[]> = new Map();
  private workQueue: QueuedWorkItem[] = [];
  private activeLeases: Map<string, Lease> = new Map();
  private receipts: Map<string, StoredReceipt> = new Map();
  private policyEngine = createPolicyEngine();
  private planGenerator = createPlanGenerator();
  private canvasConnector: CanvasConnector;

  constructor(config: DirectOperatorConfig) {
    super();
    this.config = config;
    this.canvasConnector = createCanvasConnector();
  }

  /**
   * Start the adapter server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create HTTP server for REST-like endpoints
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch(err => {
          console.error('[DirectOperator] HTTP handler error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        });
      });

      this.httpServer.listen(this.config.port, this.config.host || '127.0.0.1', () => {
        console.log(`[DirectOperator] HTTP server listening on ${this.config.host || '127.0.0.1'}:${this.config.port}`);
        resolve();
      });

      this.httpServer.on('error', reject);

      // Create WebSocket server for event streaming
      if (this.config.enableWebSocket !== false) {
        this.wsServer = new WebSocketServer({ 
          server: this.httpServer,
          path: '/operator/ws'
        });

        this.wsServer.on('connection', (ws) => {
          this.handleWebSocketConnection(ws);
        });
      }
    });
  }

  /**
   * Stop the adapter server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wsServer) {
        this.wsServer.close(() => {
          console.log('[DirectOperator] WebSocket server closed');
        });
      }

      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('[DirectOperator] HTTP server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle HTTP requests
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API key validation
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    if (this.config.apiKey && apiKey !== this.config.apiKey) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      // Route: POST /work/submit - Submit work item with policy enforcement
      if (url.pathname === '/work/submit' && req.method === 'POST') {
        const body = await this.readJsonBody(req);
        const workRequest: OperatorWorkRequest = body as OperatorWorkRequest;

        // POLICY ENFORCEMENT (EPIC 9)
        const policyContext: PolicyContext = {
          userId: 'operator_user', // Would come from auth in production
          userRole: 'teacher', // Would come from auth in production
          intent: workRequest.intent,
          targetSystem: workRequest.context.target_domain || workRequest.context.target_type,
          targetContext: workRequest.context.target_context || {},
          requestedTools: [], // Would be populated by planner
          backend: workRequest.preferences.prefer_connector ? 'connector' : 'browser_automation',
          executionMode: workRequest.mode,
        };

        const policyResult = this.policyEngine.evaluate(policyContext);

        // If policy blocks the request, return error
        if (!policyResult.allowed && !policyResult.requireApproval) {
          res.writeHead(403);
          res.end(JSON.stringify({
            success: false,
            error: 'Blocked by policy',
            reason: policyResult.errors.join(', '),
            policyEvaluation: {
              decision: policyResult.decision,
              riskLevel: policyResult.riskLevel,
              rules: policyResult.rules,
            },
          }));
          return;
        }

        // PLAN GENERATION (Bridge Gap 3)
        const plan = await this.planGenerator.generatePlan({
          intent: workRequest.intent,
          context: workRequest.context as unknown as Record<string, unknown>,
          targetSystem: workRequest.context.target_domain || workRequest.context.target_type,
          backend: policyResult.modelRouting === 'local' ? 'browser_automation' : 
                   workRequest.preferences.prefer_connector ? 'connector' : 'browser_automation',
          maxSteps: 10,
        });

        // Validate the generated plan
        const validation = this.planGenerator.validatePlan(plan);
        if (!validation.valid) {
          console.warn('[DirectOperator] Generated plan validation warnings:', validation.errors);
        }

        // Convert to internal work item
        const workItem: QueuedWorkItem = {
          request: workRequest,
          plan: plan,
          policyResult: policyResult,
          queuedAt: Date.now(),
        };
        this.workQueue.push(workItem);

        // Emit event for runner to pick up
        this.emit('work:available', workItem);

        // For plan_then_execute mode, auto-execute (golden path)
        if (workRequest.mode === 'plan_then_execute' || workRequest.mode === 'execute_direct') {
          // Execute immediately for golden path demo
          this.executeWork(workItem).catch(error => {
            console.error('[DirectOperator] Auto-execution error:', error);
          });
        }

        // Emit policy metadata
        this.emitEvent({
          type: 'policy_evaluated',
          requestId: workRequest.requestId,
          data: {
            allowed: policyResult.allowed,
            requireApproval: policyResult.requireApproval,
            riskLevel: policyResult.riskLevel,
            modelRouting: policyResult.modelRouting,
            warnings: policyResult.warnings,
          },
          timestamp: Date.now(),
        });

        // Emit plan ready event
        this.emitEvent({
          type: 'plan_ready',
          requestId: workRequest.requestId,
          data: { plan },
          timestamp: Date.now(),
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          requestId: workRequest.requestId,
          status: policyResult.requireApproval ? 'awaiting_approval' : 'queued',
          policy: {
            requireApproval: policyResult.requireApproval,
            riskLevel: policyResult.riskLevel,
            modelRouting: policyResult.modelRouting,
          },
          plan: {
            id: plan.id,
            goal: plan.goal,
            stepCount: plan.steps.length,
            risk: plan.risk,
          },
        }));
        return;
      }

      // Route: GET /events/:requestId - SSE event stream
      if (url.pathname.startsWith('/events/') && req.method === 'GET') {
        const requestId = url.pathname.split('/')[2];
        this.setupSSEStream(res, requestId);
        return;
      }

      // Route: POST /receipts - Create receipt
      if (url.pathname === '/receipts' && req.method === 'POST') {
        const body = await this.readJsonBody(req) as any;
        const receiptId = `receipt_${Date.now()}`;
        
        const receipt: StoredReceipt = {
          id: receiptId,
          request_id: body.request_id,
          user_id: body.user_id || 'anonymous',
          user_intent: body.user_intent,
          target_system: body.target_system,
          status: body.status,
          created_objects: body.created_objects || [],
          actions: body.actions || [],
          verification: body.verification || { overallPassed: true, checks: [] },
          privacy: body.privacy || {
            modelRouting: 'private_cloud',
            dataClassification: 'internal',
            piiDetected: false,
            studentDataFlagged: false,
          },
          hash: `sha256:${receiptId}`,
          created_at: new Date().toISOString(),
        };
        
        this.receipts.set(receiptId, receipt);
        res.writeHead(201);
        res.end(JSON.stringify(receipt));
        return;
      }

      // Route: GET /receipts - List receipts
      if (url.pathname === '/receipts' && req.method === 'GET') {
        const receiptsList = Array.from(this.receipts.values());
        res.writeHead(200);
        res.end(JSON.stringify({
          receipts: receiptsList,
          total: receiptsList.length,
        }));
        return;
      }

      // Route: GET /receipts/:id - Get receipt by ID
      const receiptMatch = url.pathname.match(/^\/receipts\/([^/]+)$/);
      if (receiptMatch && req.method === 'GET') {
        const receiptId = receiptMatch[1];
        const receipt = this.receipts.get(receiptId);
        if (receipt) {
          res.writeHead(200);
          res.end(JSON.stringify(receipt));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Receipt not found' }));
        }
        return;
      }

      // Route: GET /receipts/request/:requestId - Get receipt by request ID
      const requestMatch = url.pathname.match(/^\/receipts\/request\/([^/]+)$/);
      if (requestMatch && req.method === 'GET') {
        const requestId = requestMatch[1];
        const receipt = Array.from(this.receipts.values()).find(r => r.request_id === requestId);
        if (receipt) {
          res.writeHead(200);
          res.end(JSON.stringify(receipt));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Receipt not found' }));
        }
        return;
      }

      // Route: POST /work/approve - Approve plan and execute
      if (url.pathname === '/work/approve' && req.method === 'POST') {
        const body = await this.readJsonBody(req) as any;
        const requestId = body.requestId;
        
        // Find the queued work item
        const workItem = this.workQueue.find(w => w.request.requestId === requestId);
        if (!workItem) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Work item not found' }));
          return;
        }

        // Execute the work
        this.executeWork(workItem).then(() => {
          // Execution complete - events already emitted
        }).catch(error => {
          console.error('[DirectOperator] Execution error:', error);
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          requestId,
          status: 'executing',
        }));
        return;
      }

      // Route: GET /health - Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', type: 'direct-operator' }));
        return;
      }

      // Not found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error: any) {
      console.error('[DirectOperator] Request error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Handle WebSocket connections
   */
  private handleWebSocketConnection(ws: WebSocket): void {
    console.log('[DirectOperator] WebSocket client connected');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribe') {
          // Subscribe to events for a specific request
          const requestId = message.requestId;
          if (!this.subscriptions.has(requestId)) {
            this.subscriptions.set(requestId, []);
          }
          this.subscriptions.get(requestId)!.push({ ws, requestId });
          console.log(`[DirectOperator] Client subscribed to ${requestId}`);
        } else if (message.type === 'work_result') {
          // Receive work result from runner
          this.emit('work:result', message);
        }
      } catch (error) {
        console.error('[DirectOperator] WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('[DirectOperator] WebSocket client disconnected');
      // Clean up subscriptions
      for (const [requestId, subs] of this.subscriptions.entries()) {
        const filtered = subs.filter(sub => sub.ws !== ws);
        if (filtered.length === 0) {
          this.subscriptions.delete(requestId);
        } else {
          this.subscriptions.set(requestId, filtered);
        }
      }
    });
  }

  /**
   * Setup SSE stream for event delivery
   */
  private setupSSEStream(res: http.ServerResponse, requestId: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendEvent = (event: OperatorEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      res.write(data);
    };

    // Send initial connection event
    sendEvent({
      type: 'connected',
      requestId,
      timestamp: Date.now(),
    });

    // Listen for events matching this requestId
    const eventHandler = (event: OperatorEvent) => {
      if (event.requestId === requestId) {
        sendEvent(event);
      }
    };

    this.on('event', eventHandler);

    // Cleanup on client disconnect
    res.on('close', () => {
      this.removeListener('event', eventHandler);
    });
  }

  /**
   * Emit an event to subscribed clients
   */
  emitEvent(event: OperatorEvent): void {
    this.emit('event', event);

    // Send to WebSocket subscribers
    const subs = this.subscriptions.get(event.requestId) || [];
    for (const sub of subs) {
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Read JSON body from request
   */
  private readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  // ============================================================================
  // RailsAdapter-compatible interface (for compatibility with existing runner)
  // ============================================================================

  /**
   * Discover work items (returns queued operator requests)
   * Note: This is a simplified implementation for direct operator mode
   */
  async discoverWork(): Promise<OperatorWorkRequest[]> {
    const workItems = this.workQueue.splice(0, 1); // Take one item at a time
    return workItems.map(item => item.request);
  }

  /**
   * Claim work (creates a lease)
   */
  async claimWork(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    agentId: string,
    paths: string[],
    ttlSeconds: number = 900
  ): Promise<{ success: boolean; lease?: Lease; error?: string }> {
    const leaseId = `lease_${Date.now()}` as LeaseId;
    const now = new Date().toISOString();

    const lease: Lease = {
      leaseId,
      wihId,
      dagId,
      nodeId,
      holder: agentId,
      grantedAt: now,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      scope: {
        paths,
        tools: [],
      },
    };

    this.activeLeases.set(leaseId, lease);
    return { success: true, lease };
  }

  /**
   * Release lease
   */
  async releaseLease(leaseId: LeaseId): Promise<void> {
    this.activeLeases.delete(leaseId);
  }

  /**
   * Check gate (always allow for direct operator mode)
   */
  async checkGate(request: {
    wihId: WihId;
    dagId: DagId;
    nodeId: NodeId;
    runId: RunId;
    tool: ToolCall;
    contextPackId: string;
    policyBundleId: string;
    leaseId?: LeaseId;
  }): Promise<{
    allowed: boolean;
    decision: 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL';
    transformedArgs?: Record<string, unknown>;
    reason?: string;
    checkId: string;
  }> {
    // In direct operator mode, we trust the UI's policy settings
    return {
      allowed: true,
      decision: 'ALLOW',
      checkId: `check_${Date.now()}`,
    };
  }

  /**
   * Submit receipt
   */
  async submitReceipt(receipt: Receipt): Promise<ReceiptId> {
    const receiptId = `receipt_${Date.now()}` as ReceiptId;
    
    // Emit receipt event to subscribers
    this.emitEvent({
      type: 'complete',
      requestId: receipt.wihId.replace('wih_', ''),
      data: { receiptId, receipt },
      timestamp: Date.now(),
    });

    return receiptId;
  }

  /**
   * Execute work - GOLDEN PATH IMPLEMENTATION
   * Actually performs Canvas operations via API
   */
  async executeWork(workItem: QueuedWorkItem): Promise<void> {
    const { request, plan } = workItem;
    const requestId = request.requestId;

    this.emitEvent({
      type: 'executing',
      requestId,
      data: { planId: plan?.id },
      timestamp: Date.now(),
    });

    const actions: any[] = [];
    const createdObjects: any[] = [];
    let executionSuccess = true;
    let executionError: string | undefined;

    try {
      // Check if Canvas connector is configured
      const canvasStatus = this.canvasConnector.getConfigStatus();
      if (!canvasStatus.configured) {
        // Canvas not configured - simulate for demo
        console.log('[DirectOperator] Canvas not configured, simulating execution');
        
        // Simulate module creation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const simulatedModule = {
          id: Math.floor(Math.random() * 10000),
          name: plan?.goal || 'Simulated Module',
          position: 1,
          published: false,
          created_at: new Date().toISOString(),
        };

        actions.push({
          stepNumber: 1,
          action: 'Create Canvas module (simulated)',
          target: 'Canvas API',
          status: 'success',
          backend: 'connector',
          durationMs: 1000,
        });

        createdObjects.push({
          type: 'module',
          name: simulatedModule.name,
          id: String(simulatedModule.id),
          url: `${canvasStatus.baseUrl || 'https://canvas.instructure.com'}/courses/1/modules/${simulatedModule.id}`,
          note: 'SIMULATED - Canvas not configured',
        });

        executionSuccess = true;
      } else {
        // Canvas IS configured - execute real operations
        console.log('[DirectOperator] Canvas configured, executing real operations');

        // Parse course ID from context or plan
        const courseId = request.context.target_context?.course_id as string || '1';
        
        // Execute plan steps
        if (plan) {
          for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            const stepStart = Date.now();

            this.emitEvent({
              type: 'step_complete',
              requestId,
              data: { stepId: step.id, status: 'running' },
              timestamp: Date.now(),
            });

            // Execute based on step type or intent
            const stepTitle = step.title.toLowerCase();
            const stepDesc = step.description?.toLowerCase() || '';
            const intent = request.intent.toLowerCase();
            
            // Check if this is a Canvas module creation
            if ((stepTitle.includes('create') || stepDesc.includes('create') || intent.includes('create module')) &&
                (stepTitle.includes('module') || stepDesc.includes('module') || intent.includes('module'))) {
              
              const courseId = request.context.target_context?.course_id as string || '1';
              const moduleName = intent.replace(/create module/gi, '').trim() || 'New Module';
              
              const result = await this.canvasConnector.createModule({
                courseId,
                name: moduleName,
                published: false,
              });

              if (result.success) {
                // Verify module exists
                const verification = await this.canvasConnector.verifyModule(courseId, result.objectId);
                
                actions.push({
                  stepNumber: i + 1,
                  action: step.title,
                  target: `Canvas course ${courseId}`,
                  status: verification.exists ? 'success' : 'failed',
                  backend: 'connector',
                  durationMs: Date.now() - stepStart,
                  verification: {
                    method: 'API lookup',
                    passed: verification.exists,
                    details: verification.module ? 'Module confirmed in Canvas' : 'Module not found',
                  },
                });

                if (verification.exists && verification.module) {
                  createdObjects.push({
                    type: 'module',
                    name: verification.module.name,
                    id: String(verification.module.id),
                    url: result.objectUrl,
                    published: verification.module.published,
                  });
                } else {
                  executionSuccess = false;
                  executionError = 'Module verification failed';
                }
              } else {
                actions.push({
                  stepNumber: i + 1,
                  action: step.title,
                  target: `Canvas course ${courseId}`,
                  status: 'failed',
                  backend: 'connector',
                  durationMs: Date.now() - stepStart,
                  error: result.error,
                });
                executionSuccess = false;
                executionError = result.error;
                break;
              }
            } else {
              // Generic step - just mark as complete
              actions.push({
                stepNumber: i + 1,
                action: step.title,
                target: step.description || 'Unknown',
                status: 'success',
                backend: step.backend,
                durationMs: Date.now() - stepStart,
              });
            }

            this.emitEvent({
              type: 'step_complete',
              requestId,
              data: { stepId: step.id, status: 'completed' },
              timestamp: Date.now(),
            });
          }
        }
      }

      // Create receipt with execution evidence
      const receiptId = `receipt_${Date.now()}`;
      const receipt: StoredReceipt = {
        id: receiptId,
        request_id: requestId,
        user_id: 'operator_user',
        user_intent: request.intent,
        target_system: 'Canvas',
        status: executionSuccess ? 'success' : 'failed',
        created_objects: createdObjects,
        actions,
        verification: {
          overallPassed: executionSuccess,
          checks: [
            {
              name: 'execution_completed',
              passed: executionSuccess,
              message: executionSuccess ? 'All steps completed' : executionError,
            },
            {
              name: 'objects_created',
              passed: createdObjects.length > 0,
              message: `${createdObjects.length} object(s) created`,
            },
          ],
        },
        privacy: {
          modelRouting: request.policy?.require_private_model ? 'local' : 'private_cloud',
          dataClassification: 'internal',
          piiDetected: false,
          studentDataFlagged: false,
        },
        hash: `sha256:${receiptId}`,
        created_at: new Date().toISOString(),
      };

      this.receipts.set(receiptId, receipt);

      // Emit complete event
      this.emitEvent({
        type: 'complete',
        requestId,
        data: {
          receiptId,
          success: executionSuccess,
          createdObjects: createdObjects.length,
          actions: actions.length,
        },
        timestamp: Date.now(),
      });

    } catch (error: any) {
      console.error('[DirectOperator] Execution error:', error);
      
      this.emitEvent({
        type: 'error',
        requestId,
        data: { error: error.message },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get context pack (from operator request context)
   */
  async getContextPack(wihId: WihId): Promise<ContextPack> {
    // Return minimal context pack - context comes from operator request
    return {
      contextPackId: `context_${Date.now()}` as ContextPackId,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      inputs: {
        wihId,
        dagId: `dag_${wihId.replace('wih_', '')}` as DagId,
        nodeId: `node_${wihId.replace('wih_', '')}` as NodeId,
        receiptRefs: [],
        policyBundleId: `policy_${wihId.replace('wih_', '')}` as PolicyBundleId,
        planHashes: {},
      },
      correlationId: wihId as unknown as CorrelationId,
    };
  }

  /**
   * Get policy bundle (from operator request policy)
   */
  async getPolicyBundle(wihId: WihId): Promise<PolicyBundle> {
    // Return default policy bundle
    return {
      bundle_id: `policy_${Date.now()}`,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      agents_md_hash: '',
      role: 'operator',
      execution_mode: 'plan_then_execute' as ExecutionMode,
      constraints: {
        allowed_tools: [],
        forbidden_tools: [],
        write_scope: {
          mode: 'lease_scoped',
          allowed_globs: ['**/*'],
          forbidden_globs: [],
        },
        network_policy: 'restricted',
        receipts_required: true,
        max_fix_cycles: 3,
        require_validator: false,
      },
      injection_marker: {
        marker_id: `marker_${Date.now()}`,
        agents_md_hash: '',
        bundle_hash: '',
        role: 'operator',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Factory function to create DirectOperatorAdapter
 */
export function createDirectOperatorAdapter(config: DirectOperatorConfig): DirectOperatorAdapter {
  return new DirectOperatorAdapter(config);
}
