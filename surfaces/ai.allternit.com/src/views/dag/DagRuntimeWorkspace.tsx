"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MermaidArtifact } from "@/components/ai-elements/mermaid-artifact";
import { railsApi } from "@/lib/agents/rails.service";
import { useDakStore } from "@/runner/dak.store";
import { ContextPackBrowser } from "@/runner/components/ContextPackBrowser";
import { DagPlanningPanel } from "@/runner/components/DagPlanningPanel";
import { LeaseMonitorPanel } from "@/runner/components/LeaseMonitorPanel";
import { ReceiptQueryPanel } from "@/runner/components/ReceiptQueryPanel";
import { WIHManagerPanel } from "@/runner/components/WIHManagerPanel";
import type { ContextPack, DagDefinition, Receipt, WihInfo } from "@/runner/dak.types";
import type { LedgerEvent } from "@/lib/agents/rails.service";
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Database,
  FileCode,
  FileText,
  GitBranch,
  Graph,
  HardDrives,
  Package,
  Play,
  Receipt as ReceiptIcon,
  Shield,
  Warning,
} from "@phosphor-icons/react";

type GateVerifyResult = {
  ok: boolean;
  ledger_chain_ok: boolean;
  ledger_chain_issues?: string[];
  cycle_dags: string[];
} | null;

type VaultJob = {
  wih_id: string;
  status: string;
  created_at?: string;
  completed_at?: string;
};

