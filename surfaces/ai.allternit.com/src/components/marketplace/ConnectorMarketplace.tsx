"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listOwnedConnectors,
  connectOwned,
  disconnectOwned,
  type OwnedConnector,
  type OwnedConnectStatus,
} from "@/lib/design/owned-connector";
import { getConnectorLogoUrl } from "@/lib/design/connector-logo";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MagnifyingGlass,
  X,
  Plugs,
  CheckCircle,
  ArrowSquareOut,
  Spinner,
  CaretDown,
} from "@phosphor-icons/react";

export interface ConnectorMarketplaceProps {
  /** Called when the user connects a connector. */
  onConnect?: (connector: OwnedConnector) => void;
  /** Called when the user disconnects a connector. */
  onDisconnect?: (connector: OwnedConnector) => void;
  /** IDs of connectors already bound to the current bot/agent. */
  boundIds?: Set<string>;
  /** If true, selecting a connector also binds it (adds to boundIds). */
  bindOnConnect?: boolean;
  onBind?: (connector: OwnedConnector) => void;
  onUnbind?: (connector: OwnedConnector) => void;
  className?: string;
  /** Group connectors under category headings. */
  groupByCategory?: boolean;
  /**
   * Connector IDs promoted to a "Featured" section above the grid
   * (e.g. ["gmail", "google_drive", "allternit-mail"] from the chat "+" sheet).
   * Featured cards are excluded from the regular grid below.
   */
  featuredIds?: string[];
  /**
   * Agent/bot context for connectors that provision per-agent resources
   * (allternit-mail provisions the agent mailbox when set).
   */
  agentId?: string;
}

/** Catalog id of the platform-native agent mailbox connector. */
const ALLTERNIT_MAIL_CONNECTOR_ID = "allternit-mail";

