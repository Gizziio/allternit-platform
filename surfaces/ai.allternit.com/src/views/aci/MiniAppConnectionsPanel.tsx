"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CircleNotch, PlugsConnected, Warning } from "@phosphor-icons/react";
import type {
  InstalledMiniApp,
  MiniAppOAuthProviderContract,
} from "./mini-app.types";
import { oauthProviderDisplayName } from "./mini-app-permissions-explain";

/** Metadata the desktop broker exposes to the renderer; tokens never cross. */
interface OAuthAccountMetadata {
  appId: string;
  providerId: string;
  accountId: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  lastRefreshedAt?: string;
  needsReauth: boolean;
}

const DEFAULT_ACCOUNT_ID = "default";

export function MiniAppConnectionsPanel({ app }: { app: InstalledMiniApp }) {
  const api =
    typeof window !== "undefined" ? window.allternit?.miniApps : undefined;
  const providers = Object.entries(app.oauth ?? {});
  const [accounts, setAccounts] = useState<OAuthAccountMetadata[]>([]);
  const [flowErrors, setFlowErrors] = useState<Record<string, string>>({});
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<
    string | null
  >(null);

  const refresh = useCallback(async () => {
    if (!api?.oauthAccounts) return;
    try {
      setAccounts(await api.oauthAccounts(app.id));
    } catch {
      // Desktop broker unreachable; leave the last known state in place.
    }
  }, [api, app.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!api?.onOAuthComplete) return;
    return api.onOAuthComplete((result) => {
      if (result.appId !== app.id) return;
      setPendingProvider(null);
      if (result.success) {
        setFlowErrors((current) => ({
          ...current,
          [result.providerId]: "",
        }));
        void refresh();
      } else {
        setFlowErrors((current) => ({
          ...current,
          [result.providerId]: result.error || "Connection failed",
        }));
      }
    });
  }, [api, app.id, refresh]);

  if (!providers.length) return null;

  const connect = async (
    providerId: string,
    provider: MiniAppOAuthProviderContract,
  ) => {
    if (!api?.oauthStart) return;
    setFlowErrors((current) => ({ ...current, [providerId]: "" }));
    setPendingProvider(providerId);
    const result = await api.oauthStart(
      app.id,
      providerId,
      provider,
      DEFAULT_ACCOUNT_ID,
    );
    if (result.error) {
      setFlowErrors((current) => ({ ...current, [providerId]: result.error! }));
      setPendingProvider(null);
    }
    // Otherwise the flow continues in the system browser; onOAuthComplete
    // settles the pending state.
  };

  const disconnect = async (providerId: string, accountId: string) => {
    if (!api?.oauthDisconnect) return;
    const result = await api.oauthDisconnect(app.id, providerId, accountId);
    if (!result.success) {
      setFlowErrors((current) => ({
        ...current,
        [providerId]: result.error || "Disconnect failed",
      }));
      return;
    }
    setConfirmingDisconnect(null);
    await refresh();
  };

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PlugsConnected size={16} />
        Connected accounts
      </div>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Authorized through Allternit Desktop in your browser. Tokens never leave
        the desktop.
      </p>
      <div className="mt-4 space-y-4">
        {providers.map(([providerId, provider]) => {
          const account = accounts.find(
            (entry) => entry.providerId === providerId,
          );
          const expired = Boolean(
            account?.expiresAt && Date.parse(account.expiresAt) < Date.now(),
          );
          const healthy = Boolean(account && !account.needsReauth && !expired);
          const flowError = flowErrors[providerId];
          const pending = pendingProvider === providerId;
          return (
            <div key={providerId}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block size-2 rounded-full ${
                      healthy
                        ? "bg-green-500"
                        : account
                          ? "bg-amber-500"
                          : "bg-[var(--text-tertiary)] opacity-40"
                    }`}
                  />
                  {oauthProviderDisplayName(providerId)}
                </span>
                {account ? (
                  confirmingDisconnect === providerId ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void disconnect(providerId, account.accountId)
                        }
                        className="text-red-500 hover:underline"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDisconnect(null)}
                        className="text-[var(--text-tertiary)] hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDisconnect(providerId)}
                      disabled={!api?.oauthDisconnect}
                      className="text-[var(--text-tertiary)] hover:text-red-500 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => void connect(providerId, provider)}
                    disabled={!api?.oauthStart || pending}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 disabled:opacity-50"
                  >
                    {pending && (
                      <CircleNotch size={12} className="animate-spin" />
                    )}
                    {pending ? "Waiting for browser…" : "Connect"}
                  </button>
                )}
              </div>
              {account && (
                <div className="mt-1.5 space-y-1.5 pl-4">
                  {account.scopes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {account.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  )}
                  {account.expiresAt && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Token expires{" "}
                      {new Date(account.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  {(account.needsReauth || expired) && (
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-500">
                      <Warning size={12} />
                      {expired
                        ? "Authorization expired."
                        : "Authorization needs to be renewed."}
                      <button
                        type="button"
                        onClick={() => void connect(providerId, provider)}
                        disabled={!api?.oauthStart || pending}
                        className="underline disabled:opacity-50"
                      >
                        {pending ? "Waiting…" : "Reconnect"}
                      </button>
                    </p>
                  )}
                </div>
              )}
              {flowError && (
                <p className="mt-1.5 pl-4 text-[11px] text-red-500">
                  {flowError}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!api?.oauthStart && (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Connecting accounts requires Allternit Desktop.
        </p>
      )}
    </div>
  );
}
