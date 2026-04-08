/**
 * DAK Runner Store - Complete state management for Deterministic Agent Kernel
 * 
 * Manages: DAGs, WIHs, Leases, Context Packs, Receipts, Gates, Snapshots
 * All backend operations go through Rails API
 */

import { create } from "zustand";
import { railsApi } from "@/lib/agents";
import type {
  DagDefinition,
  DagExecution,
  DagPlanRequest,
  DagRefineRequest,
  WihInfo,
  WihPickupRequest,
  WihCloseRequest,
  ManagedLease,
  LeaseRequest,
  ContextPack,
  ContextPackQuery,
  Receipt,
  ReceiptQuery,
  GateCheck,
  ToolSnapshot,
  SnapshotStats,
  PromptTemplate,
  TemplateExecutionRequest,
  DakEvent,
  DakHealthStatus,
} from "./dak.types";

// ============================================================================
// Store Interface
// ============================================================================

interface DakStore {
  // Connection State
  railsConnected: boolean;
  dakVersion: string;
  isLoading: boolean;
  error: string | null;
  
  // DAGs
  dags: DagDefinition[];
  activeExecutions: DagExecution[];
  selectedDagId: string | null;
  selectedRunId: string | null;
  
  // WIHs
  wihs: WihInfo[];
  myWihs: WihInfo[];
  selectedWihId: string | null;
  
  // Leases
  leases: ManagedLease[];
  selectedLeaseId: string | null;
  
  // Context Packs
  contextPacks: ContextPack[];
  selectedContextPackId: string | null;
  
  // Receipts
  receipts: Receipt[];
  
  // Gates
  pendingGateChecks: GateCheck[];
  gateHistory: GateCheck[];
  
  // Snapshots (local to DAK Runner)
  snapshots: ToolSnapshot[];
  snapshotStats?: SnapshotStats;
  
  // Templates
  templates: PromptTemplate[];
  selectedTemplateId: string | null;
  templateVariables: Record<string, unknown>;
  
  // Events
  events: DakEvent[];
  
  // UI State
  activeTab: "execute" | "dags" | "wihs" | "leases" | "context" | "receipts" | "gates" | "snapshots" | "templates";
  sidebarOpen: boolean;
  
  // Actions
  // Connection
  checkHealth: () => Promise<void>;
  
  // DAGs
  fetchDags: () => Promise<void>;
  createDagPlan: (req: DagPlanRequest) => Promise<string>;
  refineDag: (req: DagRefineRequest) => Promise<void>;
  executeDag: (dagId: string) => Promise<void>;
  cancelDag: (runId: string) => Promise<void>;
  selectDag: (dagId: string | null) => void;
  selectRun: (runId: string | null) => void;
  
  // WIHs
  fetchWihs: (dagId?: string) => Promise<void>;
  pickupWih: (req: WihPickupRequest) => Promise<string>;
  closeWih: (req: WihCloseRequest) => Promise<void>;
  selectWih: (wihId: string | null) => void;
  
  // Leases
  fetchLeases: () => Promise<void>;
  requestLease: (req: LeaseRequest) => Promise<string>;
  renewLease: (leaseId: string) => Promise<void>;
  releaseLease: (leaseId: string) => Promise<void>;
  selectLease: (leaseId: string | null) => void;
  
  // Context Packs
  fetchContextPacks: (query?: ContextPackQuery) => Promise<void>;
  sealContextPack: (dagId: string, nodeId: string, wihId: string) => Promise<string>;
  selectContextPack: (packId: string | null) => void;
  
  // Receipts
  fetchReceipts: (query?: ReceiptQuery) => Promise<void>;
  
  // Gates
  fetchGateChecks: () => Promise<void>;
  submitGateDecision: (checkId: string, decision: "allow" | "block", reason?: string) => Promise<void>;
  
  // Snapshots (local DAK Runner)
  fetchSnapshots: () => Promise<void>;
  clearSnapshot: (snapshotId: string) => Promise<void>;
  clearAllSnapshots: () => Promise<void>;
  
  // Templates
  fetchTemplates: () => Promise<void>;
  selectTemplate: (templateId: string | null) => void;
  setTemplateVariable: (name: string, value: unknown) => void;
  executeTemplate: (req: TemplateExecutionRequest) => Promise<void>;
  
