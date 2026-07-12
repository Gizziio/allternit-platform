'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  FileText as FileCheck,
  Lock,
  Target,
  Warning,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SkeletonRow } from '@/components/settings/SkeletonRow';
import { EmptyState } from '@/components/settings/EmptyState';
import { QUIET_BUTTON_CLASS, DESTRUCTIVE_BUTTON_CLASS } from '@/components/settings/buttonStyles';

const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className="p-5 bg-[var(--bg-secondary)] rounded-lg border border-solid border-[var(--border-subtle)] text-center">
    <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
    <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider mt-1">{label}</div>
  </div>
);

export function SecurityPanel() {
  const [securityTab, setSecurityTab] = useState<'overview' | 'policies' | 'gating' | 'purpose' | 'compliance'>('overview');
  const [policies, setPolicies] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<any>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const fetchSecurityData = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const { listPolicies, listViolations, listApprovals, listSecurityEvents, getComplianceStatus } = await import('@/lib/governance/policy.service');
      const [policiesRes, violationsRes, approvalsRes, eventsRes, complianceRes] = await Promise.all([
        listPolicies(),
        listViolations({ status: 'open' }),
        listApprovals({ status: 'pending' }),
        listSecurityEvents({ pageSize: 20 }),
        getComplianceStatus(),
      ]);
      setPolicies(policiesRes.policies);
      setViolations(violationsRes.violations);
      setApprovals(approvalsRes.requests);
      setSecurityEvents(eventsRes.events);
      setComplianceStatus(complianceRes);
    } catch (e) {
      setPolicies([]); setViolations([]); setApprovals([]); setSecurityEvents([]); setComplianceStatus(null);
    }
    setSecurityLoading(false);
  }, []);

  useEffect(() => {
    void fetchSecurityData();
  }, [fetchSecurityData]);

  const pendingApprovals = approvals.filter((a: any) => a.status === 'pending');

  return (
    <div className="max-w-4xl">
      <div className="flex gap-0 border-b border-solid border-white/10 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'policies', label: 'Policies', icon: FileCheck, count: policies.filter((p: any) => p.status === 'active').length },
          { id: 'gating', label: 'Approvals', icon: Lock, count: pendingApprovals.length },
          { id: 'purpose', label: 'Purpose Binding', icon: Target },
          { id: 'compliance', label: 'Compliance', icon: FileCheck },
        ].map((tab: any) => (
          <button type="button"
            key={tab.id}
            onClick={() => setSecurityTab(tab.id)}
            className={cn(
              "p-4 px-6 border-none bg-transparent text-[13px] font-bold cursor-pointer flex items-center gap-2.5 transition-all whitespace-nowrap relative border-b-2 border-solid",
              securityTab === tab.id ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-[var(--ui-text-muted)] border-transparent hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon size={18} weight={securityTab === tab.id ? "fill" : "regular"} />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "p-0.5 px-2 rounded-full text-[11px] font-black tabular-nums",
                securityTab === tab.id ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "bg-rose-500 text-white"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {securityLoading ? (
        <div className="py-6">
          <SkeletonRow lines={6} />
        </div>
      ) : (
        <>
          {securityTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="p-8 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                  <Shield size={120} weight="fill" />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                    <Shield size={32} weight="bold" />
                  </div>
                  <div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] font-black uppercase tracking-widest opacity-60">Active Threat Level</div>
                    <div className="text-3xl font-black text-amber-500 tracking-tight mt-1">MODERATE_RISK</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Active Policies" value={policies.filter((p: any) => p.status === 'active').length} color="var(--status-success)" />
                <StatCard label="Open Violations" value={violations.filter((v: any) => v.status === 'open').length} color="var(--status-error)" />
                <StatCard label="Pending Approvals" value={pendingApprovals.length} color="var(--status-warning)" />
                <StatCard label="Compliance" value={`${complianceStatus?.score || 0}%`} color="var(--status-info)" />
              </div>

              <div className="mt-4">
                <SectionHeading>Security audit log</SectionHeading>
                <div className="flex flex-col gap-2">
                  {securityEvents.slice(0, 5).map((event: any) => (
                    <div key={event.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-transparent hover:border-[var(--ui-border-muted)] transition-all flex items-center gap-4 group">
                      <div className={cn(
                        "size-9 rounded-lg flex items-center justify-center transition-colors",
                        event.severity === 'critical' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        <Warning size={18} weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--ui-text-inverse)] truncate">{event.title}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 truncate">{event.description}</div>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ui-text-muted)] tabular-nums opacity-60 group-hover:opacity-100">{new Date(event.timestamp || event.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {securityTab === 'policies' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <SectionHeading>Governance policies</SectionHeading>
                <button type="button" className={QUIET_BUTTON_CLASS}>+ New policy</button>
              </div>
              {policies.map((policy: any) => (
                <div key={policy.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] hover:border-[var(--ui-border-default)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "size-11 rounded-xl flex items-center justify-center shadow-lg transition-colors",
                        policy.status === 'active' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5" : "bg-zinc-800 text-zinc-500"
                      )}>
                        <Shield size={22} weight={policy.status === 'active' ? "fill" : "regular"} />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{policy.name}</div>
                        <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5 font-semibold uppercase tracking-wider opacity-70">{policy.type} • {policy.enforcementMode}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "p-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest",
                        policy.severity === 'critical' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500"
                      )}>
                        {policy.severity}
                      </span>
                      {policy.violationCount > 0 && (
                        <span className="p-1 px-3 bg-rose-500/20 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-solid border-rose-500/20">
                          {policy.violationCount} violations
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {policies.length === 0 && (
                <EmptyState icon={<Shield size={40} weight="thin" />} caption="No policies configured." />
              )}
            </div>
          )}

          {securityTab === 'gating' && (
            <div className="flex flex-col gap-4">
              <SectionHeading>Pending approvals</SectionHeading>
              {pendingApprovals.map((approval: any) => (
                <div key={approval.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between group hover:border-[var(--ui-border-default)] transition-colors">
                  <div>
                    <div className="text-[15px] font-bold text-[var(--ui-text-inverse)]">{approval.title}</div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-1">Requested by <span className="text-[var(--accent-primary)] font-bold">{approval.requester?.agentName}</span> • {new Date(approval.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button type="button" className={DESTRUCTIVE_BUTTON_CLASS}>
                      <XCircle size={14} /> Reject
                    </button>
                    <button type="button" className={QUIET_BUTTON_CLASS}>
                      <CheckCircle size={14} /> Approve
                    </button>
                  </div>
                </div>
              ))}
              {pendingApprovals.length === 0 && (
                <EmptyState icon={<CheckCircle size={40} weight="thin" />} caption="Queue is clear. All agent actions are compliant." />
              )}
            </div>
          )}

          {securityTab === 'purpose' && (
            <div className="text-center py-24 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)]">
              <Target size={64} className="text-white/10 mx-auto mb-6" weight="thin" />
              <h3 className="text-lg font-bold text-[var(--ui-text-inverse)] m-0 mb-2">Purpose Binding Architecture</h3>
              <p className="text-[14px] text-[var(--ui-text-muted)] max-w-sm mx-auto leading-relaxed">Agent goals are restricted to verified project scopes. Configure binding levels in the DAG / Project view.</p>
              <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-8")}>Open DAG workspace</button>
            </div>
          )}

          {securityTab === 'compliance' && (
            <div className="flex flex-col gap-6">
              <div className="p-10 bg-[var(--surface-panel)] rounded-2xl border border-solid border-[var(--ui-border-muted)] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent pointer-events-none" />
                <div className={cn(
                  "text-6xl font-black tabular-nums tracking-tighter",
                  complianceStatus?.score >= 80 ? "text-[var(--status-success)]" : complianceStatus?.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                )}>
                  {complianceStatus?.score || 0}%
                </div>
                <div className="text-[11px] font-black text-[var(--ui-text-muted)] uppercase tracking-[0.2em] mt-3 opacity-60">System Compliance Rating</div>
              </div>
              <div>
                <SectionHeading>Enforced frameworks</SectionHeading>
                <div className="flex flex-col gap-2">
                  {complianceStatus?.frameworks?.map((fw: any) => (
                    <div key={fw.id} className="p-4 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="text-sm font-bold text-[var(--ui-text-inverse)]">{fw.name}</div>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full rounded-full transition-all duration-1000 ease-in-out",
                            fw.score >= 80 ? "bg-[var(--status-success)]" : fw.score >= 60 ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                          )} style={{ width: `${fw.score}%` }} />
                        </div>
                        <span className={cn(
                          "text-sm font-black tabular-nums min-w-[3ch] text-right",
                          fw.score >= 80 ? "text-[var(--status-success)]" : fw.score >= 60 ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"
                        )}>{fw.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
