import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlayCircle, StopCircle, ChatCircleDots, ClockCounterClockwise } from '@phosphor-icons/react';

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
type RunOptions = NonNullable<Parameters<RunSimulationFn>[2]>;
type ProgressEvent = Parameters<NonNullable<RunOptions['onProgress']>>[0];
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

/** Persisted finished run (amadad-style run manifest, browser-local for now). */
interface RecentRun {
  id: string;
  savedAt: number;
  kind: SeedMaterialKind;
  seedPreview: string;
  world: WorldState;
}

const RECENT_RUNS_KEY = 'mirofish.recent-runs';
const MAX_RECENT_RUNS = 5;

function loadRecentRuns(): RecentRun[] {
  try {
    const raw = localStorage.getItem(RECENT_RUNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentRun[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentRun(world: WorldState): RecentRun[] {
  const entry: RecentRun = {
    id: world.id,
    savedAt: Date.now(),
    kind: world.seed.kind,
    seedPreview: world.seed.text.slice(0, 80),
    world,
  };
  const next = [entry, ...loadRecentRuns().filter((r) => r.id !== world.id)].slice(0, MAX_RECENT_RUNS);
  try {
    localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded (large worlds) — drop the oldest and retry once.
    try {
      localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(next.slice(0, 2)));
    } catch {
      /* persistence is best-effort */
    }
  }
  return next;
}

function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function progressLabel(progress: ProgressEvent | null): string {
  if (!progress) return 'Starting…';
  switch (progress.stage) {
    case 'graph':
      return 'Analyzing seed material…';
    case 'personas':
      return `Generating personas ${progress.completed}/${progress.total}…`;
    case 'rounds':
      return `Round ${progress.round}/${progress.rounds} — ${progress.completed}/${progress.total} agents…`;
    case 'report':
      return 'Writing report…';
    default:
      return 'Running…';
  }
}

export function MiroFishPanel() {
  const [seedKind, setSeedKind] = useState<SeedMaterialKind>('news');
  const [seedText, setSeedText] = useState('');
  const [populationSize, setPopulationSize] = useState(DEFAULT_POPULATION);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRecentRuns(loadRecentRuns());
    // Cancel any in-flight run if the panel unmounts — no orphaned model calls.
    return () => abortRef.current?.abort();
  }, []);

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
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const seed: SeedMaterial = { kind: seedKind, text: seedText.trim() };
    const config: SimulationConfig = { populationSize, rounds };

    try {
      const runtime = await loadMiroFishRuntime();
      const result = await runtime.runMiroFishSimulation(seed, config, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setWorld(result);
      setSelectedPersonaId(result.personas[0]?.id ?? null);
      setRecentRuns(saveRecentRun(result));
    } catch (error) {
      if (isAbortLike(error) || controller.signal.aborted) {
        logger.debug({ error }, 'MiroFish simulation cancelled');
      } else {
        logger.error({ error }, 'MiroFish simulation failed');
        setRunError(error instanceof Error ? error.message : 'Simulation failed.');
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
      setProgress(null);
    }
  }, [canRun, seedKind, seedText, populationSize, rounds]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleLoadRecent = useCallback((run: RecentRun) => {
    if (isRunning) return;
    setWorld(run.world);
    setSelectedPersonaId(run.world.personas[0]?.id ?? null);
    setChatByPersonaId({});
    setRunError(null);
    setSeedText(run.world.seed.text);
    setSeedKind(run.world.seed.kind);
  }, [isRunning]);

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
      const answer = await runtime.askMiroFishPersona(world, selectedPersona, askedQuestion, {
        history: chatByPersonaId[selectedPersona.id] ?? [],
      });
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
  }, [world, selectedPersona, question, isAsking, chatByPersonaId]);

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
            ≈ {2 + populationSize + populationSize * rounds} model calls (seed graph + {populationSize} personas + {populationSize}×{rounds} turns + report).
          </span>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Button variant="secondary" onClick={handleCancel}>
                <StopCircle size={16} weight="fill" />
                Cancel
              </Button>
            )}
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
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/[0.06] px-3 py-2">
            <span className="text-xs text-[#06b6d4]">{progressLabel(progress)}</span>
            {progress && progress.total > 0 && (
              <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#06b6d4] transition-all"
                  style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {runError && (
          <div className="rounded-lg border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]">
            {runError}
          </div>
        )}

        {!isRunning && !world && recentRuns.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.14em]">Recent runs</span>
            <div className="flex flex-wrap gap-1.5">
              {recentRuns.map((run) => (
                <button
                  type="button"
                  key={run.id}
                  onClick={() => handleLoadRecent(run)}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-secondary transition-colors hover:border-white/[0.18]"
                  title={run.seedPreview}
                >
                  <ClockCounterClockwise size={12} />
                  <span className="max-w-[180px] truncate">{run.seedPreview}</span>
                  <span className="text-muted">· {run.world.personas.length}p×{run.world.currentRound}r</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {world && (
        <>
          {world.report && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-[#06b6d4]/25 bg-[#06b6d4]/[0.04] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.14em]">
                  Prediction report
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    world.report.confidence === 'high' && 'border-emerald-400/40 text-emerald-300',
                    world.report.confidence === 'medium' && 'border-amber-400/40 text-amber-300',
                    world.report.confidence === 'low' && 'border-white/[0.15] text-muted'
                  )}
                >
                  {world.report.confidence} confidence
                </span>
              </div>
              <p className="text-[12.5px] text-primary leading-[1.55]">{world.report.executiveSummary}</p>
              {world.report.riskSignals.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-[0.14em]">Risk signals</span>
                  <ul className="flex flex-col gap-1">
                    {world.report.riskSignals.map((signal, index) => (
                      <li key={index} className="flex gap-2 text-[12px] text-secondary leading-[1.45]">
                        <span className="text-[var(--status-error)]">⚠</span>
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {world.report.narrativePaths.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-[0.14em]">Narrative paths</span>
                  <ul className="flex flex-col gap-1">
                    {world.report.narrativePaths.map((path, index) => (
                      <li key={index} className="flex gap-2 text-[12px] text-secondary leading-[1.45]">
                        <span className="text-[#06b6d4]">→</span>
                        {path}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#06b6d4]">Round {summary.round}</span>
                    {summary.agentsTotal > 0 && (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px]',
                          summary.agentsActed < summary.agentsTotal
                            ? 'border-amber-400/40 text-amber-300'
                            : 'border-white/[0.08] text-muted'
                        )}
                      >
                        {summary.agentsActed}/{summary.agentsTotal} agents responded
                      </span>
                    )}
                  </div>
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
