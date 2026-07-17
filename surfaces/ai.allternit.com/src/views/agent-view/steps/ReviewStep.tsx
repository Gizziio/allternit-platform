import React, { useMemo } from "react";
import {
  CheckCircle,
  Robot,
  FolderOpen,
} from "@phosphor-icons/react";
import type { CreateAgentInput, AgentSetup, CreationTemperament } from "@/lib/agents/agent.types";
import { generateEnhancedWorkspaceDocuments } from "@/lib/agents";

interface ProjectedStats {
  class: string;
  level: number;
  xp: number;
  stats: Record<string, number>;
  specialtyScores: Record<string, number>;
}

interface CardSeedState {
  domainFocus: string;
  voiceStyle: string;
  definitionOfDone: string;
  escalationRules: string;
  voiceRules: string;
  voiceMicroBans: string;
  hardBanCategories: string[];
}

interface BlueprintState {
  setup: AgentSetup;
  specialtySkills: string[];
  temperament: CreationTemperament;
}

interface ReviewStepProps {
  formData: Partial<CreateAgentInput>;
  blueprint: BlueprintState;
  cardSeed: CardSeedState;
  projectedStats: ProjectedStats;
}

export function ReviewStep({ formData, blueprint, cardSeed, projectedStats }: ReviewStepProps) {
  // The exact document set the submit path POSTs to /workspace/initialize —
  // computed with the same generator so the preview cannot drift from what
  // actually lands on disk.
  const workspaceDocs = useMemo(() => {
    try {
      return generateEnhancedWorkspaceDocuments(formData.config, {
        name: formData.name,
        description: formData.description,
        model: formData.model,
        provider: formData.provider,
        type: formData.type,
        trustTier: formData.trustTier,
        writeScope: formData.writeScope,
        dataClassification: formData.dataClassification,
        allowedSurfaces: formData.allowedSurfaces,
        allowedSkills: formData.allowedSkills,
        allowedTools: formData.allowedTools,
        harness: formData.harness as unknown as Record<string, unknown>,
        category: formData.category,
        tags: formData.tags,
        tools: formData.tools,
        capabilities: formData.capabilities,
      });
    } catch {
      return [];
    }
  }, [formData]);

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
          <CheckCircle size={20} className="text-[var(--accent-primary)]" />
          Review & Confirm
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
          Verify your agent configuration before finalizing creation.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Agent Name</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.name}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Agent Type</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.type}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Model</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.model}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Provider</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.provider}</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
            <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Description</div>
            <div className="text-[14px] text-[var(--text-primary)]">{formData.description}</div>
          </div>

          <div className="p-4 rounded-xl border border-solid border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5">
            <div className="flex items-center gap-2 mb-3">
              <Robot size={18} className="text-[var(--accent-primary)]" />
              <span className="font-semibold text-[14px]">Operational Character</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex justify-between">
                <span className="text-[13px] text-[var(--text-secondary)]">Setup</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">{blueprint.setup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-[var(--text-secondary)]">Level</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">Lv {projectedStats.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-[var(--text-secondary)]">Temperament</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)] capitalize">{blueprint.temperament}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-[var(--text-secondary)]">Voice Style</span>
                <span className="text-[13px] font-medium text-[var(--text-primary)] capitalize">{cardSeed.voiceStyle || 'Default'}</span>
              </div>
            </div>
          </div>

          {workspaceDocs.length > 0 && (
            <div className="p-4 rounded-xl border border-solid border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={18} className="text-[var(--accent-primary)]" />
                <span className="font-semibold text-[14px]">Workspace Bootstrap</span>
                <span className="text-[12px] text-[var(--text-muted)]">
                  {workspaceDocs.length} files will be created
                </span>
              </div>
              <div className="max-h-40 overflow-auto flex flex-col gap-1">
                {workspaceDocs.map((doc) => (
                  <div key={doc.path} className="text-[12px] font-mono text-[var(--text-secondary)]">
                    {doc.path}
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-[var(--text-muted)] mt-2.5 mb-0">
                View and edit these after creation in Agent Hub → Workspace or Settings → Agents → Workspace.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Harness Mode</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.harness?.mode}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Allowed Surfaces</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{(formData.allowedSurfaces || []).join(', ') || 'None'}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Trust Tier</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.trustTier}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Category</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.category}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Write Scope</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.writeScope}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
              <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Data Classification</div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.dataClassification}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
