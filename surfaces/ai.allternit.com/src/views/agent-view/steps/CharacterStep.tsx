import React from "react";
import {
  Sparkle,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import type { CreateAgentInput, AgentSetup, CreationTemperament } from "@/lib/agents/agent.types";
import {
  CHARACTER_SETUPS,
  ENHANCED_HARD_BAN_CATEGORIES,
  BAN_CATEGORY_OPTIONS,
  SETUP_CAPABILITY_PRESETS,
} from "../AgentView.constants";
import { getSpecialtyOptions, getSetupStatDefinitions } from "@/lib/agents";
import {
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
} from "@/components/ui";
import { TagInput } from "@/components/ui/tag-input";

const splitLines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

interface BlueprintState {
  setup: AgentSetup;
  specialtySkills: string[];
  temperament: CreationTemperament;
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

interface ProjectedStats {
  class: string;
  level: number;
  xp: number;
  stats: Record<string, number>;
  specialtyScores: Record<string, number>;
}

interface CharacterStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  blueprint: BlueprintState;
  setBlueprint: React.Dispatch<React.SetStateAction<BlueprintState>>;
  cardSeed: CardSeedState;
  setCardSeed: React.Dispatch<React.SetStateAction<CardSeedState>>;
  projectedStats: ProjectedStats;
}

export function CharacterStep({
  formData,
  setFormData,
  blueprint,
  setBlueprint,
  cardSeed,
  setCardSeed,
  projectedStats,
}: CharacterStepProps) {
  const setupStatDefinitions = getSetupStatDefinitions(blueprint.setup);

  const applySetupDefaults = (setupId: AgentSetup) => {
    setBlueprint(prev => ({
      ...prev,
      setup: setupId,
      specialtySkills: [],
    }));
    setFormData(prev => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[setupId],
    }));
  };

  const toggleSpecialty = (skill: string) => {
    setBlueprint(prev => {
      const current = prev.specialtySkills;
      if (current.includes(skill)) {
        return { ...prev, specialtySkills: current.filter(s => s !== skill) };
      }
      if (current.length >= 4) return prev;
      return { ...prev, specialtySkills: [...current, skill] };
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <Sparkle size={20} className="text-[var(--accent-primary)]" />
            Character Profile
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
            Choose setup and specialties. Stats and level are projected from measurable telemetry signals.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {CHARACTER_SETUPS.map((setup) => (
            <button
              key={setup.id}
              type="button"
              className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                blueprint.setup === setup.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
              }`}
              onClick={() => applySetupDefaults(setup.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-[var(--text-primary)]">{setup.label}</span>
                {blueprint.setup === setup.id && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] m-0 mb-2">{setup.description}</p>
              <span className="text-[12px] px-2 py-0.5 rounded bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                class: {setup.className}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Operational Boundaries (Hard Bans)</h3>
        <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-4">Define critical restrictions for this agent.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {Object.entries(ENHANCED_HARD_BAN_CATEGORIES).map(([key, ban]) => {
            const isSelected = ((formData.config as Record<string, unknown> | undefined)?.hardBans as Array<Record<string, unknown>> | undefined)?.some(
              (b) => b.category === key
            );
            const Icon = (ban as { icon?: React.ComponentType<{ size?: number; className?: string }> }).icon || Warning;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFormData(prev => {
                    const config = (prev.config as Record<string, unknown> | undefined) || {};
                    const hardBans = (config.hardBans as Array<Record<string, unknown>>) || [];
                    const exists = hardBans.find((b) => b.category === key);
                    const nextBans = exists
                      ? hardBans.filter((b) => b.category !== key)
                      : [...hardBans, { category: key, severity: (ban as { severity?: string }).severity }];
                    return { ...prev, config: { ...config, hardBans: nextBans } };
                  });
                }}
                className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 border border-solid ${
                  isSelected ? 'bg-red-500/10 border-red-500' : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                }`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-red-500/20' : 'bg-[var(--surface-hover)]'}`}>
                  <Icon size={18} className={isSelected ? 'text-red-500' : 'text-[var(--text-secondary)]'} />
                </div>
                <div>
                  <div className={`font-medium text-[14px] ${isSelected ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{(ban as { label: string }).label}</div>
                  <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{(ban as { description: string }).description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Specialties & Domain</h3>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-[var(--text-primary)] mb-2 block">Domain Focus</Label>
              <Input
                value={cardSeed.domainFocus}
                onChange={(e) => setCardSeed(prev => ({ ...prev, domainFocus: e.target.value }))}
                placeholder="e.g. Frontend Architecture, Security Audit"
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[var(--text-primary)]">Specialty Skills</Label>
                <span className="text-[12px] text-[var(--text-muted)]">{(blueprint.specialtySkills ?? []).length}/4</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getSpecialtyOptions(blueprint.setup).map((skill) => {
                  const selected = (blueprint.specialtySkills ?? []).includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSpecialty(skill)}
                      className={`px-2.5 py-1 rounded-md text-[12px] border border-solid transition-all duration-200 ${
                        selected ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-[var(--text-primary)] mb-2 block">Escalation Triggers</Label>
              <TagInput
                value={splitLines(cardSeed.escalationRules)}
                onChange={(tags: string[]) => setCardSeed(prev => ({ ...prev, escalationRules: tags.join('\n') }))}
                placeholder="Add triggers…"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Projected Level</h3>
          <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-3">Based on setup baseline + specialties.</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--text-secondary)]">Class</span>
              <span className="text-[12px] px-2 py-0.5 rounded-full border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
                {projectedStats.class}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--text-secondary)]">Level</span>
              <span className="text-[18px] font-semibold text-[var(--text-primary)]">Lv {projectedStats.level}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--text-secondary)]">XP</span>
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{projectedStats.xp.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {(blueprint.specialtySkills ?? []).slice(0, 3).map((skill) => (
                <div key={skill} className="flex items-center justify-between p-1.5 px-2.5 rounded-md border border-solid border-[var(--border-subtle)] text-[12px]">
                  <span className="text-[var(--text-secondary)]">{skill}</span>
                  <span className="text-[var(--text-primary)] font-medium">{projectedStats.specialtyScores[skill] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Measured Setup Stats</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {setupStatDefinitions.map((definition) => {
            const value = projectedStats.stats[definition.key] ?? 0;
            return (
              <div key={definition.key} className="p-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[14px] text-[var(--text-primary)]">{definition.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] px-1.5 py-0.5 rounded border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      {definition.key}
                    </span>
                    <span className="text-[13px] font-bold text-[var(--accent-primary)]">{value}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(4, value)}%` }}
                  />
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-2">{definition.description}</p>
                <p className="text-[12px] text-[var(--text-muted)] m-0 mt-1">
                  Signals: {definition.signals.join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Temperament</div>
          <Select
            value={blueprint.temperament}
            onValueChange={(value) =>
              setBlueprint((prev) => ({ ...prev, temperament: value as CreationTemperament }))
            }
          >
            <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
              <SelectItem value="precision">precision</SelectItem>
              <SelectItem value="exploratory">exploratory</SelectItem>
              <SelectItem value="systemic">systemic</SelectItem>
              <SelectItem value="balanced">balanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Setup Capabilities</div>
          <div className="p-3 rounded-lg border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] bg-[var(--bg-primary)]">
            {SETUP_CAPABILITY_PRESETS[blueprint.setup].join(", ")}
          </div>
        </div>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Role Domain Focus</div>
          <Input
            value={cardSeed.domainFocus}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, domainFocus: e.target.value }))}
            placeholder="Domain ownership boundary"
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Style</div>
          <Input
            value={cardSeed.voiceStyle}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceStyle: e.target.value }))}
            placeholder="Technical, direct, skeptical…"
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Definition of Done (one per line)</div>
          <Textarea
            value={cardSeed.definitionOfDone}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, definitionOfDone: e.target.value }))}
            rows={4}
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Escalation Triggers (one per line)</div>
          <Textarea
            value={cardSeed.escalationRules}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, escalationRules: e.target.value }))}
            rows={4}
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Rules (one per line)</div>
          <Textarea
            value={cardSeed.voiceRules}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceRules: e.target.value }))}
            rows={4}
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Micro-Bans (one per line)</div>
          <Textarea
            value={cardSeed.voiceMicroBans}
            onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceMicroBans: e.target.value }))}
            rows={4}
            className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14px] font-medium text-[var(--text-primary)] m-0">Hard Ban Categories</div>
          <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)]">
            {cardSeed.hardBanCategories.length} selected
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {BAN_CATEGORY_OPTIONS.map((option) => {
            const selected = cardSeed.hardBanCategories.includes(option.category);
            return (
              <button
                key={option.category}
                type="button"
                className={`p-3 rounded-lg border border-solid text-left cursor-pointer transition-all duration-200 ${
                  selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                }`}
                onClick={() =>
                  setCardSeed((prev) => {
                    const exists = prev.hardBanCategories.includes(option.category);
                    return {
                      ...prev,
                      hardBanCategories: exists
                        ? prev.hardBanCategories.filter((category) => category !== option.category)
                        : [...prev.hardBanCategories, option.category],
                    };
                  })
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[13px] text-[var(--text-primary)]">{option.label}</span>
                  {selected && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-1">{option.description}</p>
              </button>
            );
          })}
        </div>
        {cardSeed.hardBanCategories.length === 0 && (
          <p className="text-[12px] text-[var(--status-warning)] mt-3">
            Select at least one hard-ban category so tool blocking is enforceable.
          </p>
        )}
      </div>
    </section>
  );
}
