"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cloud,
  Plus,
  Spinner,
  ArrowsClockwise,
  Warning,
  Copy,
  Check,
  HardDrives,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassSurface } from "@/design/GlassSurface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  listResourceClasses,
  createResource,
  getResource,
  terminateResource,
  getCreditBalance,
  listCreditTransactions,
  createEnrollmentToken,
  listEnrollmentTokens,
  listFabricNodes,
  approveFabricNode,
  rejectFabricNode,
  type ResourceClass,
  type FabricResource,
  type CreditBalance,
  type CreditTransaction,
  type EnrollmentToken,
  type FabricNode,
  type CreateResourceResponse,
} from "@/lib/cloud-console-api";

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function initialLoadable<T>(data: T): Loadable<T> {
  return { data, loading: false, error: null };
}

function setLoading<T>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>, loading: boolean) {
  setter((prev) => ({ ...prev, loading }));
}

function setError<T>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>, error: string | null) {
  setter((prev) => ({ ...prev, error }));
}

function handleApiError(err: unknown, context: string): string {
  const message = err instanceof Error ? err.message : String(err);
  return `${context}: ${message}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function mapResourceStatus(status: string): "running" | "pending" | "failed" | "stopped" {
  const s = status.toLowerCase();
  if (s === "active" || s === "running") return "running";
  if (s === "pending" || s === "provisioning") return "pending";
  if (s === "terminated" || s === "stopped") return "stopped";
  return "failed";
}

function StatusChip({ status, text }: { status: string; text?: string }) {
  const mapped = mapResourceStatus(status);
  const config = {
    running: { icon: CheckCircle, color: "text-green-400 bg-green-400/10", label: "Active" },
    pending: { icon: Clock, color: "text-blue-400 bg-blue-400/10", label: "Pending" },
    stopped: { icon: XCircle, color: "text-zinc-400 bg-zinc-400/10", label: "Stopped" },
    failed: { icon: Warning, color: "text-red-400 bg-red-400/10", label: "Failed" },
  }[mapped];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${config.color}`}>
      <Icon className="size-3" />
      <span>{text || config.label}</span>
    </span>
  );
}

