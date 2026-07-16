// @ts-nocheck

"use client";

import React from 'react';
import type { Agent } from '@/lib/agents/agent.types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-studio-border-subtle py-2.5 last:border-0">
      <span className="text-xs text-studio-text-secondary">{label}</span>
      <span className="text-sm text-studio-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-studio-text-primary">{title}</div>
      <div className="rounded-lg border border-studio-border-subtle bg-studio-card px-4">{children}</div>
    </section>
  );
}

export const EnvironmentTab = ({ agent }: { agent: Agent }) => {
  const harness = agent.harness;

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-5">
        <Section title="Harness">
          <Row label="Mode" value={<span className="capitalize">{harness?.mode || 'cloud'}</span>} />
          {harness?.mode === 'cloud' && harness.cloud && (
            <Row label="Base URL" value={harness.cloud.baseURL || '—'} />
          )}
          {harness?.mode === 'local' && harness.local && (
            <Row label="Base URL" value={harness.local.baseURL || '—'} />
          )}
          {harness?.mode === 'subprocess' && harness.subprocess && (
            <>
              <Row label="Command" value={harness.subprocess.command} />
              {harness.subprocess.cwd && <Row label="Working Directory" value={harness.subprocess.cwd} />}
            </>
          )}
        </Section>

        <Section title="Governance">
          <Row label="Trust Tier" value={<span className="capitalize">{agent.trustTier || 'standard'}</span>} />
          <Row label="Write Scope" value={<span className="capitalize">{agent.writeScope || 'workspace'}</span>} />
          {agent.dataClassification && (
            <Row label="Data Classification" value={<span className="capitalize">{agent.dataClassification}</span>} />
          )}
        </Section>

        <Section title="Runtime">
          <Row label="Model" value={agent.model} />
          <Row label="Provider" value={agent.provider} />
          {agent.workspaceId && <Row label="Workspace" value={agent.workspaceId} />}
          <Row label="Surfaces" value={(agent.allowedSurfaces || []).join(', ') || '—'} />
        </Section>
      </div>
    </div>
  );
};
