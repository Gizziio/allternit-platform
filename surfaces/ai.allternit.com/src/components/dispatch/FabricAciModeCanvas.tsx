'use client';

import React, { useState } from 'react';
import { Eye, EyeSlash, PaperPlaneRight, Spinner } from '@phosphor-icons/react';
import { ACIComputerUseView } from '@/capsules/browser/ACIComputerUseView';
import type { FabricSessionWithStatus } from '@/lib/dispatch/fabric-session-client';

/**
 * FabricAciModeCanvas — the full desktop ACI computer interface inside the
 * fabric session surface: the live ACI viewport (status strip, screenshot,
 * element highlights) with a goal composer underneath, same as desktop
 * browser/code ACI panes. Goals are started through the fabric session
 * client (they run on the paired node), not the local engine.
 */
export function FabricAciModeCanvas({
  session,
  hostName,
  opening,
  watching,
  onToggleWatch,
  onRunGoal,
  brainPicker,
}: {
  session: FabricSessionWithStatus | null;
  hostName?: string;
  opening?: boolean;
  watching?: boolean;
  onToggleWatch?: () => void;
  onRunGoal: (goal: string) => void;
  brainPicker?: React.ReactNode;
}) {
  const [goal, setGoal] = useState('');

  const submit = () => {
    const text = goal.trim();
    if (!text || opening) return;
    onRunGoal(text);
    setGoal('');
  };

  const host = hostName || session?.session.title || 'paired node';

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[var(--shell-view-bg)]">
      <div className="relative flex-1 min-h-0">
        <ACIComputerUseView agentBarHeight={0} engineHint={false} />
      </div>
      <div className="shrink-0 border-t border-solid border-[var(--border-subtle)] bg-[var(--shell-view-bg)] px-3 pt-2 pb-3">
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-3 pt-2.5 pb-2">
          <textarea
            data-aci-goal-composer
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={`Run a task on ${host}…`}
            rows={2}
            className="w-full resize-none border-none bg-transparent px-0.5 py-1 text-[14px] leading-5 text-[var(--shell-item-fg)] placeholder:text-[var(--shell-item-muted)] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2 min-w-0">
              {brainPicker}
              {onToggleWatch ? (
                <button
                  type="button"
                  onClick={onToggleWatch}
                  title={watching ? 'Stop watching the computer' : 'Watch the computer'}
                  className="size-8 shrink-0 rounded-full border-none cursor-pointer bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] flex items-center justify-center"
                >
                  {watching ? <Eye size={16} weight="fill" /> : <EyeSlash size={16} />}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={opening || !goal.trim()}
              className="size-8 shrink-0 rounded-full border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center"
            >
              {opening ? <Spinner className="animate-spin" size={16} /> : <PaperPlaneRight size={16} weight="fill" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