export function CloudConsoleView(): React.ReactNode {
  const [activeTab, setActiveTab] = useState("resources");

  // Resources
  const [resourceClasses, setResourceClasses] = useState<Loadable<ResourceClass[]>>(initialLoadable([]));
  const [resources, setResources] = useState<Loadable<FabricResource[]>>(initialLoadable([]));
  const [createForm, setCreateForm] = useState({ class: "", displayName: "" });
  const [creating, setCreating] = useState(false);

  // Credits
  const [balance, setBalance] = useState<Loadable<CreditBalance>>(initialLoadable({ organization_id: "", balance_cents: 0, currency: "USD" }));
  const [transactions, setTransactions] = useState<Loadable<CreditTransaction[]>>(initialLoadable([]));

  // Private Fabric
  const [tokens, setTokens] = useState<Loadable<EnrollmentToken[]>>(initialLoadable([]));
  const [nodes, setNodes] = useState<Loadable<FabricNode[]>>(initialLoadable([]));
  const [tokenDisplayName, setTokenDisplayName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const anyError = useMemo(
    () =>
      resourceClasses.error ||
      resources.error ||
      balance.error ||
      transactions.error ||
      tokens.error ||
      nodes.error,
    [resourceClasses.error, resources.error, balance.error, transactions.error, tokens.error, nodes.error],
  );

  const loadResourceClasses = useCallback(async () => {
    setLoading(setResourceClasses, true);
    setError(setResourceClasses, null);
    try {
      const data = await listResourceClasses();
      setResourceClasses({ data, loading: false, error: null });
      if (data.length > 0 && !createForm.class) {
        setCreateForm((prev) => ({ ...prev, class: data[0].class }));
      }
    } catch (err) {
      setResourceClasses((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load resource classes") }));
    }
  }, [createForm.class]);

  const loadResources = useCallback(async () => {
    // Resources are loaded indirectly after create; no list endpoint exists yet.
    // Keep local array of created resources.
    setLoading(setResources, false);
  }, []);

  const loadCredits = useCallback(async () => {
    setLoading(setBalance, true);
    setLoading(setTransactions, true);
    setError(setBalance, null);
    setError(setTransactions, null);
    try {
      const [bal, txns] = await Promise.all([getCreditBalance(), listCreditTransactions()]);
      setBalance({ data: bal, loading: false, error: null });
      setTransactions({ data: txns, loading: false, error: null });
    } catch (err) {
      const error = handleApiError(err, "Failed to load credits");
      setBalance((prev) => ({ ...prev, loading: false, error }));
      setTransactions((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const loadTokens = useCallback(async () => {
    setLoading(setTokens, true);
    setError(setTokens, null);
    try {
      const data = await listEnrollmentTokens();
      setTokens({ data, loading: false, error: null });
    } catch (err) {
      setTokens((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load enrollment tokens") }));
    }
  }, []);

  const loadNodes = useCallback(async () => {
    setLoading(setNodes, true);
    setError(setNodes, null);
    try {
      const data = await listFabricNodes();
      setNodes({ data, loading: false, error: null });
    } catch (err) {
      setNodes((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load nodes") }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadResourceClasses(),
      loadResources(),
      loadCredits(),
      loadTokens(),
      loadNodes(),
    ]);
  }, [loadResourceClasses, loadResources, loadCredits, loadTokens, loadNodes]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleCreateResource = async () => {
    if (!createForm.class) return;
    setCreating(true);
    try {
      const created: CreateResourceResponse = await createResource({
        class: createForm.class,
        display_name: createForm.displayName || undefined,
      });
      const detail = await getResource(created.resource_id);
      setResources((prev) => ({ ...prev, data: [detail, ...prev.data] }));
      setCreateForm((prev) => ({ ...prev, displayName: "" }));
    } catch (err) {
      setResources((prev) => ({ ...prev, error: handleApiError(err, "Failed to create resource") }));
    } finally {
      setCreating(false);
    }
  };

  const handleTerminate = async (id: string) => {
    setResources((prev) => ({
      ...prev,
      data: prev.data.map((r) => (r.id === id ? { ...r, status: "terminating" } : r)),
    }));
    try {
      await terminateResource(id);
      const detail = await getResource(id);
      setResources((prev) => ({
        ...prev,
        data: prev.data.map((r) => (r.id === id ? detail : r)),
      }));
    } catch (err) {
      setResources((prev) => ({ ...prev, error: handleApiError(err, "Failed to terminate resource") }));
    }
  };

  const handleCreateToken = async () => {
    setCreatingToken(true);
    try {
      const created = await createEnrollmentToken(tokenDisplayName || undefined);
      setTokens((prev) => ({ ...prev, data: [created, ...prev.data] }));
      setTokenDisplayName("");
    } catch (err) {
      setTokens((prev) => ({ ...prev, error: handleApiError(err, "Failed to create enrollment token") }));
    } finally {
      setCreatingToken(false);
    }
  };

  const copyToken = (token: EnrollmentToken) => {
    if (!token.token) return;
    void navigator.clipboard.writeText(token.token);
    setCopiedTokenId(token.id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleApproveNode = async (id: string) => {
    try {
      await approveFabricNode(id);
      await loadNodes();
    } catch (err) {
      setNodes((prev) => ({ ...prev, error: handleApiError(err, "Failed to approve node") }));
    }
  };

  const handleRejectNode = async (id: string) => {
    try {
      await rejectFabricNode(id);
      await loadNodes();
    } catch (err) {
      setNodes((prev) => ({ ...prev, error: handleApiError(err, "Failed to reject node") }));
    }
  };

  const activeCount = resources.data.filter((r) => r.status === "active" || r.status === "running").length;
  const anyLoading =
    resourceClasses.loading ||
    creating ||
    balance.loading ||
    transactions.loading ||
    tokens.loading ||
    nodes.loading ||
    creatingToken;

  return (
    <div className="size-full overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Cloud size={22} weight="fill" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cloud Console</h1>
              <p className="text-sm text-[var(--ui-text-muted)]">
                Manage compute resources, credits, and Private Fabric nodes
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={anyLoading}>
            {anyLoading ? <Spinner size={16} className="animate-spin" /> : <ArrowsClockwise size={16} />}
            Refresh
          </Button>
        </div>

        {anyError && (
          <GlassSurface intensity="thin" className="flex items-center gap-3 bg-red-500/10 text-sm text-red-300">
            <Warning size={18} />
            {anyError}
          </GlassSurface>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Active Resources</div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Classes</div>
            <div className="text-2xl font-bold">{resourceClasses.data.length}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Credit Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(balance.data.balance_cents)}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Fabric Nodes</div>
            <div className="text-2xl font-bold">{nodes.data.length}</div>
          </GlassSurface>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="resources">
              <HardDrives size={16} className="mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="credits">
              <Coins size={16} className="mr-2" />
              Credits
            </TabsTrigger>
            <TabsTrigger value="fabric">
              <HardDrives size={16} className="mr-2" />
              Private Fabric
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "resources" && (
          <div className="space-y-6">
            <GlassSurface intensity="base" className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Create Resource</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-[var(--ui-text-muted)]">Class</label>
                  <select
                    className="w-full rounded-lg border border-[var(--ui-border-default)] bg-[var(--surface-hover)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={createForm.class}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, class: e.target.value }))}
                  >
                    {resourceClasses.data.map((rc) => (
                      <option key={rc.id} value={rc.class}>
                        {rc.display_name} — {rc.vcpu} vCPU, {rc.memory_mib} MiB, {formatCurrency(rc.retail_price_per_hour_cents)}/hr
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-[var(--ui-text-muted)]">Display name</label>
                  <Input
                    placeholder="e.g. training-worker-1"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateResource} disabled={creating || !createForm.class}>
                  {creating ? <Spinner size={16} className="animate-spin" /> : <Plus size={16} />}
                  Create
                </Button>
              </div>
            </GlassSurface>

            <GlassSurface intensity="base" className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Resources</h2>
              {resources.data.length === 0 ? (
                <p className="text-sm text-[var(--ui-text-muted)]">No resources yet. Create one above.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Price/hr</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resources.data.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell className="font-medium">
                          {resource.display_name || resource.id}
                        </TableCell>
                        <TableCell>
                          {resource.kind}.{resource.class}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={resource.status} />
                        </TableCell>
                        <TableCell>{resource.provider_kind || "—"}</TableCell>
                        <TableCell>{resource.region || "—"}</TableCell>
                        <TableCell>
                          {resource.placement
                            ? formatCurrency(resource.placement.retail_price_per_hour_cents)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {resource.status !== "terminated" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTerminate(resource.id)}
                              disabled={resource.status === "terminating"}
                            >
                              Terminate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassSurface>
          </div>
        )}

        {activeTab === "credits" && (
          <div className="space-y-6">
            <GlassSurface intensity="base" className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                  Available Balance
                </div>
                <div className="text-3xl font-bold">{formatCurrency(balance.data.balance_cents)}</div>
              </div>
              <div className="text-right text-sm text-[var(--ui-text-muted)]">
                Currency: {balance.data.currency}
              </div>
            </GlassSurface>

            <GlassSurface intensity="base" className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Transactions</h2>
              {transactions.data.length === 0 ? (
                <p className="text-sm text-[var(--ui-text-muted)]">No transactions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.data.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="capitalize">{tx.transaction_type}</TableCell>
                        <TableCell className={tx.amount_cents >= 0 ? "text-green-400" : "text-red-400"}>
                          {tx.amount_cents >= 0 ? "+" : ""}
                          {formatCurrency(tx.amount_cents)}
                        </TableCell>
                        <TableCell className="text-[var(--ui-text-muted)]">{tx.reference_id || "—"}</TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassSurface>
          </div>
        )}

        {activeTab === "fabric" && (
          <div className="space-y-6">
            <GlassSurface intensity="base" className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">
                Enrollment Tokens
              </h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-[var(--ui-text-muted)]">Display name</label>
                  <Input
                    placeholder="e.g. desktop-rig"
                    value={tokenDisplayName}
                    onChange={(e) => setTokenDisplayName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateToken} disabled={creatingToken}>
                  {creatingToken ? <Spinner size={16} className="animate-spin" /> : <Plus size={16} />}
                  Create Token
                </Button>
              </div>
              {tokens.data.length === 0 ? (
                <p className="text-sm text-[var(--ui-text-muted)]">No enrollment tokens yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Node</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Token</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.data.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.display_name || "—"}</TableCell>
                        <TableCell>
                          <StatusChip status={token.status} text={token.status} />
                        </TableCell>
                        <TableCell className="text-[var(--ui-text-muted)]">{token.node_id || "—"}</TableCell>
                        <TableCell>{formatDate(token.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {token.token ? (
                            <Button variant="ghost" size="sm" onClick={() => copyToken(token)}>
                              {copiedTokenId === token.id ? (
                                <>
                                  <Check size={16} className="text-green-400" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={16} /> Copy
                                </>
                              )}
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassSurface>

            <GlassSurface intensity="base" className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Nodes</h2>
              {nodes.data.length === 0 ? (
                <p className="text-sm text-[var(--ui-text-muted)]">No nodes enrolled yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Last heartbeat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.data.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">{node.display_name || node.id}</TableCell>
                        <TableCell>
                          <StatusChip status={node.status} text={node.status} />
                        </TableCell>
                        <TableCell>{node.region || "—"}</TableCell>
                        <TableCell>{formatDate(node.last_heartbeat_at)}</TableCell>
                        <TableCell className="text-right">
                          {node.status === "pending" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleApproveNode(node.id)}>
                                Approve
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleRejectNode(node.id)}>
                                Reject
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassSurface>
          </div>
        )}
      </div>
    </div>
  );
}