export function ConnectorMarketplace({
  onConnect,
  onDisconnect,
  boundIds,
  bindOnConnect,
  onBind,
  onUnbind,
  className,
  groupByCategory = true,
  featuredIds,
  agentId,
}: ConnectorMarketplaceProps) {
  const [connectors, setConnectors] = useState<OwnedConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState<Record<string, string>>({});
  const [keyInputId, setKeyInputId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listOwnedConnectors();
      setConnectors(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connectors) {
      const cat = c.category || "Other";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [connectors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectors.filter((c) => {
      const matchesQuery =
        !q ||
        [c.id, c.name, c.category, c.description].some((v) =>
          (v || "").toLowerCase().includes(q),
        );
      const matchesCategory =
        !selectedCategory || (c.category || "Other") === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [connectors, query, selectedCategory]);

  const featuredSet = useMemo(() => new Set(featuredIds ?? []), [featuredIds]);

  const featured = useMemo(() => {
    if (!featuredIds?.length) return [];
    const order = new Map(featuredIds.map((id, i) => [id, i]));
    return filtered
      .filter((c) => featuredSet.has(c.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [filtered, featuredIds, featuredSet]);

  const gridConnectors = useMemo(
    () => (featuredIds?.length ? filtered.filter((c) => !featuredSet.has(c.id)) : filtered),
    [filtered, featuredIds, featuredSet],
  );

  function setInline(id: string, msg: string) {
    setNote((prev) => ({ ...prev, [id]: msg }));
  }

  // Platform-native agent mailbox: with an agent context the connect call
  // provisions the mailbox and returns its address; without one it reports
  // rail status ("available" | "unconfigured") for setup hints.
  async function handleConnectAllternitMail(c: OwnedConnector) {
    setBusyId(c.id);
    try {
      const r = await connectOwned(c.id, agentId ? { agent_id: agentId } : {});
      if (r.status === "connected") {
        const address = (r as { address?: string }).address;
        setInline(c.id, address ? `Mailbox provisioned: ${address}` : "Mailbox provisioned.");
        onConnect?.(c);
        if (bindOnConnect) onBind?.(c);
        await refresh();
      } else if (r.status === "unconfigured") {
        const hint =
          (r as { setup_hint?: string }).setup_hint ?? (r as { message?: string }).message;
        setInline(c.id, hint || "Allternit Mail is not configured on this installation yet.");
      } else {
        const msg = (r as { message?: string }).message;
        setInline(
          c.id,
          msg || "Allternit Mail is available. Connect it from a bot's runtime config to provision a mailbox.",
        );
      }
    } catch (e) {
      setInline(c.id, e instanceof Error ? e.message : "connect failed");
    } finally {
      setBusyId(null);
    }
  }

  const specialConnectHandlers: Record<string, (c: OwnedConnector) => Promise<void>> = {
    [ALLTERNIT_MAIL_CONNECTOR_ID]: handleConnectAllternitMail,
  };

  async function handleConnect(c: OwnedConnector) {
    setInline(c.id, "");

    const special = specialConnectHandlers[c.id];
    if (special) {
      await special(c);
      return;
    }

    if (c.auth_type === "api_key" && !apiKey[c.id]?.trim()) {
      setKeyInputId(c.id);
      return;
    }

    setBusyId(c.id);
    try {
      const r: OwnedConnectStatus = await connectOwned(c.id, {
        api_key: c.auth_type === "api_key" ? apiKey[c.id] : undefined,
      });
      switch (r.status) {
        case "connected":
          setKeyInputId((prev) => (prev === c.id ? null : prev));
          onConnect?.(c);
          if (bindOnConnect) onBind?.(c);
          await refresh();
          break;
        case "authorization_required": {
          const url = (r as { authorize_url?: string }).authorize_url;
          if (url) window.open(url, "_blank", "width=600,height=700");
          setInline(c.id, "Authorize in the opened window, then refresh.");
          break;
        }
        case "oauth_app_registration_required": {
          const env = (r as { set_env?: string }).set_env;
          setInline(
            c.id,
            env
              ? `One-time setup: set ${env}, then Connect again.`
              : "One-time OAuth app required, then Connect again.",
          );
          break;
        }
        case "device_provider_reached":
        case "owned_oauth_endpoint_mapping_needed":
          setInline(c.id, (r as { message?: string }).message || r.status || "Unexpected response");
          break;
        default:
          setInline(c.id, (r as { message?: string }).message || (r.status ? `Status: ${r.status}` : "Connect returned an unexpected response. Please try again."));
      }
    } catch (e) {
      setInline(c.id, e instanceof Error ? e.message : "connect failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisconnect(c: OwnedConnector) {
    setBusyId(c.id);
    try {
      await disconnectOwned(c.id);
      onDisconnect?.(c);
      if (bindOnConnect) onUnbind?.(c);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const isConnected = (c: OwnedConnector) => c.connection?.status === "connected";
  const isBound = (c: OwnedConnector) => boundIds?.has(c.id) ?? false;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${connectors.length} connectors…`}
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {groupByCategory && categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border",
                selectedCategory === null
                  ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
              )}
            >
              All
            </button>
            {categories.slice(0, 12).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border",
                  selectedCategory === cat
                    ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
            <Spinner size={28} className="animate-spin text-[var(--text-tertiary)]" />
            <p className="text-sm">Loading connector catalog…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <Plugs size={40} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm">No connectors match your search.</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-6">
                <h4 className="flex items-center gap-2 mb-3 px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Featured
                  <span className="ml-auto text-[11px] normal-case opacity-80">{featured.length}</span>
                </h4>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                  <AnimatePresence>
                    {featured.map((c) => (
                      <ConnectorCard
                        key={c.id}
                        connector={c}
                        featured
                        busyId={busyId}
                        notes={note}
                        keyInputId={keyInputId}
                        apiKey={apiKey}
                        setApiKey={setApiKey}
                        setKeyInputId={setKeyInputId}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onBind={onBind}
                        onUnbind={onUnbind}
                        isConnected={isConnected}
                        isBound={isBound}
                        bindOnConnect={bindOnConnect}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
            {groupByCategory && !query && !selectedCategory ? (
              <GroupedConnectorGrid
                connectors={gridConnectors}
                busyId={busyId}
                notes={note}
                keyInputId={keyInputId}
                apiKey={apiKey}
                setApiKey={setApiKey}
                setKeyInputId={setKeyInputId}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onBind={onBind}
                onUnbind={onUnbind}
                isConnected={isConnected}
                isBound={isBound}
                bindOnConnect={bindOnConnect}
              />
            ) : (
              <ConnectorGrid
                connectors={gridConnectors}
                busyId={busyId}
                notes={note}
                keyInputId={keyInputId}
                apiKey={apiKey}
                setApiKey={setApiKey}
                setKeyInputId={setKeyInputId}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onBind={onBind}
                onUnbind={onUnbind}
                isConnected={isConnected}
                isBound={isBound}
                bindOnConnect={bindOnConnect}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConnectorGridProps {
  connectors: OwnedConnector[];
  busyId: string | null;
  notes: Record<string, string>;
  keyInputId: string | null;
  apiKey: Record<string, string>;
  setApiKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setKeyInputId: React.Dispatch<React.SetStateAction<string | null>>;
  onConnect: (c: OwnedConnector) => void;
  onDisconnect: (c: OwnedConnector) => void;
  onBind?: (c: OwnedConnector) => void;
  onUnbind?: (c: OwnedConnector) => void;
  isConnected: (c: OwnedConnector) => boolean;
  isBound?: (c: OwnedConnector) => boolean;
  bindOnConnect?: boolean;
}

function ConnectorGrid({
  connectors,
  busyId,
  notes,
  keyInputId,
  apiKey,
  setApiKey,
  setKeyInputId,
  onConnect,
  onDisconnect,
  onBind,
  onUnbind,
  isConnected,
  isBound,
  bindOnConnect,
}: ConnectorGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      <AnimatePresence>
        {connectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            busyId={busyId}
            notes={notes}
            keyInputId={keyInputId}
            apiKey={apiKey}
            setApiKey={setApiKey}
            setKeyInputId={setKeyInputId}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onBind={onBind}
            onUnbind={onUnbind}
            isConnected={isConnected}
            isBound={isBound}
            bindOnConnect={bindOnConnect}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function GroupedConnectorGrid(props: ConnectorGridProps) {
  const groups = useMemo(() => {
    const map = new Map<string, OwnedConnector[]>();
    for (const c of props.connectors) {
      const cat = c.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [props.connectors]);

  return (
    <div className="space-y-6">
      {groups.map(([category, items]) => (
        <section key={category}>
          <h4 className="sticky top-0 z-10 flex items-center gap-2 mb-3 px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-elevated)]/90 backdrop-blur-sm">
            <CaretDown size={12} />
            {category}
            <span className="ml-auto text-[11px] normal-case opacity-80">{items.length}</span>
          </h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            <AnimatePresence>
              {items.map((c) => (
                <ConnectorCard
                  key={c.id}
                  connector={c}
                  busyId={props.busyId}
                  notes={props.notes}
                  keyInputId={props.keyInputId}
                  apiKey={props.apiKey}
                  setApiKey={props.setApiKey}
                  setKeyInputId={props.setKeyInputId}
                  onConnect={props.onConnect}
                  onDisconnect={props.onDisconnect}
                  onBind={props.onBind}
                  onUnbind={props.onUnbind}
                  isConnected={props.isConnected}
                  isBound={props.isBound}
                  bindOnConnect={props.bindOnConnect}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}

interface ConnectorCardProps extends Omit<ConnectorGridProps, "connectors"> {
  connector: OwnedConnector;
  /** Larger toggle-style card used in the Featured section. */
  featured?: boolean;
}

function ConnectorCard({
  connector: c,
  featured,
  busyId,
  notes,
  keyInputId,
  apiKey,
  setApiKey,
  setKeyInputId,
  onConnect,
  onDisconnect,
  onBind,
  onUnbind,
  isConnected,
  isBound,
  bindOnConnect,
}: ConnectorCardProps) {
  const connected = isConnected(c);
  const bound = isBound?.(c);
  const { url: logo } = getConnectorLogoUrl(c.base_url, c.id, featured ? 48 : 32);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group rounded-xl border flex flex-col gap-3 transition-colors",
        featured ? "p-5" : "p-4",
        connected || bound
          ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--surface-hover)]",
      )}
    >
      <div className="flex items-start gap-3">
        {logo ? (
          <img
            src={logo}
            alt={c.name}
            className={cn(
              "rounded-lg object-contain bg-[var(--bg-primary)] p-1",
              featured ? "w-11 h-11" : "w-9 h-9",
            )}
          />
        ) : (
          <div
            className={cn(
              "rounded-lg flex items-center justify-center",
              featured ? "w-11 h-11" : "w-9 h-9",
            )}
            style={{ background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)" }}
          >
            <span
              className="text-[13px] font-bold uppercase"
              style={{ color: "var(--accent-primary)" }}
            >
              {c.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[var(--text-primary)] text-[13px] truncate">
              {c.name}
            </span>
            {(connected || bound) && (
              <CheckCircle size={14} className="text-[var(--accent-primary)] shrink-0" />
            )}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] capitalize">
            {c.auth_type}
          </div>
        </div>
      </div>

      <p className={cn("text-[12px] text-[var(--text-secondary)] flex-1", featured ? "line-clamp-3" : "line-clamp-2")}>
        {c.description || `${c.name} connector`}
      </p>

      {notes[c.id] && (
        <p className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-primary)] rounded-md p-2">
          {notes[c.id]}
        </p>
      )}

      {keyInputId === c.id && (
        <div className="flex flex-col gap-2">
          <Input
            type="password"
            placeholder={`${c.name} API key`}
            value={apiKey[c.id] ?? ""}
            onChange={(e) => setApiKey((prev) => ({ ...prev, [c.id]: e.target.value }))}
            className="h-8 text-[12px] bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConnect(c);
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 text-[12px] h-8"
              onClick={() => onConnect(c)}
              disabled={busyId === c.id || !apiKey[c.id]?.trim()}
            >
              {busyId === c.id ? <Spinner size={14} className="animate-spin" /> : "Save & Connect"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-[12px] h-8"
              onClick={() => setKeyInputId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        {connected ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 text-[12px] h-8"
              onClick={() => onDisconnect(c)}
              disabled={busyId === c.id}
            >
              {busyId === c.id ? <Spinner size={14} className="animate-spin" /> : "Disconnect"}
            </Button>
            {bindOnConnect && (
              <Button
                type="button"
                size="sm"
                variant={bound ? "default" : "outline"}
                className="flex-1 text-[12px] h-8"
                onClick={() => (bound ? onUnbind?.(c) : onBind?.(c))}
              >
                {bound ? "Bound" : "Bind"}
              </Button>
            )}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="flex-1 text-[12px] h-8"
            onClick={() => onConnect(c)}
            disabled={busyId === c.id}
          >
            {busyId === c.id ? (
              <Spinner size={14} className="animate-spin" />
            ) : c.auth_type === "no_auth" ? (
              "Add"
            ) : (
              "Connect"
            )}
          </Button>
        )}
        {c.base_url && (
          <a
            href={c.base_url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            title="Open website"
          >
            <ArrowSquareOut size={14} />
          </a>
        )}
      </div>
    </motion.div>
  );
}
