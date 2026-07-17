import React, { useCallback, useMemo, useState } from 'react';
import { PlayCircle, ChatCircleDots } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

const logger = createModuleLogger('MiroFish');

/**
 * `@/lib/mirofish` and `@/lib/sandbox/swarm` are server-only (they call
 * `generateText`/`getDefaultPluginModel`, and the E2B provider reads
 * `E2B_API_KEY`) — this client-rendered panel never imports either
 * directly, not even for types. All types below are derived structurally
 * from `typeof import(...)`, a pure type-level query erased at compile
 * time; the only place the module is actually reached is the dynamic
 * `import()` inside `loadMiroFishRuntime`, which mirrors exactly how
 * `src/lib/plugins/index.ts` lazy-loads every other mode plugin. See
 * docs/SWARM_MIROFISH_PHASE_3_NOTES.md.
 */
type MiroFishRuntime = typeof import('@/plugins/built-in/mirofish/plugin');
type RunSimulationFn = MiroFishRuntime['runMiroFishSimulation'];
type SeedMaterial = Parameters<RunSimulationFn>[0];
type SimulationConfig = Parameters<RunSimulationFn>[1];
type WorldState = Awaited<ReturnType<RunSimulationFn>>;
type Persona = WorldState['personas'][number];
type RoundSummary = WorldState['roundSummaries'][number];
type SeedMaterialKind = SeedMaterial['kind'];

async function loadMiroFishRuntime(): Promise<MiroFishRuntime> {
  return import('@/plugins/built-in/mirofish/plugin');
}

const SEED_KIND_OPTIONS: { value: SeedMaterialKind; label: string }[] = [
  { value: 'news', label: 'News' },
  { value: 'policy', label: 'Policy' },
  { value: 'financial', label: 'Financial' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'other', label: 'Other' },
];

const MIN_POPULATION = 1;
const MAX_POPULATION = 50;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 10;
const DEFAULT_POPULATION = 12;
const DEFAULT_ROUNDS = 3;

interface ChatEntry {
  question: string;
  answer: string;
}

