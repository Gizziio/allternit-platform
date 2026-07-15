import React from "react";
import {
  CheckCircle,
  Robot,
} from "@phosphor-icons/react";
import type { CreateAgentInput, AgentSetup, CreationTemperament } from "@/lib/agents/agent.types";

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
