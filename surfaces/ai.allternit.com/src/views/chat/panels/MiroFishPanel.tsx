import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StopCircle, ChatCircleDots, ClockCounterClockwise, ArrowClockwise } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useMiroFishRunStore } from '@/stores/mirofish-run.store';

const logger = createModuleLogger('MiroFish');

/**
 * Results-only surface for MiroFish. The chat composer is the single entry
 * point: a prompt submitted while the Population Simulation sub-mode is
 * active arrives via `useMiroFishRunStore`; interpretation (seed, kind,
 * population/rounds, grounding entities) is model-derived from the natural
 * language — there is no input form here, only detected-config chips for
 * tweak + re-run.
 *
 * `@/lib/mirofish` and `@/lib/sandbox/swarm` are reached exclusively through
 * the dynamic `import()` below (same lazy-chunk boundary as every other mode
 * plugin); all types are derived structurally and erased at compile time.
 */
type MiroFishRuntime = typeof import('@/plugins/built-in/mirofish/plugin');
type RunFromPromptFn = MiroFishRuntime['runMiroFishFromPrompt'];
type RunFromPromptOptions = NonNullable<Parameters<RunFromPromptFn>[1]>;
type ProgressEvent = Parameters<NonNullable<RunFromPromptOptions['onProgress']>>[0];
type PromptRunResult = Awaited<ReturnType<RunFromPromptFn>>;
type ResolvedConfig = PromptRunResult['resolved'];
type WorldState = PromptRunResult['world'];
type Persona = WorldState['personas'][number];
type RoundSummary = WorldState['roundSummaries'][number];
type AppModel = Awaited<ReturnType<MiroFishRuntime['listMiroFishModels']>>[number];

async function loadMiroFishRuntime(): Promise<MiroFishRuntime> {
  return import('@/plugins/built-in/mirofish/plugin');
}

const MIN_POPULATION = 1;
const MAX_POPULATION = 50;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 10;

/**
 * Server-side execution: the model-proxy sidecar (when running under bun)
 * executes simulations itself — closing the tab doesn't kill a run. Derived
 * from the same env var as model routing; absent in production builds, where
 * runs stay in-browser.
 */
const SERVER_RUN_BASE = (() => {
  const base = import.meta.env.VITE_LOCAL_AI_BASE_URL as string | undefined;
  if (!base) return null;
  try {
    const origin = globalThis.location?.origin ?? 'http://127.0.0.1:8090';
    return new URL(base.replace(/\/v1\/?$/, ''), origin).href.replace(/\/$/, '');
  } catch {
    return null;
  }
})();

interface ServerRunHooks {
  signal: AbortSignal;
  onProgress: (progress: ProgressEvent) => void;
}

