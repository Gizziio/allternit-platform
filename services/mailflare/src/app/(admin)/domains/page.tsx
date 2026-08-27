"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Globe2,
  Plus,
  Trash2,
} from "lucide-react";
import { authFetch } from "@/lib/auth/client";
import type { DnsRecord, DnsStatusSummary, Domain } from "./types";
import DomainItemCard from "./DomainItemCard";
import { CardGridSkeleton } from "@/components/page-skeletons";

export default function DomainsPage() {
  const qc = useQueryClient();
  const [hostname, setHostname] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [dnsView, setDnsView] = useState<{
    domain: Domain;
    dns: unknown;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const res = await authFetch("/api/domains?includeDns=true");
      return (await res.json()) as {
        domains: Domain[];
        dns: Record<string, DnsStatusSummary>;
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname,
          enableRouting: true,
          enableSending: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      return json;
    },
    onSuccess: () => {
      setHostname("");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/domains/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });

  const loadDns = async (id: string) => {
    const res = await authFetch(`/api/domains/${id}/dns`);
    const json = (await res.json()) as { domain: Domain; dns: unknown };
    if (res.ok) setDnsView(json);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Domains</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Domains must be on your Cloudflare account. Adding a domain enables
            Email Routing and Email Sending DNS automatically.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add domain</DialogTitle>
              <DialogDescription>
                Provision Cloudflare routing and sending DNS for a zone in your
                account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              {create.isError && (
                <p className="text-sm text-red-600">
                  {(create.error as Error).message}
                </p>
              )}
              <Button
                onClick={() => create.mutate()}
                disabled={!hostname || create.isPending}
              >
                {create.isPending ? "Adding..." : "Add domain"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <section className="space-y-3">
        {/* <div className="flex items-center justify-between">
					<span className="text-sm text-neutral-500">{(data?.domains ?? []).length} total</span>
				</div> */}
        {isLoading && (
          <CardGridSkeleton />
        )}
        {!isLoading && (data?.domains ?? []).length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
            No domains yet
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.domains ?? []).map((d) => {
            const dns = data?.dns?.[d.id];
            return (
              <DomainItemCard
                key={d.id}
                dns={dns}
                loadDns={loadDns}
                item={d}
                remove={remove}
              />
            );
          })}
        </div>
      </section>
      {dnsView && (
        <Card>
          <CardHeader>
            <CardTitle>DNS — {dnsView.domain.hostname}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs no-font-mono">
            <div>
              <p className="font-sans font-medium text-sm mb-2">
                Email Routing
              </p>
              <pre className="overflow-auto bg-neutral-50 dark:bg-neutral-900 p-3 rounded-md">
                {JSON.stringify(
                  (dnsView.dns as { routing: unknown }).routing,
                  null,
                  2,
                )}
              </pre>
            </div>
            <div>
              <p className="font-sans font-medium text-sm mb-2">
                Email Sending
              </p>
              <pre className="overflow-auto bg-neutral-50 dark:bg-neutral-900 p-3 rounded-md">
                {JSON.stringify(
                  (dnsView.dns as { sending: DnsRecord[] }).sending,
                  null,
                  2,
                )}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
