import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, Broadcast, Check, Circle, PaperPlaneTilt, Users, WarningCircle } from '@phosphor-icons/react';
import { getPeerContext, listPeers, markPeerInboxRead, readPeerInbox, sendPeerMessage, type CodePeer, type PeerMessage } from './peer-collaboration.service';

export function PeerCollaborationCenter(): React.ReactNode {
  const [team, setTeam] = useState(() => localValue('allternit-peer-team', 'default'));
  const [self, setSelf] = useState(() => localValue('allternit-peer-self', 'team-lead'));
  const [hadSavedSelf] = useState(() => hasLocalValue('allternit-peer-self'));
  const [identitySource, setIdentitySource] = useState<'runtime' | 'saved'>('saved');
  const [peers, setPeers] = useState<CodePeer[]>([]);
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!team.trim() || !self.trim()) return;
    try {
      const [nextPeers, nextMessages] = await Promise.all([listPeers(team.trim()), readPeerInbox(team.trim(), self.trim())]);
      setPeers(nextPeers);
      setMessages(nextMessages);
      setSelected((current) => current.filter((name) => nextPeers.some((peer) => peer.name === name)));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load peer collaboration state');
    }
  }, [self, team]);

  useEffect(() => {
    window.localStorage.setItem('allternit-peer-team', team);
    window.localStorage.setItem('allternit-peer-self', self);
  }, [self, team]);
  useEffect(() => {
    void getPeerContext().then((context) => {
      if (context.source === 'runtime') {
        setTeam(context.team!);
        setSelf(context.agent);
        setIdentitySource('runtime');
      } else if (!hadSavedSelf) {
        setSelf(context.agent);
      }
    }).catch(() => undefined);
  }, [hadSavedSelf]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 5_000); return () => window.clearInterval(timer); }, [refresh]);

  const unread = useMemo(() => messages.filter((message) => !message.read).length, [messages]);
  const togglePeer = (name: string) => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const send = async () => {
    const text = draft.trim();
    if (!text || selected.length === 0) return;
    setSending(true);
    try {
      await sendPeerMessage({ team: team.trim(), from: self.trim(), recipients: selected, text, summary: text.slice(0, 80) });
      setDraft('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  return <div className="flex h-full min-h-0 bg-[var(--bg-primary)]">
    <aside className="flex w-80 shrink-0 flex-col border-r border-[var(--border-subtle)]">
      <header className="border-b border-[var(--border-subtle)] p-3"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Users size={17} />Peers</h2><button type="button" onClick={() => void refresh()} aria-label="Refresh peers" className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"><ArrowClockwise size={14} /></button></div><div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-medium text-[var(--text-tertiary)]">{identitySource === 'runtime' ? 'Runtime identity' : 'Saved identity'}</span></div><div className="mt-1 grid grid-cols-2 gap-2"><input value={team} onChange={(event) => setTeam(event.target.value)} aria-label="Team name" placeholder="Team" className="min-w-0 rounded-md border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs text-[var(--text-primary)]" /><input value={self} onChange={(event) => setSelf(event.target.value)} aria-label="Your agent name" placeholder="Your agent" className="min-w-0 rounded-md border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1.5 text-xs text-[var(--text-primary)]" /></div></header>
      <div className="flex-1 overflow-auto p-2">{peers.length === 0 ? <Empty text="No teammates discovered for this team." /> : peers.map((peer) => { const active = selected.includes(peer.name); return <button type="button" key={peer.agentId} onClick={() => togglePeer(peer.name)} className={`mb-1 flex w-full items-center gap-3 rounded-lg border p-3 text-left ${active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-transparent hover:bg-[var(--surface-hover)]'}`}><span className="relative grid size-8 place-items-center rounded-full bg-[var(--surface-panel)] text-xs font-semibold text-[var(--text-primary)]">{peer.name.slice(0, 2).toUpperCase()}<Circle size={8} weight="fill" className={`absolute -bottom-0.5 -right-0.5 ${peer.status === 'running' ? 'text-[var(--status-success)]' : 'text-[var(--text-tertiary)]'}`} /></span><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-[var(--text-primary)]">{peer.name}</div><div className="truncate text-[10px] text-[var(--text-tertiary)]">{peer.agentType ?? peer.model ?? peer.backendType ?? 'agent'} · {peer.status}</div></div>{active && <Check size={14} weight="bold" className="text-[var(--accent-primary)]" />}</button>; })}</div>
      <div className="border-t border-[var(--border-subtle)] p-3"><button type="button" onClick={() => setSelected(peers.map((peer) => peer.name))} disabled={peers.length === 0} className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--ui-border-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40"><Broadcast size={14} />Select all peers</button></div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3"><div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Peer inbox</h2><p className="text-xs text-[var(--text-tertiary)]">{unread} unread · sending to {selected.length} peer{selected.length === 1 ? '' : 's'}</p></div>{unread > 0 && <button type="button" onClick={async () => { await markPeerInboxRead(team.trim(), self.trim()); await refresh(); }} className="rounded-md border border-[var(--ui-border-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">Mark all read</button>}</header>
      {error && <div role="alert" className="m-3 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]"><WarningCircle size={15} />{error}</div>}
      <div className="flex-1 overflow-auto p-4">{messages.length === 0 ? <Empty text="No messages in this peer inbox." /> : <div className="space-y-2">{messages.slice().reverse().map((message, index) => <article key={`${message.timestamp}:${message.from}:${index}`} className={`rounded-lg border p-3 ${message.read ? 'border-[var(--ui-border-muted)] bg-[var(--surface-panel)]/60' : 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'}`}><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-[var(--text-primary)]">{message.from}</span><time className="text-[10px] text-[var(--text-tertiary)]">{new Date(message.timestamp).toLocaleString()}</time></div>{message.summary && <p className="mt-1 text-[10px] font-medium text-[var(--text-tertiary)]">{message.summary}</p>}<p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{message.text}</p></article>)}</div>}</div>
      <footer className="border-t border-[var(--border-subtle)] p-3"><div className="flex gap-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={selected.length ? `Message ${selected.length} selected peer${selected.length === 1 ? '' : 's'}…` : 'Select at least one peer'} disabled={selected.length === 0} rows={2} className="min-w-0 flex-1 resize-none rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] disabled:opacity-50" /><button type="button" onClick={() => void send()} disabled={sending || !draft.trim() || selected.length === 0} className="self-stretch rounded-lg bg-[var(--accent-primary)] px-4 text-[var(--ui-text-inverse)] disabled:opacity-40"><PaperPlaneTilt size={17} weight="fill" /></button></div></footer>
    </section>
  </div>;
}

function localValue(key: string, fallback: string): string { if (typeof window === 'undefined') return fallback; return window.localStorage.getItem(key) || fallback; }
function hasLocalValue(key: string): boolean { return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(key)?.trim()); }
function Empty({ text }: { text: string }): React.ReactNode { return <div className="grid h-full min-h-32 place-items-center px-6 text-center text-xs text-[var(--text-tertiary)]">{text}</div>; }