function useDagRuntimeData() {
  const {
    railsConnected,
    isLoading,
    error,
    dags,
    activeExecutions,
    wihs,
    myWihs,
    leases,
    contextPacks,
    receipts,
    selectedDagId,
    selectDag,
    checkHealth,
    fetchDags,
    fetchWihs,
    fetchLeases,
    fetchContextPacks,
    fetchReceipts,
    sealContextPack,
  } = useDakStore();

  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [gateVerify, setGateVerify] = useState<GateVerifyResult>(null);
  const [gateRules, setGateRules] = useState<string>("");
  const [vaultJobs, setVaultJobs] = useState<VaultJob[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsRefreshing(true);
      setRuntimeError(null);
      try {
        const [verify, rules, ledger, vault] = await Promise.all([
          railsApi.gate.verify(true),
          railsApi.gate.rules(),
          railsApi.ledger.tail(100),
          railsApi.vault.status(),
          checkHealth(),
          fetchDags(),
          fetchWihs(),
          fetchLeases(),
          fetchContextPacks({ limit: 100 }),
          fetchReceipts({ limit: 200 }),
        ]);

        if (cancelled) {
          return;
        }

        setGateVerify(verify);
        setGateRules(rules.rules ?? "");
        setLedgerEvents(ledger);
        setVaultJobs(vault.jobs ?? []);
      } catch (err) {
        if (!cancelled) {
          setRuntimeError(err instanceof Error ? err.message : "Failed to load DAG runtime data");
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [checkHealth, fetchContextPacks, fetchDags, fetchLeases, fetchReceipts, fetchWihs]);

  async function refreshAll() {
    setIsRefreshing(true);
    setRuntimeError(null);
    try {
      const [verify, rules, ledger, vault] = await Promise.all([
        railsApi.gate.verify(true),
        railsApi.gate.rules(),
        railsApi.ledger.tail(100),
        railsApi.vault.status(),
        checkHealth(),
        fetchDags(),
        fetchWihs(),
        fetchLeases(),
        fetchContextPacks({ limit: 100 }),
        fetchReceipts({ limit: 200 }),
      ]);

      setGateVerify(verify);
      setGateRules(rules.rules ?? "");
      setLedgerEvents(ledger);
      setVaultJobs(vault.jobs ?? []);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to refresh DAG runtime data");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshLedger(count = 100) {
    try {
      setLedgerEvents(await railsApi.ledger.tail(count));
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to load ledger events");
    }
  }

  async function traceLedger(query: { nodeId?: string; wihId?: string; promptId?: string }) {
    try {
      setLedgerEvents(
        await railsApi.ledger.trace({
          node_id: query.nodeId || undefined,
          wih_id: query.wihId || undefined,
          prompt_id: query.promptId || undefined,
        }),
      );
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to trace ledger events");
    }
  }

  async function rerunGateVerify() {
    try {
      setGateVerify(await railsApi.gate.verify(true));
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to verify DAG graph");
    }
  }

  async function rebuildIndex() {
    try {
      await railsApi.index.rebuild();
      await refreshLedger();
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to rebuild runtime index");
    }
  }

  async function archiveWih(wihId: string) {
    try {
      await railsApi.vault.archive({ wih_id: wihId });
      const vault = await railsApi.vault.status();
      setVaultJobs(vault.jobs ?? []);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : "Failed to archive WIH");
    }
  }

  return {
    railsConnected,
    isLoading,
    error: error ?? runtimeError,
    dags,
    activeExecutions,
    wihs,
    myWihs,
    leases,
    contextPacks,
    receipts,
    selectedDagId,
    selectDag,
    gateVerify,
    gateRules,
    ledgerEvents,
    vaultJobs,
    isRefreshing,
    refreshAll,
    refreshLedger,
    traceLedger,
    rerunGateVerify,
    rebuildIndex,
    archiveWih,
    sealContextPack,
  };
}

function SurfaceHeader({
  title,
  description,
  onRefresh,
  refreshing,
}: {
  title: string;
  description: string;
  onRefresh: () => void | Promise<void>;
  refreshing: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" onClick={() => void onRefresh()} disabled={refreshing}>
        <ArrowsClockwise className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

function StatusCards({
  dags,
  activeExecutions,
  wihs,
  receipts,
  leases,
  contextPacks,
  railsConnected,
}: {
  dags: DagDefinition[];
  activeExecutions: { status: string }[];
  wihs: WihInfo[];
  receipts: Receipt[];
  leases: { status: string }[];
  contextPacks: ContextPack[];
  railsConnected: boolean;
}) {
  const running = activeExecutions.filter((execution) => execution.status === "running").length;
  const openWihs = wihs.filter((wih) => wih.status === "open").length;
  const signedWihs = wihs.filter((wih) => wih.status === "signed").length;
  const activeLeases = leases.filter((lease) => lease.status === "active").length;

  const cards = [
    {
      label: "Rails",
      value: railsConnected ? "Connected" : "Unavailable",
      icon: Shield,
      tone: railsConnected ? "text-green-600" : "text-red-600",
    },
    { label: "DAGs", value: String(dags.length), icon: GitBranch, tone: "text-blue-600" },
    { label: "Running", value: String(running), icon: Play, tone: "text-amber-600" },
    { label: "Open WIHs", value: String(openWihs), icon: Clock, tone: "text-violet-600" },
    { label: "Signed WIHs", value: String(signedWihs), icon: FileText, tone: "text-cyan-600" },
    { label: "Receipts", value: String(receipts.length), icon: ReceiptIcon, tone: "text-emerald-600" },
    { label: "Context Packs", value: String(contextPacks.length), icon: Package, tone: "text-fuchsia-600" },
    { label: "Leases", value: String(activeLeases), icon: HardDrives, tone: "text-orange-600" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.tone}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.tone}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-destructive">
          <Warning className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptStats({ receipts }: { receipts: Receipt[] }) {
  const counts = receipts.reduce<Record<string, number>>((acc, receipt) => {
    acc[receipt.kind] = (acc[receipt.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(counts).map(([kind, count]) => (
        <Card key={kind}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{kind}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EvaluationHarnessSurface() {
  const runtime = useDagRuntimeData();
  const evaluationReceipts = runtime.receipts
    .filter((receipt) =>
      receipt.kind === "validator_report" ||
      receipt.kind === "build_report" ||
      receipt.kind === "gate_decision",
    )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const byDag = runtime.dags.map((dag) => {
    const receipts = evaluationReceipts.filter((receipt) => receipt.dagId === dag.dagId);
    const validatorReports = receipts.filter((receipt) => receipt.kind === "validator_report").length;
    const buildReports = receipts.filter((receipt) => receipt.kind === "build_report").length;
    const gateDecisions = receipts.filter((receipt) => receipt.kind === "gate_decision").length;
    return { dag, validatorReports, buildReports, gateDecisions, total: receipts.length };
  });

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Evaluation Harness"
        description="Quality and verification evidence across DAG executions"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <StatusCards
        dags={runtime.dags}
        activeExecutions={runtime.activeExecutions}
        wihs={runtime.wihs}
        receipts={runtime.receipts}
        leases={runtime.leases}
        contextPacks={runtime.contextPacks}
        railsConnected={runtime.railsConnected}
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>DAG Evaluation Coverage</CardTitle>
            <CardDescription>Validator, build, and gate evidence per DAG</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byDag.length === 0 ? (
              <p className="text-sm text-muted-foreground">No DAG plans available.</p>
            ) : (
              byDag.map((entry) => (
                <div key={entry.dag.dagId} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{entry.dag.dagId}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.dag.nodes.length} nodes, {entry.dag.edges.length} edges
                      </div>
                    </div>
                    <Badge variant={entry.total > 0 ? "default" : "outline"}>
                      {entry.total} evidence items
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md bg-muted p-3">
                      <div className="text-muted-foreground">Validator</div>
                      <div className="text-lg font-semibold">{entry.validatorReports}</div>
                    </div>
                    <div className="rounded-md bg-muted p-3">
                      <div className="text-muted-foreground">Build</div>
                      <div className="text-lg font-semibold">{entry.buildReports}</div>
                    </div>
                    <div className="rounded-md bg-muted p-3">
                      <div className="text-muted-foreground">Gate</div>
                      <div className="text-lg font-semibold">{entry.gateDecisions}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verification State</CardTitle>
            <CardDescription>Rails gate verification of the current runtime graph</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">Ledger Chain</div>
                <div className="text-sm text-muted-foreground">
                  {runtime.gateVerify?.ledger_chain_ok ? "Valid" : "Issues detected"}
                </div>
              </div>
              {runtime.gateVerify?.ledger_chain_ok ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Warning className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">Cycle Detection</div>
                <div className="text-sm text-muted-foreground">
                  {runtime.gateVerify?.cycle_dags.length ?? 0} DAGs with cycles
                </div>
              </div>
              <Badge variant={(runtime.gateVerify?.cycle_dags.length ?? 0) > 0 ? "destructive" : "secondary"}>
                {runtime.gateVerify?.cycle_dags.length ?? 0}
              </Badge>
            </div>
            {(runtime.gateVerify?.ledger_chain_issues?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <div className="mb-2 font-medium text-amber-700">Ledger Issues</div>
                <ul className="space-y-1 text-amber-700">
                  {runtime.gateVerify?.ledger_chain_issues?.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={() => void runtime.rerunGateVerify()} variant="outline" className="w-full">
              Re-run Verification
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Evaluation Evidence</CardTitle>
          <CardDescription>Latest validator, build, and gate receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-3">
              {evaluationReceipts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evaluation receipts have been recorded.</p>
              ) : (
                evaluationReceipts.map((receipt) => (
                  <div key={receipt.receiptId} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{receipt.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {receipt.dagId} / {receipt.nodeId} / {receipt.wihId}
                        </div>
                      </div>
                      <Badge variant="outline">{new Date(receipt.timestamp).toLocaleString()}</Badge>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(receipt.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function TaskExecutorSurface() {
  const runtime = useDagRuntimeData();

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Task Executor"
        description="Plan, dispatch, monitor, and complete DAG work items"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <StatusCards
        dags={runtime.dags}
        activeExecutions={runtime.activeExecutions}
        wihs={runtime.wihs}
        receipts={runtime.receipts}
        leases={runtime.leases}
        contextPacks={runtime.contextPacks}
        railsConnected={runtime.railsConnected}
      />
      <Tabs defaultValue="planning" className="space-y-4">
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="wihs">Work Items</TabsTrigger>
          <TabsTrigger value="leases">Leases</TabsTrigger>
        </TabsList>
        <TabsContent value="planning" className="m-0">
          <Card className="h-[760px] overflow-hidden">
            <CardContent className="h-full p-0">
              <DagPlanningPanel />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="wihs" className="m-0">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card className="h-[760px] overflow-hidden">
              <CardContent className="h-full p-0">
                <WIHManagerPanel />
              </CardContent>
            </Card>
            <Card className="h-[760px] overflow-hidden">
              <CardHeader>
                <CardTitle>Execution Evidence</CardTitle>
                <CardDescription>Receipts emitted while tasks move through execution</CardDescription>
              </CardHeader>
              <CardContent className="h-[680px]">
                <ScrollArea className="h-full">
                  <div className="space-y-3">
                    {runtime.receipts
                      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
                      .map((receipt) => (
                        <div key={receipt.receiptId} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{receipt.kind}</div>
                              <div className="text-xs text-muted-foreground">
                                {receipt.dagId} / {receipt.nodeId}
                              </div>
                            </div>
                            <Badge variant="outline">{new Date(receipt.timestamp).toLocaleTimeString()}</Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{receipt.wihId}</div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="leases" className="m-0">
          <Card className="h-[760px] overflow-hidden">
            <CardContent className="h-full p-0">
              <LeaseMonitorPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function DirectiveCompilerSurface() {
  const runtime = useDagRuntimeData();
  const { createDagPlan, refineDag } = useDakStore();
  const [planText, setPlanText] = useState("");
  const [dagId, setDagId] = useState("");
  const [refineReason, setRefineReason] = useState("");
  const [refineDelta, setRefineDelta] = useState("");
  const [renderFormat, setRenderFormat] = useState<"json" | "markdown">("markdown");
  const [renderedPlan, setRenderedPlan] = useState("");
  const selectedDag = runtime.dags.find((dag) => dag.dagId === runtime.selectedDagId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadRender() {
      if (!selectedDag) {
        setRenderedPlan("");
        return;
      }

      try {
        const rendered = await railsApi.plan.render(selectedDag.dagId, renderFormat);
        if (!cancelled) {
          setRenderedPlan(rendered.content);
        }
      } catch (err) {
        if (!cancelled) {
          setRenderedPlan(err instanceof Error ? err.message : "Failed to render DAG plan");
        }
      }
    }

    void loadRender();
    return () => {
      cancelled = true;
    };
  }, [renderFormat, selectedDag]);

  async function handleCreate() {
    if (!planText.trim()) {
      return;
    }

    const createdDagId = await createDagPlan({
      text: planText,
      dagId: dagId || undefined,
    });
    runtime.selectDag(createdDagId);
    setPlanText("");
    setDagId("");
  }

  async function handleRefine() {
    if (!selectedDag || !refineDelta.trim()) {
      return;
    }

    await refineDag({
      dagId: selectedDag.dagId,
      delta: refineDelta,
      reason: refineReason || undefined,
    });
    const rendered = await railsApi.plan.render(selectedDag.dagId, renderFormat);
    setRenderedPlan(rendered.content);
    setRefineDelta("");
    setRefineReason("");
  }

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Directive Compiler"
        description="Compile intent into DAG plans and refine them against runtime constraints"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="h-[760px]">
          <CardHeader>
            <CardTitle>Compiled DAGs</CardTitle>
            <CardDescription>Select a DAG to inspect the compiled render</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[650px] pr-4">
              <div className="space-y-3">
                {runtime.dags.map((dag) => (
                  <button
                    key={dag.dagId}
                    type="button"
                    onClick={() => runtime.selectDag(dag.dagId)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      runtime.selectedDagId === dag.dagId ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{dag.dagId}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {dag.nodes.length} nodes, {dag.edges.length} edges
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compile New Directive</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Optional DAG ID" value={dagId} onChange={(event) => setDagId(event.target.value)} />
              <Textarea
                rows={6}
                placeholder="Describe the task or outcome to compile into a DAG plan"
                value={planText}
                onChange={(event) => setPlanText(event.target.value)}
              />
              <Button onClick={() => void handleCreate()} disabled={!planText.trim() || runtime.isLoading}>
                <GitBranch className="mr-2 h-4 w-4" />
                Compile Directive
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Selected Plan</CardTitle>
              <CardDescription>
                {selectedDag ? selectedDag.dagId : "Select a DAG to render and refine"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant={renderFormat === "markdown" ? "default" : "outline"} onClick={() => setRenderFormat("markdown")}>
                  Markdown
                </Button>
                <Button variant={renderFormat === "json" ? "default" : "outline"} onClick={() => setRenderFormat("json")}>
                  JSON
                </Button>
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-lg bg-muted p-4 text-xs">{renderedPlan || "No render loaded."}</pre>
              <div className="grid gap-4">
                <Input
                  placeholder="Why are you refining this plan?"
                  value={refineReason}
                  onChange={(event) => setRefineReason(event.target.value)}
                />
                <Textarea
                  rows={5}
                  placeholder="Describe the refinement delta to apply"
                  value={refineDelta}
                  onChange={(event) => setRefineDelta(event.target.value)}
                />
                <Button onClick={() => void handleRefine()} disabled={!selectedDag || !refineDelta.trim()}>
                  <FileCode className="mr-2 h-4 w-4" />
                  Apply Refinement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function GCAgentsSurface() {
  const runtime = useDagRuntimeData();
  const closedWihs = runtime.wihs.filter((wih) => wih.status === "closed");
  const activeArchives = runtime.vaultJobs.filter((job) => job.status !== "completed");

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="GC Agents"
        description="Archive completed work and maintain runtime indexes and evidence stores"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed WIHs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closedWihs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Archive Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runtime.vaultJobs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Archive Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeArchives.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cycle DAGs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runtime.gateVerify?.cycle_dags.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Archive Candidates</CardTitle>
            <CardDescription>Closed WIHs ready for vault archival</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {closedWihs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No closed work items are available for archival.</p>
            ) : (
              closedWihs.map((wih) => (
                <div key={wih.wihId} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="font-medium">{wih.title || wih.wihId}</div>
                    <div className="text-xs text-muted-foreground">
                      {wih.dagId} / {wih.nodeId}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => void runtime.archiveWih(wih.wihId)}>
                    Archive
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Controls</CardTitle>
            <CardDescription>Graph verification and index maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="font-medium">Gate Verification</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {runtime.gateVerify?.ok ? "Verification passed" : "Verification requires attention"}
              </div>
              <Button variant="outline" className="mt-3 w-full" onClick={() => void runtime.rerunGateVerify()}>
                Verify Graph
              </Button>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-medium">Search Index</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Rebuild the runtime index from ledger evidence.
              </div>
              <Button variant="outline" className="mt-3 w-full" onClick={() => void runtime.rebuildIndex()}>
                Rebuild Index
              </Button>
            </div>
            <div className="rounded-lg border p-4">
              <div className="font-medium">Gate Rules</div>
              <ScrollArea className="mt-3 h-[240px] rounded-md bg-muted p-3">
                <pre className="text-xs whitespace-pre-wrap">{runtime.gateRules || "No gate rules returned."}</pre>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vault Job History</CardTitle>
          <CardDescription>Archive job state reported by the runtime vault</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {runtime.vaultJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archive jobs have been recorded.</p>
            ) : (
              runtime.vaultJobs.map((job) => (
                <div key={`${job.wih_id}-${job.created_at ?? job.status}`} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{job.wih_id}</div>
                      <div className="text-xs text-muted-foreground">
                        Created {job.created_at ? new Date(job.created_at).toLocaleString() : "unknown"}
                      </div>
                    </div>
                    <Badge variant={job.status === "completed" ? "secondary" : "outline"}>{job.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildOntologyDiagram(dags: DagDefinition[], wihs: WihInfo[], packs: ContextPack[], receipts: Receipt[]) {
  const lines = ["graph TD"];

  dags.slice(0, 12).forEach((dag) => {
    const dagKey = dag.dagId.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`  ${dagKey}[\"DAG: ${dag.dagId}\"]`);

    dag.nodes.slice(0, 8).forEach((node) => {
      const nodeKey = `${dagKey}_${node.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      lines.push(`  ${dagKey} --> ${nodeKey}[\"Node: ${node.id}\"]`);

      const nodeWihs = wihs.filter((wih) => wih.dagId === dag.dagId && wih.nodeId === node.id).slice(0, 4);
      nodeWihs.forEach((wih) => {
        const wihKey = `${nodeKey}_${wih.wihId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        lines.push(`  ${nodeKey} --> ${wihKey}[\"WIH: ${wih.wihId}\"]`);

        const wihPacks = packs.filter((pack) => pack.inputs.wihId === wih.wihId).slice(0, 2);
        wihPacks.forEach((pack) => {
          const packKey = `${wihKey}_${pack.contextPackId.slice(0, 10).replace(/[^a-zA-Z0-9_]/g, "_")}`;
          lines.push(`  ${wihKey} --> ${packKey}[\"Pack: ${pack.contextPackId.slice(0, 10)}\"]`);
        });

        const wihReceipts = receipts.filter((receipt) => receipt.wihId === wih.wihId).slice(0, 3);
        wihReceipts.forEach((receipt) => {
          const receiptKey = `${wihKey}_${receipt.receiptId.slice(0, 10).replace(/[^a-zA-Z0-9_]/g, "_")}`;
          lines.push(`  ${wihKey} --> ${receiptKey}[\"Receipt: ${receipt.kind}\"]`);
        });
      });
    });
  });

  return lines.join("\n");
}

export function OntologyViewerSurface() {
  const runtime = useDagRuntimeData();
  const diagram = buildOntologyDiagram(runtime.dags, runtime.wihs, runtime.contextPacks, runtime.receipts);

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Ontology Viewer"
        description="Runtime ontology of DAGs, nodes, work items, context packs, and receipts"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">DAG Concepts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runtime.dags.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Node Concepts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runtime.dags.reduce((sum, dag) => sum + dag.nodes.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">WIH Bindings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runtime.wihs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evidence Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runtime.receipts.length + runtime.contextPacks.length}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Runtime Ontology Graph</CardTitle>
            <CardDescription>Rendered from live DAG, WIH, pack, and receipt relationships</CardDescription>
          </CardHeader>
          <CardContent>
            <MermaidArtifact content={diagram} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ontology Table</CardTitle>
            <CardDescription>Execution-domain entities captured by the runtime</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[640px]">
              <div className="space-y-4 pr-4">
                {runtime.dags.map((dag) => (
                  <div key={dag.dagId} className="rounded-lg border p-4">
                    <div className="font-medium">{dag.dagId}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{dag.nodes.length} nodes</Badge>
                      <Badge variant="outline">{dag.edges.length} edges</Badge>
                      <Badge variant="outline">
                        {runtime.wihs.filter((wih) => wih.dagId === dag.dagId).length} WIHs
                      </Badge>
                      <Badge variant="outline">
                        {runtime.contextPacks.filter((pack) => pack.inputs.dagId === dag.dagId).length} packs
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ReceiptsViewerSurface() {
  const runtime = useDagRuntimeData();

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Receipts Viewer"
        description="Execution receipts and evidence across the DAG runtime"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <ReceiptStats receipts={runtime.receipts} />
      <Card className="h-[760px] overflow-hidden">
        <CardContent className="h-full p-0">
          <ReceiptQueryPanel />
        </CardContent>
      </Card>
    </div>
  );
}

export function DagWihSurface() {
  const runtime = useDagRuntimeData();
  const selectedDag = runtime.dags.find((dag) => dag.dagId === runtime.selectedDagId) ?? runtime.dags[0] ?? null;
  const dagWihs = selectedDag ? runtime.wihs.filter((wih) => wih.dagId === selectedDag.dagId) : [];
  const dagPacks = selectedDag ? runtime.contextPacks.filter((pack) => pack.inputs.dagId === selectedDag.dagId) : [];

  async function handleSeal(wih: WihInfo) {
    await runtime.sealContextPack(wih.dagId, wih.nodeId, wih.wihId);
    await runtime.refreshAll();
  }

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="DAG/WIH Integration"
        description="Live mapping between DAG plans, work items, context packs, and execution evidence"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="h-[760px]">
          <CardHeader>
            <CardTitle>DAG Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[650px] pr-4">
              <div className="space-y-3">
                {runtime.dags.map((dag) => {
                  const wihCount = runtime.wihs.filter((wih) => wih.dagId === dag.dagId).length;
                  return (
                    <button
                      key={dag.dagId}
                      type="button"
                      onClick={() => runtime.selectDag(dag.dagId)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selectedDag?.dagId === dag.dagId ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{dag.dagId}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{dag.nodes.length} nodes</Badge>
                        <Badge variant="outline">{wihCount} WIHs</Badge>
                        <Badge variant="outline">
                          {runtime.contextPacks.filter((pack) => pack.inputs.dagId === dag.dagId).length} packs
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedDag?.dagId ?? "No DAG selected"}</CardTitle>
              <CardDescription>Node, WIH, and context-pack relationships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDag ? (
                dagWihs.map((wih) => {
                  const pack = dagPacks.find((contextPack) => contextPack.inputs.wihId === wih.wihId);
                  const receiptCount = runtime.receipts.filter((receipt) => receipt.wihId === wih.wihId).length;
                  return (
                    <div key={wih.wihId} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{wih.title || wih.wihId}</div>
                          <div className="text-xs text-muted-foreground">
                            {wih.nodeId} • {wih.status}
                          </div>
                        </div>
                        <Badge variant={pack ? "secondary" : "outline"}>
                          {pack ? "Context sealed" : "No context pack"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{receiptCount} receipts</Badge>
                        {pack && <Badge variant="outline">{pack.contextPackId.slice(0, 12)}...</Badge>}
                      </div>
                      {!pack && (
                        <Button variant="outline" className="mt-3" onClick={() => void handleSeal(wih)}>
                          Seal Context Pack
                        </Button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Select a DAG to inspect WIH integration.</p>
              )}
            </CardContent>
          </Card>
          <Card className="h-[360px] overflow-hidden">
            <CardHeader>
              <CardTitle>Context Packs</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] p-0">
              <ContextPackBrowser />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ObservabilityDashboardSurface() {
  const runtime = useDagRuntimeData();
  const [nodeId, setNodeId] = useState("");
  const [wihId, setWihId] = useState("");
  const [promptId, setPromptId] = useState("");

  return (
    <div className="space-y-6 p-6">
      <SurfaceHeader
        title="Observability Dashboard"
        description="Operational health, ledger traces, receipts, and graph verification"
        onRefresh={runtime.refreshAll}
        refreshing={runtime.isRefreshing}
      />
      <ErrorBanner error={runtime.error} />
      <StatusCards
        dags={runtime.dags}
        activeExecutions={runtime.activeExecutions}
        wihs={runtime.wihs}
        receipts={runtime.receipts}
        leases={runtime.leases}
        contextPacks={runtime.contextPacks}
        railsConnected={runtime.railsConnected}
      />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ledger Trace</CardTitle>
            <CardDescription>Tail or trace the runtime ledger by node, WIH, or prompt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Node ID" value={nodeId} onChange={(event) => setNodeId(event.target.value)} />
              <Input placeholder="WIH ID" value={wihId} onChange={(event) => setWihId(event.target.value)} />
              <Input placeholder="Prompt ID" value={promptId} onChange={(event) => setPromptId(event.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void runtime.refreshLedger(100)}>
                Tail Ledger
              </Button>
              <Button onClick={() => void runtime.traceLedger({ nodeId, wihId, promptId })}>
                Trace Ledger
              </Button>
            </div>
            <ScrollArea className="h-[480px] rounded-lg border p-4">
              <div className="space-y-3">
                {runtime.ledgerEvents.map((event) => (
                  <div key={event.event_id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{event.event_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {event.scope?.dag_id || "no dag"} / {event.scope?.node_id || "no node"} / {event.scope?.wih_id || "no wih"}
                        </div>
                      </div>
                      <Badge variant="outline">{new Date(event.timestamp).toLocaleString()}</Badge>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gate Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span>Overall</span>
                  <Badge variant={runtime.gateVerify?.ok ? "secondary" : "destructive"}>
                    {runtime.gateVerify?.ok ? "Healthy" : "Attention"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span>Ledger Chain</span>
                  <Badge variant={runtime.gateVerify?.ledger_chain_ok ? "secondary" : "destructive"}>
                    {runtime.gateVerify?.ledger_chain_ok ? "Valid" : "Broken"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span>Cycle DAGs</span>
                  <Badge variant={(runtime.gateVerify?.cycle_dags.length ?? 0) > 0 ? "destructive" : "secondary"}>
                    {runtime.gateVerify?.cycle_dags.length ?? 0}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => void runtime.rerunGateVerify()}>
                Run Verification
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evidence Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptStats receipts={runtime.receipts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
