"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, ArrowRight } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from "@/components/ui/Modal";
import {
  nativeSessionsApi,
  type NativeCatalogSession,
  type NativeHarnessInfo,
} from "@/lib/agents/native-sessions-api";
import { nativeAgentApi } from "@/lib/agents/native-agent-api";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useCodeSessionStore } from "@/views/code/CodeSessionStore";
import { useCoworkSessionStore } from "@/views/cowork/CoworkSessionStore";
import { useDesignSessionStore } from "@/views/design/DesignSessionStore";
import type { AppMode } from "@/shell/ShellHeader";

export const NATIVE_PICKER_EVENT = "allternit:native-session-picker";

export function openNativeSessionPicker(surface: AppMode, sessionMode: "regular" | "agent" = "regular") {
  window.dispatchEvent(new CustomEvent(NATIVE_PICKER_EVENT, { detail: { surface, sessionMode } }));
}

function storeFor(surface: AppMode) {
  if (surface === "code") return useCodeSessionStore;
  if (surface === "cowork") return useCoworkSessionStore;
  if (surface === "design") return useDesignSessionStore;
  return useChatSessionStore;
}

function formatWhen(ts: number): string {
  if (!ts) return "";
  const date = new Date(ts > 1e12 ? ts : ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function NativeSessionPickerHost(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<AppMode>("chat");
  const [sessionMode, setSessionMode] = useState<"regular" | "agent">("regular");

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ surface?: AppMode; sessionMode?: "regular" | "agent" }>).detail;
      setSurface(detail?.surface ?? "chat");
      setSessionMode(detail?.sessionMode ?? "regular");
      setOpen(true);
    };
    window.addEventListener(NATIVE_PICKER_EVENT, onOpen);
    return () => window.removeEventListener(NATIVE_PICKER_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return (
    <NativeSessionPicker
      surface={surface}
      sessionMode={sessionMode}
      onClose={() => setOpen(false)}
    />
  );
}

function NativeSessionPicker({
  surface,
  sessionMode,
  onClose,
}: {
  surface: AppMode;
  sessionMode: "regular" | "agent";
  onClose: () => void;
}): React.ReactNode {
  const [harnesses, setHarnesses] = useState<NativeHarnessInfo[]>([]);
  const [sessions, setSessions] = useState<NativeCatalogSession[]>([]);
  const [harness, setHarness] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([
        nativeSessionsApi.listHarnesses(),
        nativeSessionsApi.list(harness === "all" ? {} : { harness }),
      ]);
      setHarnesses(h);
      setSessions(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [harness]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions.slice(0, 200);
    return sessions
      .filter((s) =>
        [s.harness, s.sessionId, s.title, s.cwd, s.path]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 200);
  }, [query, sessions]);

  const pickup = async (item: NativeCatalogSession) => {
    setPicking(`${item.harness}:${item.sessionId}`);
    setError(null);
    try {
      const result = await nativeSessionsApi.pickup({
        harness: item.harness,
        sessionId: item.sessionId,
        surface,
        cwd: item.cwd,
      });
      const backend = await nativeAgentApi.getSession(result.session.id);
      const store = storeFor(surface);
      store.getState().adoptSession(backend);
      await store.getState().fetchMessages(result.session.id);
      if (sessionMode === "agent") {
        await store.getState().updateSession(result.session.id, {
          metadata: { ...store.getState().sessions.find((s) => s.id === result.session.id)?.metadata, originSurface: surface, sessionMode: "agent" },
        });
      }
      window.dispatchEvent(new CustomEvent("allternit:switch-mode", { detail: { mode: surface } }));
      const viewType = sessionMode === "agent" ? `${surface}-agent-session` : surface;
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", {
          detail: {
            viewType,
            context: sessionMode === "agent" ? { sessionId: result.session.id, originView: surface } : undefined,
          },
        }),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPicking(null);
    }
  };

  const present = harnesses.filter((h) => h.present);

  return (
    <Modal isOpen onClose={onClose} size="large" usePortal>
      <ModalHeader title="Continue a CLI session" onClose={onClose} />
      <ModalBody>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
          Read-only catalog of native harness sessions. Pickup snapshots into Allternit; the original file is not modified.
        </p>
        <div className="flex gap-2 mb-3">
          <select
            value={harness}
            onChange={(e) => setHarness(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-2 py-1.5 text-[12px]"
          >
            <option value="all">All harnesses</option>
            {present.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
          <div className="flex-1 relative">
            <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, title, path…"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] pl-7 pr-2 py-1.5 text-[12px]"
            />
          </div>
        </div>
        {error ? <div className="mb-2 text-[12px] text-[var(--status-error)]">{error}</div> : null}
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
          {loading ? (
            <div className="px-3 py-6 text-center text-[12px] text-[var(--text-secondary)]">Scanning native stores…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-[var(--text-secondary)]">No native sessions found.</div>
          ) : (
            filtered.map((item) => {
              const key = `${item.harness}:${item.sessionId}`;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(picking)}
                  onClick={() => void pickup(item)}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left border-0 border-b border-solid border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    {item.harness}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {item.title || item.sessionId}
                    </span>
                    <span className="block text-[11px] text-[var(--text-tertiary)] truncate">
                      {item.cwd || item.path} · {formatWhen(item.updatedAt)}
                    </span>
                  </span>
                  <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--text-tertiary)]" />
                </button>
              );
            })
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalButton variant="secondary" onClick={onClose}>
          Cancel
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
}