  // UI
  setActiveTab: (tab: DakStore["activeTab"]) => void;
  toggleSidebar: () => void;
  clearError: () => void;
  
  // Events
  addEvent: (event: DakEvent) => void;
  clearEvents: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useDakStore = create<DakStore>((set, get) => ({
  // Initial State
  railsConnected: false,
  dakVersion: "1.1.0",
  isLoading: false,
  error: null,
  
  dags: [],
  activeExecutions: [],
  selectedDagId: null,
  selectedRunId: null,
  
  wihs: [],
  myWihs: [],
  selectedWihId: null,
  
  leases: [],
  selectedLeaseId: null,
  
  contextPacks: [],
  selectedContextPackId: null,
  
  receipts: [],
  
  pendingGateChecks: [],
  gateHistory: [],
  
  snapshots: [],
  snapshotStats: undefined,
  
  templates: [],
  selectedTemplateId: null,
  templateVariables: {},
  
  events: [],
  
  activeTab: "dags",
  sidebarOpen: true,
  
  // Connection - Calls Rails Health
  checkHealth: async () => {
    try {
      const health = await railsApi.health();
      set({ railsConnected: health.status === "healthy" || health.status === "ok" });
    } catch (err: any) {
      set({ railsConnected: false, error: err.message });
    }
  },
  
  // DAGs - Calls Rails Plan API
  fetchDags: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.plan.list();
      // Transform response to DagDefinition format
      const dags: DagDefinition[] = response.dags.map((d: any) => ({
        dagId: d.dag_id,
        version: d.version,
        createdAt: d.created_at,
        nodes: [], // Would need to fetch details for each
        edges: [],
        metadata: d.metadata,
      }));
      set({ dags, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      console.error("Failed to fetch DAGs:", err);
    }
  },
  
  createDagPlan: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.plan.new({
        text: req.text,
        dag_id: req.dagId,
      });
      // Fetch the created DAG details
      const dagDetails = await railsApi.plan.show(response.dag_id);
      const newDag: DagDefinition = {
        dagId: dagDetails.dag_id,
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        nodes: (dagDetails.dag as any)?.nodes || [],
        edges: (dagDetails.dag as any)?.edges || [],
        metadata: { title: req.text.slice(0, 50) },
      };
      set((state) => ({ 
        dags: [...state.dags, newDag],
        isLoading: false 
      }));
      return response.dag_id;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
  
  refineDag: async (req) => {
    set({ isLoading: true, error: null });
    try {
      await railsApi.plan.refine({
        dag_id: req.dagId,
        delta: req.delta,
        reason: req.reason,
        mutations: req.mutations,
      });
      // Refresh the DAG after refinement
      await get().fetchDags();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  executeDag: async (dagId) => {
    set({ isLoading: true, error: null });
    try {
      const runId = `run_${Date.now()}`;
      await railsApi.plan.execute(dagId, runId);
      
      // Add to active executions
      const newExecution: DagExecution = {
        runId,
        dagId,
        status: "running",
        startedAt: Date.now(),
        completedNodes: [],
        failedNodes: [],
        blockedNodes: [],
        progress: 0,
      };
      set((state) => ({
        activeExecutions: [...state.activeExecutions, newExecution],
        isLoading: false,
      }));
      
      // Start polling for execution status
      pollExecutionStatus(runId, get, set);
      
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  cancelDag: async (runId) => {
    try {
      await railsApi.plan.cancel(runId);
      set((state) => ({
        activeExecutions: state.activeExecutions.map((ex) =>
          ex.runId === runId ? { ...ex, status: "cancelled" as const } : ex
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },
  
  selectDag: (dagId) => set({ selectedDagId: dagId }),
  selectRun: (runId) => set({ selectedRunId: runId }),
  
  // WIHs - Calls Rails WIH API
  fetchWihs: async (dagId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.wihs.list({ dag_id: dagId });
      const wihs: WihInfo[] = response.wihs.map((w: any) => ({
        wihId: w.wih_id,
        nodeId: w.node_id,
        dagId: w.dag_id || "",
        status: w.status,
        title: w.title,
        description: w.description,
        createdAt: w.created_at || new Date().toISOString(),
        updatedAt: w.updated_at || new Date().toISOString(),
        ready: w.ready !== false,
        blockedBy: w.blocked_by || [],
      }));
      set({ wihs, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  pickupWih: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.wihs.pickup({
        dag_id: req.dagId,
        node_id: req.nodeId,
        agent_id: req.agentId,
        role: req.role,
        fresh: req.fresh,
      });
      
      // Add to myWihs and update the WIH status
      const pickedWih = get().wihs.find((w) => w.wihId === response.wih_id);
      if (pickedWih) {
        set((state) => ({
          myWihs: [...state.myWihs, { ...pickedWih, status: "signed" }],
          wihs: state.wihs.map((w) =>
            w.wihId === response.wih_id ? { ...w, status: "signed" } : w
          ),
        }));
      }
      
      set({ isLoading: false });
      return response.wih_id;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
  
  closeWih: async (req) => {
    set({ isLoading: true, error: null });
    try {
      await railsApi.wihs.close(req.wihId, {
        status: req.status,
        evidence: req.evidence,
      });
      
      // Update local state
      set((state) => ({
        wihs: state.wihs.map((w) =>
          w.wihId === req.wihId ? { ...w, status: "closed" } : w
        ),
        myWihs: state.myWihs.filter((w) => w.wihId !== req.wihId),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  selectWih: (wihId) => set({ selectedWihId: wihId }),
  
  // Leases - Calls Rails Leases API
  fetchLeases: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.leases.list();
      const leases: ManagedLease[] = response.leases.map((l: any) => ({
        leaseId: l.lease_id,
        wihId: l.wih_id,
        dagId: l.dag_id,
        nodeId: l.node_id,
        agentId: l.agent_id,
        acquiredAt: l.acquired_at,
        expiresAt: l.expires_at,
        keys: l.keys || [],
        tools: l.tools || [],
        renewalCount: l.renewal_count || 0,
        status: l.status,
      }));
      set({ leases, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      console.error("Failed to fetch leases:", err);
    }
  },
  
  requestLease: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.leases.request({
        wih_id: req.wihId,
        agent_id: req.agentId,
        paths: req.paths,
        tools: req.tools,
        ttl_seconds: req.ttlSeconds,
      });
      
      if (response.granted) {
        // Add to leases list
        const newLease: ManagedLease = {
          leaseId: response.lease_id,
          wihId: req.wihId,
          dagId: "",
          nodeId: "",
          agentId: req.agentId,
          acquiredAt: Date.now(),
          expiresAt: response.expires_at || Date.now() + (req.ttlSeconds || 900) * 1000,
          keys: req.paths,
          tools: req.tools || [],
          renewalCount: 0,
          status: "active",
        };
        set((state) => ({
          leases: [...state.leases, newLease],
          isLoading: false,
        }));
        return response.lease_id;
      } else {
        throw new Error("Lease request denied");
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
  
  renewLease: async (leaseId) => {
    try {
      const response = await railsApi.leases.renew(leaseId, 300);
      if (response.renewed) {
        set((state) => ({
          leases: state.leases.map((l) =>
            l.leaseId === leaseId
              ? { 
                  ...l, 
                  expiresAt: response.expires_at,
                  renewalCount: l.renewalCount + 1,
                  status: "active"
                }
              : l
          ),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },
  
  releaseLease: async (leaseId) => {
    try {
      await railsApi.leases.release(leaseId);
      set((state) => ({
        leases: state.leases.filter((l) => l.leaseId !== leaseId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },
  
  selectLease: (leaseId) => set({ selectedLeaseId: leaseId }),
  
  // Context Packs - Calls Rails Context Packs API
  fetchContextPacks: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.contextPacks.list({
        dag_id: query?.dagId,
        node_id: query?.nodeId,
        wih_id: query?.wihId,
        limit: query?.limit || 100,
      });
      const packs: ContextPack[] = response.packs.map((p: any) => ({
        contextPackId: p.context_pack_id,
        version: p.version,
        createdAt: p.created_at,
        inputs: {
          wihId: p.inputs.wih_id,
          dagId: p.inputs.dag_id,
          nodeId: p.inputs.node_id,
          wihContent: p.inputs.wih_content,
          receiptRefs: p.inputs.receipt_refs || [],
          policyBundleId: p.inputs.policy_bundle_id,
          planHashes: p.inputs.plan_hashes,
          toolRegistryVersion: p.inputs.tool_registry_version,
          leaseInfo: p.inputs.lease_info,
        },
        correlationId: p.correlation_id,
      }));
      set({ contextPacks: packs, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  sealContextPack: async (dagId, nodeId, wihId) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch dependency receipts first
      const receiptsResponse = await railsApi.receipts.query({
        dag_id: dagId,
        node_id: nodeId,
      });
      
      const response = await railsApi.contextPacks.seal({
        dag_id: dagId,
        node_id: nodeId,
        wih_id: wihId,
        inputs: {
          wih_id: wihId,
          dag_id: dagId,
          node_id: nodeId,
          receipt_refs: receiptsResponse.receipts.map((r: any) => r.receipt_id),
        },
      });
      
      set({ isLoading: false });
      return response.context_pack_id;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
  
  selectContextPack: (packId) => set({ selectedContextPackId: packId }),
  
  // Receipts - Calls Rails Receipts API
  fetchReceipts: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const response = await railsApi.receipts.query({
        dag_id: query?.dagId,
        node_id: query?.nodeId,
        wih_id: query?.wihId,
        kinds: query?.kinds,
        since: query?.since,
        until: query?.until,
        limit: query?.limit || 100,
      });
      const receipts: Receipt[] = response.receipts.map((r: any) => ({
        receiptId: r.receipt_id,
        kind: r.kind,
        runId: r.run_id,
        dagId: r.dag_id,
        nodeId: r.node_id,
        wihId: r.wih_id,
        timestamp: r.timestamp,
        payload: r.payload,
        signature: r.signature,
      }));
      set({ receipts, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  // Gates - Calls Rails Gate API
  fetchGateChecks: async () => {
    set({ isLoading: true, error: null });
    try {
      // This would fetch pending gate decisions
      // Not fully implemented in Rails yet
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  submitGateDecision: async (checkId, decision, reason) => {
    set({ isLoading: true, error: null });
    try {
      await railsApi.gate.decision(
        `Gate ${decision}: ${reason || "No reason provided"}`,
        reason,
        [checkId]
      );
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  // Snapshots - Local DAK Runner (would call local DAK Runner API)
  fetchSnapshots: async () => {
    set({ isLoading: true, error: null });
    try {
      // Snapshots are managed by DAK Runner locally
      // This would call a local DAK Runner endpoint
      // For now, return empty
      set({ snapshots: [], snapshotStats: undefined, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  clearSnapshot: async (snapshotId) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.snapshotId !== snapshotId),
    }));
  },
  
  clearAllSnapshots: async () => {
    set({ snapshots: [], snapshotStats: undefined });
  },
  
  // Templates - Local (mock data for now)
  fetchTemplates: async () => {
    // Templates are loaded from mock data
    // Could be fetched from Rails or a template registry
  },
  
  selectTemplate: (templateId) => set({ selectedTemplateId: templateId, templateVariables: {} }),
  
  setTemplateVariable: (name, value) =>
    set((state) => ({
      templateVariables: { ...state.templateVariables, [name]: value },
    })),
  
  executeTemplate: async (req) => {
    set({ isLoading: true, error: null });
    try {
      // Template execution would create a DAG plan
      const template = get().templates.find((t) => t.id === req.templateId);
      if (!template) throw new Error("Template not found");
      
      // Render template with variables
      let text = template.template;
      Object.entries(req.variables).forEach(([key, value]) => {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
      
      // Create a DAG from the template
      const dagId = await get().createDagPlan({
        text,
        dagId: `dag_template_${Date.now()}`,
      });
      
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  
  // UI
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  clearError: () => set({ error: null }),
  
  // Events
  addEvent: (event) => set((state) => ({ events: [event, ...state.events].slice(0, 1000) })),
  clearEvents: () => set({ events: [] }),
}));

// Helper function to poll execution status
function pollExecutionStatus(
  runId: string, 
  get: () => DakStore, 
  set: (fn: (state: DakStore) => Partial<DakStore>) => void
) {
  const poll = async () => {
    try {
      // This would check execution status via Rails API
      // For now, simulate completion after 5 seconds
      await new Promise((r) => setTimeout(r, 5000));
      
      set((state) => ({
        activeExecutions: state.activeExecutions.map((ex) =>
          ex.runId === runId ? { ...ex, status: "completed", progress: 100 } : ex
        ),
      }));
    } catch (err) {
      console.error("Failed to poll execution status:", err);
    }
  };
  
  poll();
}
