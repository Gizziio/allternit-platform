"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleNotch, Wrench, ArrowsClockwise } from "@phosphor-icons/react";
import type { useGatewayClient } from "../use-gateway-client";

interface Skill {
  id: string;
  name?: string;
  version?: string;
  status?: "active" | "inactive" | "error" | "updating";
  description?: string;
}

type GatewayHook = ReturnType<typeof useGatewayClient>;

export function GizziSkillsTab({ gateway }: { gateway: GatewayHook }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gateway.request<{ skills?: Skill[] }>("skills.list", {});
      setSkills(res?.skills ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    if (gateway.status !== "connected") return;
    refresh();
  }, [gateway.status, refresh]);

  const updateSkill = useCallback(
    async (id: string) => {
      setActing((prev) => new Set(prev).add(id));
      try {
        await gateway.request("skills.update", { id });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update skill");
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

  const statusVariant = (status?: string) => {
    if (status === "active") return "outline";
    if (status === "error") return "destructive";
    if (status === "updating") return "default";
    return "secondary";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Wrench className="size-4  text-muted-foreground" weight="duotone" />
          <span className="text-sm font-medium">Skills</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[12px]">
            {skills.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <CircleNotch className={cn("size-3.5 ", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

        {!loading && skills.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Wrench className="size-8  text-muted-foreground" weight="duotone" />
            <p className="text-sm text-muted-foreground">No skills installed</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {skill.name ?? skill.id}
                  </span>
                  {skill.version && (
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      v{skill.version}
                    </span>
                  )}
                  {skill.status && (
                    <Badge
                      variant={statusVariant(skill.status)}
                      className="h-4 shrink-0 px-1.5 text-[12px]"
                    >
                      {skill.status}
                    </Badge>
                  )}
                </div>
                {skill.description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {skill.description}
                  </p>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="size-7  shrink-0 p-0 text-muted-foreground"
                onClick={() => updateSkill(skill.id)}
                disabled={acting.has(skill.id) || skill.status === "updating"}
                title="Update skill"
              >
                {acting.has(skill.id) ? (
                  <CircleNotch className="size-3.5  animate-spin" />
                ) : (
                  <ArrowsClockwise className="size-3.5 " />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
