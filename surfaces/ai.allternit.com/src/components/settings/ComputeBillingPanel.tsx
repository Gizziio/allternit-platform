"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  Cloud,
  ComputerTower,
  HardDrives,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import { usePlatformAuth, usePlatformUser } from "@/lib/platform-auth-client";
import {
  createHostedRuntime,
  destroyHostedRuntime,
  getHostedEntitlement,
  listHostedRuntimes,
  startHostedRuntime,
  stopHostedRuntime,
  type HostedRuntime,
  type HostedRuntimeEntitlement,
} from "@/lib/hosted-compute";
import { SectionHeading } from "@/components/settings/SectionHeading";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { Badge } from "@/components/settings/Badge";
import {
  QUIET_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
} from "@/components/settings/buttonStyles";
import { cn } from "@/lib/utils";

function openSettings(section: string) {
  window.dispatchEvent(
    new CustomEvent("allternit:navigate-settings", { detail: { section } }),
  );
}

function formatHours(seconds: number) {
  if (seconds < 3600) return `${Math.max(0, Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(seconds < 36_000 ? 1 : 0)} hr`;
}

function ProductCard({
  icon,
  title,
  eyebrow,
  description,
  children,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-solid p-4",
        active
          ? "border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.04)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {eyebrow}
          </div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)] mt-0.5">
            {title}
          </div>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] mt-1 mb-3">
            {description}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ComputeBillingPanel() {
  const { getToken } = usePlatformAuth();
  const { isLoaded, isSignedIn } = usePlatformUser();
  const [entitlement, setEntitlement] =
    useState<HostedRuntimeEntitlement | null>(null);
  const [runtimes, setRuntimes] = useState<HostedRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token)
        throw new Error(
          "Open Allternit on the web to manage hosted compute for this account.",
        );
      const [nextEntitlement, nextRuntimes] = await Promise.all([
        getHostedEntitlement(token),
        listHostedRuntimes(token),
      ]);
      setEntitlement(nextEntitlement);
      setRuntimes(nextRuntimes);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load hosted compute",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (id: string, action: (token: string) => Promise<unknown>) => {
      setBusyId(id);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("A web account session is required.");
        await action(token);
        await load();
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Hosted runtime action failed",
        );
      } finally {
        setBusyId(null);
      }
    },
    [getToken, load],
  );

  const handleCreate = useCallback(async () => {
    setBusyId("create");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("A web account session is required.");
      await createHostedRuntime(token);
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to create hosted runtime",
      );
    } finally {
      setBusyId(null);
    }
  }, [getToken, load]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading className="mb-1">Compute plans</SectionHeading>
        <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed">
          Keep local compute as the default, add managed hosting when you need
          an always-available brain, or bring enterprise workloads into your own
          cloud.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <ProductCard
          icon={<ComputerTower size={18} />}
          eyebrow="Included"
          title="Local compute"
          description="Your brain, provider credentials, and local models stay on your computer. Allternit does not meter your machine."
          active
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-success)]">
              <CheckCircle size={13} weight="fill" /> Ready
            </span>
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => openSettings("models")}
            >
              Manage models
            </button>
          </div>
        </ProductCard>

        <ProductCard
          icon={<HardDrives size={18} />}
          eyebrow="Provider-priced"
          title="Your VPS"
          description="Buy from a supported VPS provider or connect a server you already own. The provider bills the server directly."
        >
          <div className="flex justify-end">
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => openSettings("vps")}
            >
              Buy or connect VPS
            </button>
          </div>
        </ProductCard>

        <ProductCard
          icon={<Cloud size={18} />}
          eyebrow="Paid add-on"
          title="Allternit managed hosting"
          description="A private Fly Machine runs your Gizzi brain and stops after inactivity. Runtime hours, instance count, memory, and spend are enforced by your plan."
          active={Boolean(entitlement?.canCreateHostedRuntime)}
        >
          {loading ? (
            <SkeletonRow lines={2} />
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge>
                  {entitlement?.planDisplayName ?? "No hosted plan"}
                </Badge>
                {entitlement?.canCreateHostedRuntime && (
                  <Badge className="text-[var(--status-success)] bg-[var(--status-success)]/10">
                    Hosted enabled
                  </Badge>
                )}
                {entitlement && (
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {formatHours(entitlement.usedSecondsMonthly)} /{" "}
                    {entitlement.maxHoursMonthly} hr this month · $
                    {entitlement.estimatedCostUsdMonthly.toFixed(2)} estimated
                    infra
                  </span>
                )}
              </div>

              {runtimes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {runtimes.map((runtime) => (
                    <div
                      key={runtime.id}
                      className="flex items-center gap-2 rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-2"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          runtime.status === "running"
                            ? "bg-[var(--status-success)]"
                            : "bg-[var(--text-tertiary)]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                          {runtime.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                          {runtime.memoryMb} MB · {runtime.region} · idle stop{" "}
                          {runtime.idleTimeoutMinutes} min
                          {runtime.stopReason
                            ? ` · ${runtime.stopReason.replaceAll("_", " ")}`
                            : ""}
                        </div>
                      </div>
                      <Badge>{runtime.status}</Badge>
                      {runtime.status === "stopped" && (
                        <button
                          type="button"
                          className={QUIET_BUTTON_CLASS}
                          disabled={busyId === runtime.id}
                          onClick={() =>
                            void mutate(runtime.id, (token) =>
                              startHostedRuntime(token, runtime.id),
                            )
                          }
                        >
                          Start
                        </button>
                      )}
                      {["running", "starting"].includes(runtime.status) && (
                        <button
                          type="button"
                          className={QUIET_BUTTON_CLASS}
                          disabled={busyId === runtime.id}
                          onClick={() =>
                            void mutate(runtime.id, (token) =>
                              stopHostedRuntime(token, runtime.id),
                            )
                          }
                        >
                          Stop
                        </button>
                      )}
                      <button
                        type="button"
                        className={DESTRUCTIVE_BUTTON_CLASS}
                        aria-label={`Destroy ${runtime.name}`}
                        disabled={busyId === runtime.id}
                        onClick={() =>
                          void mutate(runtime.id, (token) =>
                            destroyHostedRuntime(token, runtime.id),
                          )
                        }
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={QUIET_BUTTON_CLASS}
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <ArrowsClockwise size={13} /> Refresh
                </button>
                {entitlement?.canCreateHostedRuntime ? (
                  <button
                    type="button"
                    className={QUIET_BUTTON_CLASS}
                    onClick={() => void handleCreate()}
                    disabled={
                      busyId === "create" ||
                      entitlement.activeInstances >=
                        entitlement.maxHostedRuntimes
                    }
                  >
                    Create runtime
                  </button>
                ) : (
                  <button
                    type="button"
                    className={QUIET_BUTTON_CLASS}
                    onClick={() =>
                      window.open(
                        entitlement?.upgradeUrl ||
                          "https://billing.allternit.com/hosted-compute",
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Add hosted compute
                  </button>
                )}
                {entitlement?.billingPortalUrl && (
                  <button
                    type="button"
                    className={QUIET_BUTTON_CLASS}
                    onClick={() =>
                      window.open(
                        entitlement.billingPortalUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Billing portal
                  </button>
                )}
              </div>
            </>
          )}
        </ProductCard>

        <ProductCard
          icon={<ShieldCheck size={18} />}
          eyebrow="Enterprise · metered"
          title="Bring your own cloud"
          description="Run isolated workloads in your AWS, Google Cloud, or Azure account. Your provider charges infrastructure; Allternit meters the enterprise platform service."
        >
          <div className="flex justify-end">
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => openSettings("cloud-credentials")}
            >
              Manage enterprise BYOC
            </button>
          </div>
        </ProductCard>
      </div>

      {error && (
        <EmptyState
          icon={<Cloud size={28} />}
          title="Hosted compute unavailable"
          caption={error}
          ctaLabel="Retry"
          onCtaClick={() => void load()}
        />
      )}
    </div>
  );
}

export default ComputeBillingPanel;
