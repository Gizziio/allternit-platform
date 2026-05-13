"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, CircleNotch, ShieldCheck, ClockCountdown } from "@phosphor-icons/react";
import type { useGatewayClient } from "../use-gateway-client";

interface ExecApproval {
  id: string;
  session_id?: string;
  tool?: string;
  command?: string;
  args?: unknown;
  reason?: string;
  requested_at?: string;
  status?: "pending" | "approved" | "rejected";
}

type GatewayHook = ReturnType<typeof useGatewayClient>;

export function GizziExecApprovalsTab({ gateway }: { gateway: GatewayHook }) {
  const [approvals, setApprovals] = useState<ExecApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gateway.request<{ approvals?: ExecApproval[] }>("exec.approvals.get", {});
      setApprovals(res?.approvals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    if (gateway.status !== "connected") return;
    refresh();

    const unsub = gateway.on("exec.approval.requested", (payload) => {
      const approval = payload as ExecApproval;
      setApprovals((prev) => {
        if (prev.some((a) => a.id === approval.id)) return prev;
        return [approval, ...prev];
      });
    });

    const unsubResolved = gateway.on("exec.approval.resolved", (payload) => {
      const { id, status } = payload as { id: string; status: string };
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: status as ExecApproval["status"] } : a)),
      );
    });

    return () => {
      unsub();
      unsubResolved();
    };
  }, [gateway.status, gateway, refresh]);

  const act = useCallback(
    async (id: string, approved: boolean) => {
      setActing((prev) => new Set(prev).add(id));
      try {
        await gateway.request("exec.approvals.set", { id, approved });
        setApprovals((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: approved ? "approved" : "rejected" } : a)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update approval");
      } finally {
        setActing((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [gateway],
  );

  const pending = approvals.filter((a) => !a.status || a.status === "pending");
  const resolved = approvals.filter((a) => a.status && a.status !== "pending");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4  text-muted-foreground" weight="duotone" />
          <span className="text-sm font-medium">Exec Approvals</span>
          {pending.length > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[12px]">
              {pending.length} pending
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <CircleNotch className={cn("size-3.5 ", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <p className="mb-3 text-xs text-destructive">{error}</p>
        )}

        {!loading && approvals.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="size-8  text-muted-foreground" weight="duotone" />
            <p className="text-sm text-muted-foreground">No pending approvals</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending
            </p>
            <div className="flex flex-col gap-3">
              {pending.map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  acting={acting.has(a.id)}
                  onApprove={() => act(a.id, true)}
                  onReject={() => act(a.id, false)}
                />
              ))}
            </div>
          </div>
        )}

        {resolved.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </p>
            <div className="flex flex-col gap-2">
              {resolved.slice(0, 10).map((a) => (
                <ApprovalCard key={a.id} approval={a} acting={false} resolved />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  acting,
  resolved,
  onApprove,
  onReject,
}: {
  approval: ExecApproval;
  acting: boolean;
  resolved?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        resolved
          ? "border-border bg-muted/20 opacity-60"
          : "border-border bg-background shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-foreground">
              {approval.tool ?? approval.command ?? "unknown"}
            </code>
            {approval.session_id && (
              <span className="text-[12px] text-muted-foreground">
                sess:{approval.session_id.slice(0, 8)}
              </span>
            )}
          </div>
          {approval.args !== undefined && (
            <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap break-all text-[12px] text-muted-foreground">
              {JSON.stringify(approval.args, null, 2)}
            </pre>
          )}
          {approval.reason && (
            <p className="mt-1 text-xs text-muted-foreground">{approval.reason}</p>
          )}
          {approval.requested_at && (
            <div className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
              <ClockCountdown className="size-3 " />
              {new Date(approval.requested_at).toLocaleTimeString()}
            </div>
          )}
        </div>

        {!resolved && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-destructive hover:border-destructive hover:text-destructive"
              onClick={onReject}
              disabled={acting}
            >
              <X className="size-3.5 " />
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onApprove}
              disabled={acting}
            >
              {acting ? (
                <CircleNotch className="size-3.5  animate-spin" />
              ) : (
                <Check className="size-3.5 " />
              )}
            </Button>
          </div>
        )}

        {resolved && approval.status && (
          <Badge
            variant={approval.status === "approved" ? "outline" : "destructive"}
            className="h-5 shrink-0 px-1.5 text-[12px]"
          >
            {approval.status}
          </Badge>
        )}
      </div>
    </div>
  );
}
