"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  DesktopTower,
  Plugs,
  Warning,
  WifiHigh,
  Cpu,
} from "@phosphor-icons/react";
import { openFabricSessionWindow } from "@/lib/open-fabric-session-window";
import { FabricSessionQrCard } from "@/components/dispatch/FabricSessionQrCard";
import { fabricSessionPwaUrl } from "@/lib/fabric-session-pwa";

type FabricEndpoint = {
  transport?: string;
  url?: string;
  priority?: number;
};

type FabricCapability = string | { id?: string; name?: string; description?: string; kind?: string };

type FabricResource = {
  kind?: string;
  name?: string;
  value?: string | number;
  unit?: string;
};

type FabricPeer = {
  id?: string;
  nodeId?: string;
  name?: string;
  hostname?: string;
  endpoints?: FabricEndpoint[];
  capabilities?: FabricCapability[];
  resources?: FabricResource[];
  status?: string;
  runtimeType?: string;
  platform?: string;
  version?: string;
};

type WorkerManifest = {
  name?: string;
  version?: string;
  capabilities?: FabricCapability[];
};

type LoadState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

async function fabricGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || `Fabric request failed (${response.status})`,
    );
  }
  return payload as T;
}

function capabilityLabel(value: FabricCapability): string {
  if (typeof value === "string") return value;
  return value.name || value.id || "capability";
}

function nodeLabel(peer: FabricPeer | null | undefined): string {
  return peer?.name || peer?.hostname || "This desktop";
}

function nodeId(peer: FabricPeer | null | undefined): string {
  return peer?.nodeId || peer?.id || "local";
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      aria-hidden
    />
  );
}