/** Run on the sidecar via SSE; returns null when the server path is unavailable. */
async function runPromptOnServer(
  prompt: string,
  options: { modelId?: string; overrides?: { populationSize?: number; rounds?: number } },
  hooks: ServerRunHooks
): Promise<PromptRunResult | null> {
  if (!SERVER_RUN_BASE) return null;

  let runId: string;
  try {
    const created = await fetch(`${SERVER_RUN_BASE}/mirofish/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId: options.modelId, overrides: options.overrides }),
      signal: hooks.signal,
    });
    if (!created.ok) return null; // 501 under plain node, etc. — fall back
    runId = ((await created.json()) as { id: string }).id;
  } catch (error) {
    if (hooks.signal.aborted) throw error;
    return null; // sidecar not reachable — fall back to in-browser
  }

  const cancelServerRun = () =>
    void fetch(`${SERVER_RUN_BASE}/mirofish/runs/${runId}`, { method: 'DELETE' }).catch(() => {});
  hooks.signal.addEventListener('abort', cancelServerRun, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const events = new EventSource(`${SERVER_RUN_BASE}/mirofish/runs/${runId}/events`);
      const finish = (fn: () => void) => {
        events.close();
        fn();
      };
      events.onmessage = (message) => {
        const event = JSON.parse(message.data) as { type: string; progress?: ProgressEvent; error?: string };
        if (event.type === 'progress' && event.progress) hooks.onProgress(event.progress);
        else if (event.type === 'done') finish(resolve);
        else if (event.type === 'cancelled') finish(() => reject(new DOMException('cancelled', 'AbortError')));
        else if (event.type === 'error') finish(() => reject(new Error(event.error ?? 'Server run failed')));
      };
      events.onerror = () => finish(() => reject(new Error('Lost connection to the simulation server')));
      hooks.signal.addEventListener('abort', () => finish(() => reject(new DOMException('cancelled', 'AbortError'))), { once: true });
    });
  } finally {
    hooks.signal.removeEventListener('abort', cancelServerRun);
  }

  const record = (await (await fetch(`${SERVER_RUN_BASE}/mirofish/runs/${runId}`)).json()) as {
    world: PromptRunResult['world'];
    resolved: PromptRunResult['resolved'];
  };
  return { world: record.world, resolved: record.resolved };
}

interface ChatEntry {
  question: string;
  answer: string;
}

/** Persisted finished run (amadad-style run manifest, browser-local for now). */
interface RecentRun {
  id: string;
  savedAt: number;
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
    seedPreview: world.seed.text.slice(0, 80),
    world,
  };
  const next = [entry, ...loadRecentRuns().filter((r) => r.id !== world.id)].slice(0, MAX_RECENT_RUNS);
  try {
    localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(next));
  } catch {
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
      return 'Interpreting your request…';
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

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function MiroFishPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [resolved, setResolved] = useState<ResolvedConfig | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [models, setModels] = useState<AppModel[]>([]);
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  const [overridePopulation, setOverridePopulation] = useState<number | null>(null);
  const [overrideRounds, setOverrideRounds] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [chatByPersonaId, setChatByPersonaId] = useState<Record<string, ChatEntry[]>>({});

  const pendingRunId = useMiroFishRunStore((state) => state.pendingRunId);

  useEffect(() => {
    setRecentRuns(loadRecentRuns());
    void loadMiroFishRuntime()
      .then((runtime) => runtime.listMiroFishModels())
      .then(setModels)
      .catch((error) => logger.warn({ error }, 'Could not load model list for MiroFish chip'));
    // Cancel any in-flight run if the panel unmounts — no orphaned model calls.
    return () => abortRef.current?.abort();
  }, []);

  const runPrompt = useCallback(
    async (prompt: string, overrides?: { populationSize?: number; rounds?: number }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsRunning(true);
      setRunError(null);
      setWorld(null);
      setResolved(null);
      setSelectedPersonaId(null);
      setChatByPersonaId({});
      setProgress(null);
      setLastPrompt(prompt);

      try {
        // Server-side first (survives tab close); in-browser fallback.
        let result = await runPromptOnServer(
          prompt,
          { modelId, overrides },
          { signal: controller.signal, onProgress: setProgress }
        );
        if (!result) {
          const runtime = await loadMiroFishRuntime();
          result = await runtime.runMiroFishFromPrompt(prompt, {
            signal: controller.signal,
            onProgress: setProgress,
            modelId,
            overrides,
          });
        }
        setWorld(result.world);
        setResolved(result.resolved);
        setOverridePopulation(result.resolved.populationSize);
        setOverrideRounds(result.resolved.rounds);
        setSelectedPersonaId(result.world.personas[0]?.id ?? null);
        setRecentRuns(saveRecentRun(result.world));
      } catch (error) {
        if (isAbortLike(error) || controller.signal.aborted) {
          logger.debug({ error }, 'MiroFish simulation cancelled');
        } else {
          logger.error({ error }, 'MiroFish simulation failed');
          setRunError(error instanceof Error ? error.message : 'Simulation failed.');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsRunning(false);
        setProgress(null);
      }
    },
    [modelId]
  );

  // A prompt submitted from the composer while this sub-mode is active.
  useEffect(() => {
    if (pendingRunId === 0) return;
    const prompt = useMiroFishRunStore.getState().pendingPrompt;
    if (!prompt?.trim()) return;
    useMiroFishRunStore.getState().clearPending();
    void runPrompt(prompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per submitted run id
  }, [pendingRunId]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRerun = useCallback(() => {
    if (!lastPrompt || isRunning) return;
    void runPrompt(lastPrompt, {
      populationSize: overridePopulation ?? undefined,
      rounds: overrideRounds ?? undefined,
    });
  }, [lastPrompt, isRunning, overridePopulation, overrideRounds, runPrompt]);

  const handleLoadRecent = useCallback(
    (run: RecentRun) => {
      if (isRunning) return;
      setWorld(run.world);
      setResolved(null);
      setSelectedPersonaId(run.world.personas[0]?.id ?? null);
      setChatByPersonaId({});
      setRunError(null);
    },
    [isRunning]
  );

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
        modelId,
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
  }, [world, selectedPersona, question, isAsking, chatByPersonaId, modelId]);

  const selectedPersonaChat = selectedPersona ? chatByPersonaId[selectedPersona.id] ?? [] : [];
  const languageModels = useMemo(() => models.filter((m) => m.output.text), [models]);

  const chipClass =
    'flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-secondary';

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

        {!world && !isRunning && !runError && (
          <p className="text-[12px] text-muted leading-[1.55]">
            Describe what to simulate in the composer above and hit send — e.g.{' '}
            <span className="text-secondary">
              “Simulate how 8 downtown retailers react to the new congestion charge over 3 rounds.”
            </span>{' '}
            Population, rounds, and material type are read from your words (defaults: 12 personas × 3
            rounds), personas are grounded in the people and groups your material actually names, and
            you can interrogate any persona afterwards.
          </p>
        )}

        {isRunning && (
          <div className="flex items-center gap-2 rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/[0.06] px-3 py-2">
            <span className="text-xs text-[#06b6d4]">{progressLabel(progress)}</span>
            <div className="ml-auto flex items-center gap-2">
              {progress && progress.total > 0 && (
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#06b6d4] transition-all"
                    style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                  />
                </div>
              )}
              <Button variant="secondary" onClick={handleCancel}>
                <StopCircle size={14} weight="fill" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {runError && (
          <div className="rounded-lg border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]">
            {runError}
          </div>
        )}

        {(resolved || world) && !isRunning && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.14em]">
              {resolved ? 'Detected' : 'Loaded run'}
            </span>
            {resolved && <span className={chipClass}>{resolved.kind}</span>}
            <span className={chipClass}>
              <input
                type="number"
                min={MIN_POPULATION}
                max={MAX_POPULATION}
                value={overridePopulation ?? world?.personas.length ?? 0}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) setOverridePopulation(clampInt(next, MIN_POPULATION, MAX_POPULATION));
                }}
                className="w-10 bg-transparent text-center text-[11px] text-secondary focus:outline-none"
                aria-label="Population size"
              />
              personas
            </span>
            <span className={chipClass}>
              <input
                type="number"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={overrideRounds ?? world?.currentRound ?? 0}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) setOverrideRounds(clampInt(next, MIN_ROUNDS, MAX_ROUNDS));
                }}
                className="w-8 bg-transparent text-center text-[11px] text-secondary focus:outline-none"
                aria-label="Rounds"
              />
              rounds
            </span>
            {languageModels.length > 0 && (
              <span className={chipClass}>
                <select
                  value={modelId ?? ''}
                  onChange={(e) => setModelId(e.target.value || undefined)}
                  className="max-w-[180px] bg-transparent text-[11px] text-secondary focus:outline-none"
                  aria-label="Model"
                >
                  <option value="">default model</option>
                  {languageModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name ?? model.id}
                    </option>
                  ))}
                </select>
              </span>
            )}
            {lastPrompt && (
              <Button variant="secondary" onClick={handleRerun}>
                <ArrowClockwise size={14} />
                Re-run
              </Button>
            )}
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
                  <span className="text-muted">
                    · {run.world.personas.length}p×{run.world.currentRound}r
                  </span>
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
