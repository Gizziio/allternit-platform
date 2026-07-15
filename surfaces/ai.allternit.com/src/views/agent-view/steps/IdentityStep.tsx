import React from "react";
import {
  Robot,
  Network,
  GearSix,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react";
import type { Agent, CreateAgentInput } from "@/lib/agents/agent.types";
import { AGENT_TYPES } from "../AgentView.constants";
import {
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Slider,
  Label,
} from "@/components/ui";
import { TagInput } from "@/components/ui/tag-input";

interface PersonalityState {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  communicationStyle: string;
  workStyle: string;
  decisionMaking: string;
}

interface IdentityStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  personality: PersonalityState;
  setPersonality: React.Dispatch<React.SetStateAction<PersonalityState>>;
  orchestrators: Agent[];
}

const getTypeIcon = (typeId: string) => {
  switch (typeId) {
    case 'orchestrator':
      return <Network size={20} className="text-[var(--text-primary)]" />;
    case 'worker':
      return <GearSix size={20} className="text-[var(--text-primary)]" />;
    default:
      return <Robot size={20} className="text-[var(--text-primary)]" />;
  }
};

export function IdentityStep({
  formData,
  setFormData,
  personality,
  setPersonality,
  orchestrators,
}: IdentityStepProps) {
  return (
    <section className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
          <Sparkle size={20} className="text-[var(--accent-primary)]" />
          Agent Identity
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
          Define the ownership boundary and runtime role for this agent.
        </p>
      </div>

      <div className="h-px bg-[var(--border-subtle)] my-6" />

      <div className="mb-5">
        <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Agent Name</div>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Code Review Sentinel"
          required
          className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
        />
      </div>

      <div className="mb-5">
        <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Description</div>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="What this agent owns and what it should deliver."
          required
          className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] min-h-[80px]"
        />
      </div>

      <div className="h-px bg-[var(--border-subtle)] my-6" />

      <div className="mb-5">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
          <Network size={18} className="text-[var(--accent-primary)]" />
          Agent Type
        </h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {AGENT_TYPES.map((type) => {
            const disabled = type.id === 'sub-agent' && orchestrators.length === 0;
            return (
              <button
                key={type.id}
                type="button"
                disabled={disabled}
                className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 ${
                  disabled ? 'opacity-50 cursor-not-allowed bg-[var(--bg-primary)]' : 'cursor-pointer'
                } ${
                  formData.type === type.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                }`}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    type: type.id,
                    parentAgentId: type.id === "sub-agent" ? prev.parentAgentId : undefined,
                  }))
                }
              >
                <div className="flex items-center gap-2 mb-2">
                  {getTypeIcon(type.id)}
                  <span className="font-medium text-[var(--text-primary)]">{type.name}</span>
                  {formData.type === type.id && (
                    <CheckCircle size={16} className="text-[var(--accent-primary)] ml-auto" />
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] m-0">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {formData.type === "sub-agent" && (
        <div className="mt-5">
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Parent Orchestrator</div>
          <Select
            value={formData.parentAgentId || ""}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, parentAgentId: value || undefined }))
            }
          >
            <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
              <SelectValue
                placeholder={
                  orchestrators.length === 0
                    ? "No orchestrators available"
                    : "Select parent orchestrator"
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
              {orchestrators.map((orch) => (
                <SelectItem key={orch.id} value={orch.id}>
                  {orch.name}
                </SelectItem>
              ))}
              {orchestrators.length === 0 && (
                <SelectItem value="none" disabled>
                  Create an orchestrator first
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {orchestrators.length === 0 && (
            <p className="text-[12px] text-[var(--status-warning)] mt-2">
              You need an orchestrator before creating a sub-agent.
            </p>
          )}
        </div>
      )}

      <div className="h-px bg-[var(--border-subtle)] my-6" />

      <div className="mb-5">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
          <Sparkle size={18} className="text-[var(--accent-primary)]" />
          Personality & Style
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {[
            { id: 'openness', label: 'Openness', low: 'Conventional', high: 'Inventive' },
            { id: 'conscientiousness', label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized' },
            { id: 'extraversion', label: 'Extraversion', low: 'Reserved', high: 'Outgoing' },
            { id: 'agreeableness', label: 'Agreeableness', low: 'Critical', high: 'Cooperative' }
          ].map((trait) => (
            <div key={trait.id} className="bg-[var(--bg-primary)] p-3 rounded-xl border border-solid border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[var(--text-primary)] text-[13px]">{trait.label}</Label>
                <span className="text-[13px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 px-2 py-0.5 rounded-md">
                  {personality[trait.id as keyof PersonalityState] as number}%
                </span>
              </div>
              <Slider
                value={[personality[trait.id as keyof PersonalityState] as number]}
                onValueChange={([value]) => setPersonality(prev => ({ ...prev, [trait.id]: value }))}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[12px] text-[var(--text-muted)]">{trait.low}</span>
                <span className="text-[12px] text-[var(--text-muted)]">{trait.high}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Communication Style</Label>
            <Select
              value={personality.communicationStyle}
              onValueChange={(value: string) => setPersonality(prev => ({ ...prev, communicationStyle: value }))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                <SelectItem value="direct">Direct & Concise</SelectItem>
                <SelectItem value="analytical">Analytical & Detailed</SelectItem>
                <SelectItem value="collaborative">Cooperative & Supportive</SelectItem>
                <SelectItem value="creative">Expressive & Imaginative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Work Style</Label>
            <Select
              value={personality.workStyle}
              onValueChange={(value: string) => setPersonality(prev => ({ ...prev, workStyle: value }))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                <SelectItem value="independent">Independent Autonomous</SelectItem>
                <SelectItem value="collaborative">Team-Oriented</SelectItem>
                <SelectItem value="guided">Requires Supervision</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[var(--text-primary)] text-[13px]">Decision Making</Label>
            <Select
              value={personality.decisionMaking}
              onValueChange={(value: string) => setPersonality(prev => ({ ...prev, decisionMaking: value }))}
            >
              <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                <SelectItem value="data-driven">Data-Driven & Logical</SelectItem>
                <SelectItem value="intuitive">Intuitive & Fast</SelectItem>
                <SelectItem value="consensus">Consensus-Based</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <Label className="text-[var(--text-primary)] text-[13px]">Personality Traits</Label>
          <TagInput
            value={(formData.config as Record<string, unknown> | undefined)?.personalityTraits as string[] || []}
            onChange={(tags: string[]) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), personalityTraits: tags } }))}
            placeholder="Add traits (e.g. Stoic, Sarcastic, Highly Technical)…"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-[var(--text-primary)] text-[13px]">Backstory & Context</Label>
          <Textarea
            value={(formData.config as Record<string, unknown> | undefined)?.backstory as string || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), backstory: e.target.value } }))}
            placeholder="Provide background context that shapes this agent's behavior…"
            rows={4}
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      </div>
    </section>
  );
}
