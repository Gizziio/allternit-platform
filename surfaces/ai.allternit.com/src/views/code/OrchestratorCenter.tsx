import React, { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, CheckCircle, PaperPlaneTilt, Play, Robot, Stop, WarningCircle } from '@phosphor-icons/react';
import {
  assignExecutor, getOrchestratorDoctor, killExecutor, listExecutorSessions, reviewExecutor, sendExecutorMessage,
  subscribeOrchestratorEvents, tailExecutor, watchExecutor, type AssignExecutorInput, type DoctorReport, type ExecutorSession, type ReviewResult,
} from './orchestrator.service';

const initialInput: AssignExecutorInput = { slug: '', workdir: '', vendor: 'codex', mode: 'interactive', backend: 'tmux', isolation: 'worktree', notesFile: 'docs/ORCHESTRATOR_NOTES.md', prompt: '' };

export function OrchestratorCenter(): React.ReactNode {
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [sessions, setSessions] = useState<ExecutorSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState(initialInput);
  const [tail, setTail] = useState('');
  const [steer, setSteer] = useState('');
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (includeDoctor = false) => {
    try {
      const [nextSessions, nextDoctor] = await Promise.all([
        listExecutorSessions(),
        includeDoctor ? getOrchestratorDoctor() : Promise.resolve(null),
      ]);
      if (nextDoctor) setDoctor(nextDoctor);
      setSessions(nextSessions); setError(null);
      setSelected((current) => current && nextSessions.some((session) => session.slug === current) ? current : nextSessions[0]?.slug ?? null);
    } catch (cause) { setError(message(cause)); }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void refresh(true).then(() => { unsubscribe = subscribeOrchestratorEvents(() => void refresh()); });
    return () => unsubscribe?.();
  }, [refresh]);
  useEffect(() => { if (!selected) { setTail(''); return; } void tailExecutor(selected).then(setTail).catch((cause) => setError(message(cause))); }, [selected, sessions]);

  const act = async (action: () => Promise<void>) => { setBusy(true); try { await action(); setError(null); await refresh(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } };
  const current = sessions.find((session) => session.slug === selected);

  return <div className="flex h-full min-h-0 bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <aside className="flex w-96 shrink-0 flex-col border-r border-[var(--border-subtle)]">
      <header className="border-b border-[var(--border-subtle)] p-3"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Robot size={17} />Orchestrator</h2><button type="button" onClick={() => void refresh(true)} className="rounded p-1.5 text-[var(--text-tertiary)]"><ArrowClockwise size={14} /></button></div><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{doctor?.ok ? 'Executor runtime ready' : 'No usable executor runtime'} · {doctor?.vendors.filter((vendor) => vendor.interactiveSupported || vendor.headlessSupported).map((vendor) => vendor.vendor).join(', ') || 'probing'}</p></header>
      <div className="grid gap-2 border-b border-[var(--border-subtle)] p-3">
        <div className="grid grid-cols-2 gap-2"><input aria-label="Session slug" placeholder="session-slug" value={input.slug} onChange={(e) => setInput({ ...input, slug: e.target.value })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs" /><input aria-label="Working directory" placeholder="/path/to/repo" value={input.workdir} onChange={(e) => setInput({ ...input, workdir: e.target.value })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs" /></div>
        <div className="grid grid-cols-2 gap-2"><select aria-label="Vendor" value={input.vendor} onChange={(e) => setInput({ ...input, vendor: e.target.value as AssignExecutorInput['vendor'] })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs"><option>codex</option><option>kimi</option><option>claude</option><option>agy</option></select><select aria-label="Mode" value={input.mode} onChange={(e) => setInput({ ...input, mode: e.target.value as AssignExecutorInput['mode'] })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs"><option>interactive</option><option>headless</option></select><select aria-label="Backend" value={input.backend} onChange={(e) => setInput({ ...input, backend: e.target.value as AssignExecutorInput['backend'] })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs"><option value="tmux">tmux</option><option value="terminal-control" disabled={doctor?.backends?.terminalControl.installed === false}>terminal-control</option></select><select aria-label="Isolation" value={input.isolation} onChange={(e) => setInput({ ...input, isolation: e.target.value as AssignExecutorInput['isolation'] })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs"><option value="worktree">worktree</option><option value="none">shared</option></select></div>
        <input aria-label="Notes sentinel" placeholder="docs/TASK_NOTES.md" value={input.notesFile} onChange={(e) => setInput({ ...input, notesFile: e.target.value })} className="rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs" />
        <textarea aria-label="Initial executor prompt" placeholder="Read the task spec and execute it exactly…" value={input.prompt} onChange={(e) => setInput({ ...input, prompt: e.target.value })} rows={2} className="resize-none rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs" />
        <button type="button" disabled={busy || !input.slug || !input.workdir || !input.notesFile || (input.mode === 'headless' && !input.prompt)} onClick={() => void act(async () => { const session = await assignExecutor(input); setSelected(session.slug); })} className="flex items-center justify-center gap-2 rounded bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-[var(--ui-text-inverse)] disabled:opacity-40"><Play size={13} weight="fill" />Assign executor</button>
      </div>
      <div className="flex-1 overflow-auto p-2">{sessions.length === 0 ? <Empty text="No executor sessions registered." /> : sessions.map((session) => <button type="button" key={session.slug} onClick={() => { setSelected(session.slug); setReview(null); }} className={`mb-1 w-full rounded-lg border p-3 text-left ${selected === session.slug ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-semibold">{session.slug}</span><span className="flex shrink-0 items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]"><span>{session.state}</span>{session.review && <ReviewStatus status={session.review.status} />}</span></div><p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{session.vendor} · {session.mode} · {session.workdir}</p></button>)}</div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold">{current?.slug ?? 'Select a session'}</h3>{current?.review && <ReviewStatus status={current.review.status} />}</div><p className="truncate text-[10px] text-[var(--text-tertiary)]">{current?.transcriptPath ?? 'Terminal evidence appears here'}</p>{current?.review?.reason && <p className="mt-1 truncate text-[10px] text-[var(--text-secondary)]">Decision reason: {current.review.reason}</p>}</div>{current && <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => void act(async () => { setReview(await watchExecutor(current.slug)); })} className="rounded border border-[var(--ui-border-muted)] px-3 py-1.5 text-xs">Watch for review</button><button type="button" disabled={busy} onClick={() => void act(async () => { await killExecutor(current.slug); setSelected(null); })} className="flex items-center gap-1 rounded border border-[var(--status-error)]/40 px-3 py-1.5 text-xs text-[var(--status-error)]"><Stop size={12} />Kill</button></div>}</header>
      {error && <div role="alert" className="m-3 flex items-center gap-2 rounded border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]"><WarningCircle size={14} />{error}</div>}
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-black/80 p-4 font-mono text-xs leading-5 text-neutral-200">{tail || 'No terminal output.'}</pre>
      {review && <div className="border-t border-[var(--border-subtle)] p-3 text-xs"><div className="flex items-center gap-2 font-semibold"><CheckCircle size={15} className="text-[var(--status-success)]" />Review pending · {review.outcome.kind}</div><p className="mt-1 text-[var(--text-tertiary)]">Actual footprint: {review.footprint?.changedFiles.join(', ') || 'unavailable'}</p>{review.footprint?.artifacts?.map((artifact) => <p key={artifact.path} className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{artifact.kind}: {artifact.path} {artifact.sensitive ? '· sensitive' : ''}</p>)}{review.outcome.kind === 'done' && current?.review?.status === 'pending' && <div className="mt-2 flex gap-2"><button type="button" onClick={() => void act(async () => { await reviewExecutor(current.slug, 'accepted'); })} className="rounded bg-[var(--status-success)] px-3 py-1.5 font-semibold text-white">Accept</button><button type="button" onClick={() => void act(async () => { await reviewExecutor(current.slug, 'rejected', 'Changes require another iteration'); })} className="rounded border border-[var(--status-error)]/40 px-3 py-1.5 font-semibold text-[var(--status-error)]">Reject</button></div>}</div>}
      {current && <footer className="flex gap-2 border-t border-[var(--border-subtle)] p-3"><input value={steer} onChange={(e) => setSteer(e.target.value)} placeholder="Steer or re-task this executor…" className="min-w-0 flex-1 rounded border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-3 py-2 text-xs" /><button type="button" disabled={busy || !steer.trim()} onClick={() => void act(async () => { const value = steer.trim(); await sendExecutorMessage(current.slug, value); setSteer(''); })} className="rounded bg-[var(--accent-primary)] px-4 text-[var(--ui-text-inverse)] disabled:opacity-40"><PaperPlaneTilt size={15} /></button></footer>}
    </section>
  </div>;
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Orchestrator request failed'; }
function Empty({ text }: { text: string }): React.ReactNode { return <div className="grid h-full min-h-24 place-items-center text-xs text-[var(--text-tertiary)]">{text}</div>; }
function ReviewStatus({ status }: { status: NonNullable<ExecutorSession['review']>['status'] }): React.ReactNode {
  const tone = status === 'accepted' ? 'border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]' : status === 'rejected' ? 'border-[var(--status-error)]/30 bg-[var(--status-error)]/10 text-[var(--status-error)]' : 'border-[var(--ui-border-muted)] bg-[var(--surface-panel)] text-[var(--text-secondary)]';
  return <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium leading-none ${tone}`}>Review {status}</span>;
}
