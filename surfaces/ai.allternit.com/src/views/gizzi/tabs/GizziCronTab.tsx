"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Trash, CircleNotch, Timer, Plus } from "@phosphor-icons/react";
import type { useGatewayClient } from "../use-gateway-client";

interface CronJob {
  id: string;
  name?: string;
  schedule?: string;
  enabled?: boolean;
  last_run?: string;
  next_run?: string;
  last_status?: "success" | "failure" | "running";
}

type GatewayHook = ReturnType<typeof useGatewayClient>;

export function GizziCronTab({ gateway }: { gateway: GatewayHook }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gateway.request<{ jobs?: CronJob[] }>("cron.list", {});
      setJobs(res?.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    if (gateway.status !== "connected") return;
    refresh();

    const unsub = gateway.on("cron.status", (payload) => {
      const update = payload as { id: string } & Partial<CronJob>;
      setJobs((prev) => prev.map((j) => (j.id === update.id ? { ...j, ...update } : j)));
    });

    return unsub;
  }, [gateway.status, gateway, refresh]);

  const runNow = useCallback(
    async (id: string) => {
      setActing((prev) => new Set(prev).add(id));
      try {
        await gateway.request("cron.run", { id });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to run job");
      } finally {
        setActing((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [gateway, refresh],
  );

  const removeJob = useCallback(
    async (id: string) => {
      setActing((prev) => new Set(prev).add(id));
      try {
        await gateway.request("cron.remove", { id });
        setJobs((prev) => prev.filter((j) => j.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove job");
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Timer className="size-4  text-muted-foreground" weight="duotone" />
          <span className="text-sm font-medium">Cron Jobs</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[12px]">
            {jobs.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <CircleNotch className={cn("size-3.5 ", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Timer className="size-8  text-muted-foreground" weight="duotone" />
            <p className="text-sm text-muted-foreground">No cron jobs configured</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {job.name ?? job.id}
                  </span>
                  <Badge
                    variant={job.enabled ? "outline" : "secondary"}
                    className="h-4 shrink-0 px-1.5 text-[12px]"
                  >
                    {job.enabled ? "enabled" : "disabled"}
                  </Badge>
                  {job.last_status && (
                    <Badge
                      variant={
                        job.last_status === "success"
                          ? "outline"
                          : job.last_status === "running"
                            ? "default"
                            : "destructive"
                      }
                      className="h-4 shrink-0 px-1.5 text-[12px]"
                    >
                      {job.last_status}
                    </Badge>
                  )}
                </div>
                {job.schedule && (
                  <code className="mt-0.5 block text-xs text-muted-foreground">
                    {job.schedule}
                  </code>
                )}
                {job.next_run && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    next: {new Date(job.next_run).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="size-7  p-0"
                  onClick={() => runNow(job.id)}
                  disabled={acting.has(job.id)}
                  title="Run now"
                >
                  {acting.has(job.id) ? (
                    <CircleNotch className="size-3.5  animate-spin" />
                  ) : (
                    <Play className="size-3.5 " weight="fill" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7  p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeJob(job.id)}
                  disabled={acting.has(job.id)}
                  title="Remove"
                >
                  <Trash className="size-3.5 " />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