export function FabricTransportView(): React.ReactNode {
  const [localPeer, setLocalPeer] = useState<LoadState<FabricPeer>>({
    loading: true,
    error: null,
    data: null,
  });
  const [peers, setPeers] = useState<LoadState<FabricPeer[]>>({
    loading: true,
    error: null,
    data: null,
  });
  const [directory, setDirectory] = useState<LoadState<Record<string, unknown>>>({
    loading: true,
    error: null,
    data: null,
  });
  const [worker, setWorker] = useState<LoadState<WorkerManifest>>({
    loading: true,
    error: null,
    data: null,
  });
  const [runtimeId, setRuntimeId] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLocalPeer((s) => ({ ...s, loading: true, error: null }));
    setPeers((s) => ({ ...s, loading: true, error: null }));
    setDirectory((s) => ({ ...s, loading: true, error: null }));
    setWorker((s) => ({ ...s, loading: true, error: null }));

    const [localResult, peersResult, directoryResult, workerResult] = await Promise.allSettled([
      fabricGet<FabricPeer>("/fabric/peers/local"),
      fabricGet<FabricPeer[] | { peers?: FabricPeer[] }>("/fabric/peers"),
      fabricGet<Record<string, unknown>>("/fabric/directory"),
      fabricGet<WorkerManifest>("/fabric/workers/self"),
    ]);

    if (localResult.status === "fulfilled") {
      setLocalPeer({ loading: false, error: null, data: localResult.value });
    } else {
      setLocalPeer({
        loading: false,
        error: localResult.reason instanceof Error ? localResult.reason.message : String(localResult.reason),
        data: null,
      });
    }

    if (peersResult.status === "fulfilled") {
      const value = peersResult.value;
      const list = Array.isArray(value) ? value : value.peers ?? [];
      setPeers({ loading: false, error: null, data: list });
    } else {
      setPeers({
        loading: false,
        error: peersResult.reason instanceof Error ? peersResult.reason.message : String(peersResult.reason),
        data: [],
      });
    }

    if (directoryResult.status === "fulfilled") {
      setDirectory({ loading: false, error: null, data: directoryResult.value });
    } else {
      setDirectory({
        loading: false,
        error:
          directoryResult.reason instanceof Error
            ? directoryResult.reason.message
            : String(directoryResult.reason),
        data: null,
      });
    }

    if (workerResult.status === "fulfilled") {
      setWorker({ loading: false, error: null, data: workerResult.value });
    } else {
      setWorker({
        loading: false,
        error: workerResult.reason instanceof Error ? workerResult.reason.message : String(workerResult.reason),
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    void window.allternit?.auth
      ?.getSession?.()
      .then((session) => {
        if (!cancelled && session?.runtimeId) setRuntimeId(session.runtimeId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const endpoints = localPeer.data?.endpoints ?? [];
  const capabilities = localPeer.data?.capabilities ?? worker.data?.capabilities ?? [];
  const resources = localPeer.data?.resources ?? [];
  const peerList = useMemo(() => {
    const list = peers.data ?? [];
    const selfId = nodeId(localPeer.data);
    return list.filter((peer) => nodeId(peer) !== selfId);
  }, [peers.data, localPeer.data]);
  const online = Boolean(localPeer.data) && !localPeer.error;
  const transportLabel = endpoints[0]?.transport || (online ? "local" : "offline");

  return (
    <div className="h-full w-full overflow-y-auto bg-white text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-6xl px-8 pt-10 pb-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="m-0 text-3xl font-medium tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Fabric Transport
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              This desktop is a fabric node. Scan the QR to open the standalone
              Fabric Session app on your phone.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openFabricSessionWindow()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowSquareOut size={14} />
              Open session
            </button>
            <a
              href={fabricSessionPwaUrl(runtimeId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-secondary)] no-underline transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowSquareOut size={14} />
              Open on the web
            </a>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowsClockwise size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6">
          <FabricSessionQrCard runtimeId={runtimeId} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<DesktopTower size={16} />}
            label="This node"
            value={localPeer.loading ? "Loading…" : online ? nodeLabel(localPeer.data) : "Unreachable"}
            detail={online ? nodeId(localPeer.data) : localPeer.error || "Waiting for gateway"}
            ok={online}
            capitalize={false}
          />
          <StatCard
            icon={<WifiHigh size={16} />}
            label="Transport"
            value={localPeer.loading ? "Loading…" : transportLabel}
            detail={endpoints[0]?.url || "Loopback until mesh or tunnel joins"}
            ok={online}
          />
          <StatCard
            icon={<Cpu size={16} />}
            label="Capabilities"
            value={String(capabilities.length)}
            detail={worker.data?.name ? `Worker ${worker.data.name}` : "Session worker"}
            ok={capabilities.length > 0}
          />
          <StatCard
            icon={<Plugs size={16} />}
            label="Peers"
            value={String(peerList.length)}
            detail={peerList.length === 0 ? "Only this desktop so far" : "Other fabric nodes"}
            ok={!peers.error}
          />
        </div>

        <section className="mt-6 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <DesktopTower size={16} />
              This node
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
              <StatusDot ok={online} />
              {online ? localPeer.data?.status || "online" : "offline"}
            </span>
          </div>
          {localPeer.loading && (
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">Reading local fabric identity…</p>
          )}
          {localPeer.error && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-red-500">
              <Warning size={14} className="mt-0.5 shrink-0" />
              {localPeer.error}
            </p>
          )}
          {localPeer.data && (
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
              <InfoRow label="Name" value={nodeLabel(localPeer.data)} />
              <InfoRow label="Node id" value={nodeId(localPeer.data)} mono />
              <InfoRow label="Runtime" value={localPeer.data.runtimeType || "desktop"} />
              <InfoRow label="Platform" value={localPeer.data.platform || "local"} />
              <InfoRow label="Version" value={localPeer.data.version || "—"} />
              <InfoRow
                label="Worker"
                value={
                  worker.data?.name
                    ? `${worker.data.name}${worker.data.version ? ` ${worker.data.version}` : ""}`
                    : "Harness runtime"
                }
              />
            </dl>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Plugs size={16} />
            Transports
          </div>
          {endpoints.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
              Local loopback is the active transport until Tailscale mesh or a tunnel joins.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
              {endpoints.map((endpoint, index) => (
                <li key={`${endpoint.transport}-${index}`} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2 text-[13px] font-medium capitalize">
                      <CheckCircle size={14} className="text-emerald-500" />
                      {endpoint.transport || "local"}
                    </div>
                    <div className="mt-1 break-all font-mono text-[12px] text-[var(--text-tertiary)]">
                      {endpoint.url}
                    </div>
                  </div>
                  {typeof endpoint.priority === "number" && (
                    <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                      priority {endpoint.priority}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {resources.length > 0 && (
          <section className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
            <div className="text-[13px] font-semibold">Resources</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {resources.map((resource, index) => (
                <div
                  key={`${resource.kind}-${index}`}
                  className="rounded-xl border border-solid border-[var(--border-subtle)] px-3 py-2.5"
                >
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    {resource.name || resource.kind || "resource"}
                  </div>
                  <div className="mt-1 text-[14px] font-medium">
                    {resource.value}
                    {resource.unit ? ` ${resource.unit}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
          <div className="text-[13px] font-semibold">Capabilities</div>
          {capabilities.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
              No advertised capabilities yet. The session worker publishes them once this node is live.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {capabilities.map((cap, index) => (
                <span
                  key={`${capabilityLabel(cap)}-${index}`}
                  className="rounded-full border border-solid border-[var(--border-default)] bg-white px-2.5 py-1 text-[12px]"
                  title={typeof cap === "object" ? cap.description : undefined}
                >
                  {capabilityLabel(cap)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
          <div className="text-[13px] font-semibold">Peers</div>
          {peers.loading && (
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">Resolving fabric peers…</p>
          )}
          {peers.error && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-red-500">
              <Warning size={14} className="mt-0.5 shrink-0" />
              {peers.error}
            </p>
          )}
          {!peers.loading && peerList.length === 0 && !peers.error && (
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
              No other fabric peers yet. This desktop is the local node.
            </p>
          )}
          {peerList.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
              {peerList.map((peer, index) => (
                <li key={nodeId(peer) || String(index)} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-[13px] font-medium">{nodeLabel(peer)}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                      {nodeId(peer)}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                    <StatusDot ok={(peer.status || "online") === "online"} />
                    {peer.status || "online"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {directory.data && (
          <details className="mt-4 rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5">
            <summary className="cursor-pointer text-[13px] font-semibold">Node directory</summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-[#F7F7F7] p-3 text-[11px] leading-relaxed">
              {JSON.stringify(directory.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  ok,
  capitalize = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  ok: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-white p-4">
      <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <StatusDot ok={ok} />
      </div>
      <div className={`mt-2 truncate text-[15px] font-medium ${capitalize ? "capitalize" : ""}`}>{value}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-tertiary)]">{detail}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-[var(--text-tertiary)]">{label}</dt>
      <dd className={`m-0 break-all ${mono ? "font-mono text-[12px]" : ""}`}>{value}</dd>
    </div>
  );
}

export default FabricTransportView;