export function MiroFishPanel() {
  const [seedKind, setSeedKind] = useState<SeedMaterialKind>('news');
  const [seedText, setSeedText] = useState('');
  const [populationSize, setPopulationSize] = useState(DEFAULT_POPULATION);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [chatByPersonaId, setChatByPersonaId] = useState<Record<string, ChatEntry[]>>({});

  const canRun = seedText.trim().length > 0 && !isRunning;

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setIsRunning(true);
    setRunError(null);
    setWorld(null);
    setSelectedPersonaId(null);
    setChatByPersonaId({});

    const seed: SeedMaterial = { kind: seedKind, text: seedText.trim() };
    const config: SimulationConfig = { populationSize, rounds };

    try {
      const runtime = await loadMiroFishRuntime();
      const result = await runtime.runMiroFishSimulation(seed, config);
      setWorld(result);
      setSelectedPersonaId(result.personas[0]?.id ?? null);
    } catch (error) {
      logger.error({ error }, 'MiroFish simulation failed');
      setRunError(error instanceof Error ? error.message : 'Simulation failed.');
    } finally {
      setIsRunning(false);
    }
  }, [canRun, seedKind, seedText, populationSize, rounds]);

  const selectedPersona = useMemo(
    () => world?.personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [world, selectedPersonaId]
  );

  const handleAsk = useCallback(async () => {
    if (!world || !selectedPersona || !question.trim() || isAsking) return;
    setIsAsking(true);
    setAskError(null);
    const askedQuestion = question.trim();

    try {
      const runtime = await loadMiroFishRuntime();
      const answer = await runtime.askMiroFishPersona(world, selectedPersona, askedQuestion);
      setChatByPersonaId((prev) => ({
        ...prev,
        [selectedPersona.id]: [...(prev[selectedPersona.id] ?? []), { question: askedQuestion, answer }],
      }));
      setQuestion('');
    } catch (error) {
      logger.error({ error }, 'MiroFish persona question failed');
      setAskError(error instanceof Error ? error.message : 'Could not reach that persona.');
    } finally {
      setIsAsking(false);
    }
  }, [world, selectedPersona, question, isAsking]);

  const selectedPersonaChat = selectedPersona ? chatByPersonaId[selectedPersona.id] ?? [] : [];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[color-mix(in_srgb,var(--surface-panel)_86%,transparent)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.14em]">
            Population Simulation
          </span>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted">
            MiroFish
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-secondary" htmlFor="mirofish-seed-text">
            Seed material
          </label>
          <Textarea
            id="mirofish-seed-text"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="Paste the news, policy draft, financial signal, or narrative you want to simulate reactions to…"
            className="min-h-[96px]"
            disabled={isRunning}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary" htmlFor="mirofish-seed-kind">
              Kind
            </label>
            <select
              id="mirofish-seed-kind"
              value={seedKind}
              onChange={(e) => setSeedKind(e.target.value as SeedMaterialKind)}
              disabled={isRunning}
              className="h-10 w-full rounded-lg border border-[var(--ui-border-default)] bg-[var(--surface-hover)] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SEED_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary" htmlFor="mirofish-population">
              Population size
            </label>
            <Input
              id="mirofish-population"
              type="number"
              min={MIN_POPULATION}
              max={MAX_POPULATION}
              value={populationSize}
              disabled={isRunning}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) {
                  setPopulationSize(Math.min(MAX_POPULATION, Math.max(MIN_POPULATION, Math.round(next))));
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary" htmlFor="mirofish-rounds">
              Rounds
            </label>
            <Input
              id="mirofish-rounds"
              type="number"
              min={MIN_ROUNDS}
              max={MAX_ROUNDS}
              value={rounds}
              disabled={isRunning}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) {
                  setRounds(Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(next))));
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {populationSize} personas × {rounds} rounds — each persona and each round is a real model call.
          </span>
          <Button onClick={() => void handleRun()} disabled={!canRun}>
            {isRunning ? (
              <>
                <Spinner />
                Running…
              </>
            ) : (
              <>
                <PlayCircle size={16} weight="fill" />
                Run simulation
              </>
            )}
          </Button>
        </div>

        {runError && (
          <div className="rounded-lg border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]">
            {runError}
          </div>
        )}
      </div>

      {world && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.14em]">
              Population ({world.personas.length})
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {world.personas.map((persona: Persona) => (
                <button
                  type="button"
                  key={persona.id}
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all',
                    persona.id === selectedPersonaId
                      ? 'border-[#06b6d4]/60 bg-[#06b6d4]/[0.08]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18]'
                  )}
                >
                  <span className="text-[13px] font-bold text-primary">{persona.name}</span>
                  <span className="text-[11px] text-muted leading-[1.45] line-clamp-3">{persona.bio}</span>
                  {Object.keys(persona.traits).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(persona.traits).slice(0, 4).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.14em]">
              Round-by-round report
            </span>
            <div className="flex flex-col gap-2">
              {world.roundSummaries.map((summary: RoundSummary) => (
                <div key={summary.round} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="mb-1 text-[11px] font-bold text-[#06b6d4]">Round {summary.round}</div>
                  <div className="text-[12px] text-secondary leading-[1.5]">{summary.summary}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedPersona && (
            <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[color-mix(in_srgb,var(--surface-panel)_86%,transparent)] p-4">
              <div className="flex items-center gap-2">
                <ChatCircleDots size={14} className="text-[#06b6d4]" />
                <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.14em]">
                  Ask {selectedPersona.name}
                </span>
              </div>

              {selectedPersonaChat.length > 0 && (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedPersonaChat.map((entry, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      <div className="text-[12px] font-medium text-primary">You: {entry.question}</div>
                      <div className="text-[12px] text-secondary leading-[1.5]">
                        {selectedPersona.name}: {entry.answer}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`Ask ${selectedPersona.name} a question…`}
                  disabled={isAsking}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleAsk();
                    }
                  }}
                />
                <Button variant="secondary" onClick={() => void handleAsk()} disabled={isAsking || !question.trim()}>
                  {isAsking ? <Spinner /> : 'Ask'}
                </Button>
              </div>

              {askError && <div className="text-[11px] text-[var(--status-error)]">{askError}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
