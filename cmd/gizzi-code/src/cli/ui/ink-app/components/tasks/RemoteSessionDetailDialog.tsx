import figures from 'figures';
import React, { useMemo, useState } from 'react';
import type { ToolUseContext } from './../../Tool.ts';
import type { DeepImmutable } from './../../types/utils.ts';
import type { CommandResultDisplay } from '../../commands';
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures';
import { useElapsedTime } from '../../hooks/useElapsedTime';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Link, Text } from '../../ink';
import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask';
import { getRemoteTaskSessionUrl } from '../../tasks/RemoteAgentTask/RemoteAgentTask';
import { AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME } from '../../tools/AgentTool/constants';
import { ASK_USER_QUESTION_TOOL_NAME } from '../../tools/AskUserQuestionTool/prompt';
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from '../../tools/ExitPlanModeTool/constants';
import { openBrowser } from '../../utils/browser';
import { errorMessage } from '../../utils/errors';
import { formatDuration, truncateToWidth } from '../../utils/format';
import { toInternalMessages } from '../../utils/messages/mappers';
import { EMPTY_LOOKUPS, normalizeMessages } from '../../utils/messages';
import { plural } from '../../utils/stringUtils';
import { teleportResumeCodeSession } from '../../utils/teleport';
import { Select } from '../CustomSelect/select';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
import { Message } from '../Message';
import { formatReviewStageCounts, RemoteSessionProgress } from './RemoteSessionProgress';
type Props = {
  session: DeepImmutable<RemoteAgentTaskState>;
  toolUseContext: ToolUseContext;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  onBack?: () => void;
  onKill?: () => void;
};

// Compact one-line summary: tool name + first meaningful string arg.
// Lighter than tool.renderToolUseMessage (no registry lookup / schema parse).
// Collapses whitespace so multi-line inputs (e.g. Bash command text)
// render on one line.
export function formatToolUseSummary(name: string, input: unknown): string {
  // plan_ready phase is only reached via ExitPlanMode tool
  if (name === EXIT_PLAN_MODE_V2_TOOL_NAME) {
    return 'Review the plan in Gizzi Code on the web';
  }
  if (!input || typeof input !== 'object') return name;
  // AskUserQuestion: show the question text as a CTA, not the tool name.
  // Input shape is {questions: [{question, header, options}]}.
  if (name === ASK_USER_QUESTION_TOOL_NAME && 'questions' in input) {
    const qs = input.questions;
    if (Array.isArray(qs) && qs[0] && typeof qs[0] === 'object') {
      // Prefer question (full text) over header (max-12-char tag). header
      // is a required schema field so checking it first would make the
      // question fallback dead code.
      const q = 'question' in qs[0] && typeof qs[0].question === 'string' && qs[0].question ? qs[0].question : 'header' in qs[0] && typeof qs[0].header === 'string' ? qs[0].header : null;
      if (q) {
        const oneLine = q.replace(/\s+/g, ' ').trim();
        return `Answer in browser: ${truncateToWidth(oneLine, 50)}`;
      }
    }
  }
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.trim()) {
      const oneLine = v.replace(/\s+/g, ' ').trim();
      return `${name} ${truncateToWidth(oneLine, 60)}`;
    }
  }
  return name;
}
const PHASE_LABEL = {
  needs_input: 'input required',
  plan_ready: 'ready'
} as const;
const AGENT_VERB = {
  needs_input: 'waiting',
  plan_ready: 'done'
} as const;
function UltraplanSessionDetail({
    session,
    onDone,
    onBack,
    onKill
}: Props) {
  const running = session.status === "running" || session.status === "pending";
  const phase = session.ultraplanPhase;
  const statusText = running ? phase ? PHASE_LABEL[phase] : "running" : session.status;
  const elapsedTime = useElapsedTime(session.startTime, running, 1000, 0, session.endTime);
  let spawns = 0;
  let calls = 0;
  let lastBlock = null;
  for (const msg of session.log) {
    if (msg.type !== "assistant") {
      continue;
    }
    for (const block of msg.message.content) {
      if (block.type !== "tool_use") {
        continue;
      }
      calls++;
      lastBlock = block;
      if (block.name === AGENT_TOOL_NAME || block.name === LEGACY_AGENT_TOOL_NAME) {
        spawns++;
      }
    }
  }
  const t1 = 1 + spawns;
  const t2 = lastBlock ? formatToolUseSummary(lastBlock.name, lastBlock.input) : null;

  const t3 = {
      agentsWorking: t1,
      toolCalls: calls,
      lastToolCall: t2
    };

  const {
    agentsWorking,
    toolCalls,
    lastToolCall
  } = t3;
  const t4 = getRemoteTaskSessionUrl(session.sessionId);

  const sessionUrl = t4;
  const t5 = onBack ?? (() => onDone("Remote session details dismissed", {
      display: "system"
    }));

  const goBackOrClose = t5;
  const [confirmingStop, setConfirmingStop] = useState(false);
  if (confirmingStop) {
    const t6 = () => setConfirmingStop(false);

    const t7 = <Text dimColor={true}>This will terminate the Gizzi Code on the web session.</Text>;

    const t8 = {
        label: "Terminate session",
        value: "stop" as const
      };

    const t9 = [t8, {
        label: "Back",
        value: "back" as const
      }];

    const t10 = <Dialog title="Stop ultraplan?" onCancel={t6} color="background"><Box flexDirection="column" gap={1}>{t7}<Select options={t9} onChange={v => {
            if (v === "stop") {
              onKill?.();
              goBackOrClose();
            } else {
              setConfirmingStop(false);
            }
          }} /></Box></Dialog>;

    return t10;
  }
  const t6 = phase === "plan_ready" ? DIAMOND_FILLED : DIAMOND_OPEN;
  const t7 = <Text color="background">{t6}{" "}</Text>;

  const t8 = <Text bold={true}>ultraplan</Text>;

  const t9 = <Text dimColor={true}>{" \xB7 "}{elapsedTime}{" \xB7 "}{statusText}</Text>;

  const t10 = <Text>{t7}{t8}{t9}</Text>;

  const t11 = phase === "plan_ready" && <Text color="success">{figures.tick} </Text>;

  const t12 = plural(agentsWorking, "agent");

  const t13 = phase ? AGENT_VERB[phase] : "working";
  const t14 = plural(toolCalls, "call");

  const t15 = <Text>{t11}{agentsWorking} {t12}{" "}{t13} · {toolCalls} tool{" "}{t14}</Text>;

  const t16 = lastToolCall && <Text dimColor={true}>{lastToolCall}</Text>;

  const t17 = <Text dimColor={true}>{sessionUrl}</Text>;

  const t18 = <Link url={sessionUrl}>{t17}</Link>;

  const t19 = {
      label: "Review in Gizzi Code on the web",
      value: "open" as const
    };

  const t20 = onKill && running ? [{
      label: "Stop ultraplan",
      value: "stop" as const
    }] : [];

  const t21 = {
      label: "Back",
      value: "back" as const
    };

  const t22 = [t19, ...t20, t21];

  const t23 = v_0 => {
      switch (v_0) {
        case "open":
          {
            openBrowser(sessionUrl);
            onDone();
            return;
          }
        case "stop":
          {
            setConfirmingStop(true);
            return;
          }
        case "back":
          {
            goBackOrClose();
            return;
          }
      }
    };

  const t24 = <Select options={t22} onChange={t23} />;

  const t25 = <Box flexDirection="column" gap={1}>{t15}{t16}{t18}{t24}</Box>;

  const t26 = <Dialog title={t10} onCancel={goBackOrClose} color="background">{t25}</Dialog>;

  return t26;
}
const STAGES = ['finding', 'verifying', 'synthesizing'] as const;
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  finding: 'Find',
  verifying: 'Verify',
  synthesizing: 'Dedupe'
};

// Setup → Find → Verify → Dedupe pipeline. Current stage in cloud teal,
// rest dim. When completed, all stages dim with a trailing green ✓. The
// "Setup" label shows before the orchestrator writes its first progress
// snapshot (container boot + repo clone), so the 0-found display doesn't
// look like a hung finder.
function StagePipeline(t0) {
  const {
    stage,
    completed,
    hasProgress
  } = t0;
  const t1 = stage ? STAGES.indexOf(stage) : -1;

  const currentIdx = t1;
  const inSetup = !completed && !hasProgress;
  const t2 = inSetup ? <Text color="background">Setup</Text> : <Text dimColor={true}>Setup</Text>;

  const t3 = <Text dimColor={true}> → </Text>;

  const t4 = STAGES.map((s, i) => {
      const isCurrent = !completed && !inSetup && i === currentIdx;
      return <React.Fragment key={s}>{i > 0 && <Text dimColor={true}> → </Text>}{isCurrent ? <Text color="background">{STAGE_LABELS[s]}</Text> : <Text dimColor={true}>{STAGE_LABELS[s]}</Text>}</React.Fragment>;
    });

  const t5 = completed && <Text color="success"> ✓</Text>;

  const t6 = <Text>{t2}{t3}{t4}{t5}</Text>;

  return t6;
}

// Stage-appropriate counts line. Running-state formatting delegates to
// formatReviewStageCounts (shared with the pill) so the two views can't
// drift; completed state is dialog-specific (findings summary).
function reviewCountsLine(session: DeepImmutable<RemoteAgentTaskState>): string {
  const p = session.reviewProgress;
  // No progress data — the orchestrator never wrote a snapshot. Don't
  // claim "0 findings" when completed; we just don't know.
  if (!p) return session.status === 'completed' ? 'done' : 'setting up';
  const verified = p.bugsVerified;
  const refuted = p.bugsRefuted ?? 0;
  if (session.status === 'completed') {
    const parts = [`${verified} ${plural(verified, 'finding')}`];
    if (refuted > 0) parts.push(`${refuted} refuted`);
    return parts.join(' · ');
  }
  return formatReviewStageCounts(p.stage, p.bugsFound, verified, refuted);
}
type MenuAction = 'open' | 'stop' | 'back' | 'dismiss';
function ReviewSessionDetail({
    session,
    onDone,
    onBack,
    onKill
}: Props) {
  const completed = session.status === "completed";
  const running = session.status === "running" || session.status === "pending";
  const [confirmingStop, setConfirmingStop] = useState(false);
  const elapsedTime = useElapsedTime(session.startTime, running, 1000, 0, session.endTime);
  const t1 = () => onDone("Remote session details dismissed", {
      display: "system"
    });

  const handleClose = t1;
  const goBackOrClose = onBack ?? handleClose;
  const t2 = getRemoteTaskSessionUrl(session.sessionId);

  const sessionUrl = t2;
  const statusLabel = completed ? "ready" : running ? "running" : session.status;
  if (confirmingStop) {
    const t3 = () => setConfirmingStop(false);

    const t4 = <Text dimColor={true}>This archives the remote session and stops local tracking. The review will not complete and any findings so far are discarded.</Text>;

    const t5 = {
        label: "Stop ultrareview",
        value: "stop" as const
      };

    const t6 = [t5, {
        label: "Back",
        value: "back" as const
      }];

    const t7 = <Dialog title="Stop ultrareview?" onCancel={t3} color="background"><Box flexDirection="column" gap={1}>{t4}<Select options={t6} onChange={v => {
            if (v === "stop") {
              onKill?.();
              goBackOrClose();
            } else {
              setConfirmingStop(false);
            }
          }} /></Box></Dialog>;

    return t7;
  }
  const t3 = completed ? [{
      label: "Open in Gizzi Code on the web",
      value: "open"
    }, {
      label: "Dismiss",
      value: "dismiss"
    }] : [{
      label: "Open in Gizzi Code on the web",
      value: "open"
    }, ...(onKill && running ? [{
      label: "Stop ultrareview",
      value: "stop" as const
    }] : []), {
      label: "Back",
      value: "back"
    }];

  const options = t3;
  const t4 = action => {
      bb45: switch (action) {
        case "open":
          {
            openBrowser(sessionUrl);
            onDone();
            break bb45;
          }
        case "stop":
          {
            setConfirmingStop(true);
            break bb45;
          }
        case "back":
          {
            goBackOrClose();
            break bb45;
          }
        case "dismiss":
          {
            handleClose();
          }
      }
    };

  const handleSelect = t4;
  const t5 = completed ? DIAMOND_FILLED : DIAMOND_OPEN;
  const t6 = <Text color="background">{t5}{" "}</Text>;

  const t7 = <Text bold={true}>ultrareview</Text>;

  const t8 = <Text dimColor={true}>{" \xB7 "}{elapsedTime}{" \xB7 "}{statusLabel}</Text>;

  const t9 = <Text>{t6}{t7}{t8}</Text>;

  const t10 = session.reviewProgress?.stage;
  const t11 = !!session.reviewProgress;
  const t12 = <StagePipeline stage={t10} completed={completed} hasProgress={t11} />;

  const t13 = reviewCountsLine(session);

  const t14 = <Text>{t13}</Text>;

  const t15 = <Text dimColor={true}>{sessionUrl}</Text>;

  const t16 = <Link url={sessionUrl}>{t15}</Link>;

  const t17 = <Box flexDirection="column">{t14}{t16}</Box>;

  const t18 = <Select options={options} onChange={handleSelect} />;

  const t19 = <Box flexDirection="column" gap={1}>{t12}{t17}{t18}</Box>;

  const t20 = <Dialog title={t9} onCancel={goBackOrClose} color="background" inputGuide={_temp}>{t19}</Dialog>;

  return t20;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Enter" action="select" /><KeyboardShortcutHint shortcut="Esc" action="go back" /></Byline>;
}
export function RemoteSessionDetailDialog({
  session,
  toolUseContext,
  onDone,
  onBack,
  onKill
}: Props): React.ReactNode {
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [teleportError, setTeleportError] = useState<string | null>(null);

  // Get last few messages from remote session for display.
  // Scan all messages (not just the last 3 raw entries) because the tail of
  // the log is often thinking-only blocks that normalise to 'progress' type.
  // Placed before the early returns so hook call order is stable (Rules of Hooks).
  // Ultraplan/review sessions never read this — skip the normalize work for them.
  const lastMessages = useMemo(() => {
    if (session.isUltraplan || session.isRemoteReview) return [];
    // TODO(types): agentSdkTypes stub no longer exports SDKMessage; the
    // cast target is toInternalMessages' own parameter type.
    return normalizeMessages(toInternalMessages(session.log as unknown as Parameters<typeof toInternalMessages>[number])).filter(_ => (_ as { type: string }).type !== 'progress').slice(-3);
  }, [session]);
  if (session.isUltraplan) {
    return <UltraplanSessionDetail session={session} onDone={onDone} onBack={onBack} onKill={onKill} toolUseContext={toolUseContext} />;
  }

  // Review sessions get the stage-pipeline view; everything else keeps the
  // generic label/value + recent-messages dialog below.
  if (session.isRemoteReview) {
    return <ReviewSessionDetail session={session} onDone={onDone} onBack={onBack} onKill={onKill} toolUseContext={toolUseContext} />;
  }
  const handleClose = () => onDone('Remote session details dismissed', {
    display: 'system'
  });

  // Component-specific shortcuts shown in UI hints (t=teleport, space=dismiss,
  // left=back). These are state-dependent actions, not standard dialog keybindings.
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      onDone('Remote session details dismissed', {
        display: 'system'
      });
    } else if (e.key === 'left' && onBack) {
      e.preventDefault();
      onBack();
    } else if (e.key === 't' && !isTeleporting) {
      e.preventDefault();
      void handleTeleport();
    } else if (e.key === 'return') {
      e.preventDefault();
      handleClose();
    }
  };

  // Handle teleporting to remote session
  async function handleTeleport(): Promise<void> {
    setIsTeleporting(true);
    setTeleportError(null);
    try {
      await teleportResumeCodeSession(session.sessionId);
    } catch (err) {
      setTeleportError(errorMessage(err));
    } finally {
      setIsTeleporting(false);
    }
  }

  // Truncate title if too long (for display purposes)
  const displayTitle = truncateToWidth(session.title, 50);

  // Map TaskStatus to display status (handle 'pending')
  const displayStatus = session.status === 'pending' ? 'starting' : session.status;
  return <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Dialog title="Remote session details" onCancel={handleClose} color="background" inputGuide={exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>
              {onBack && <KeyboardShortcutHint shortcut="←" action="go back" />}
              <KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />
              {!isTeleporting && <KeyboardShortcutHint shortcut="t" action="teleport" />}
            </Byline>}>
        <Box flexDirection="column">
          <Text>
            <Text bold>Status</Text>:{' '}
            {displayStatus === 'running' || displayStatus === 'starting' ? <Text color="background">{displayStatus}</Text> : displayStatus === 'completed' ? <Text color="success">{displayStatus}</Text> : <Text color="error">{displayStatus}</Text>}
          </Text>
          <Text>
            <Text bold>Runtime</Text>:{' '}
            {formatDuration((session.endTime ?? Date.now()) - session.startTime)}
          </Text>
          <Text wrap="truncate-end">
            <Text bold>Title</Text>: {displayTitle}
          </Text>
          <Text>
            <Text bold>Progress</Text>:{' '}
            <RemoteSessionProgress session={session} />
          </Text>
          <Text>
            <Text bold>Session URL</Text>:{' '}
            <Link url={getRemoteTaskSessionUrl(session.sessionId)}>
              <Text dimColor>{getRemoteTaskSessionUrl(session.sessionId)}</Text>
            </Link>
          </Text>
        </Box>

        {/* Remote session messages section */}
        {session.log.length > 0 && <Box flexDirection="column" marginTop={1}>
            <Text>
              <Text bold>Recent messages</Text>:
            </Text>
            <Box flexDirection="column" height={10} overflowY="hidden">
              {lastMessages.map((msg, i) => <Message key={i} message={msg as React.ComponentProps<typeof Message>['message']} lookups={EMPTY_LOOKUPS} addMargin={i > 0} tools={toolUseContext.options.tools} commands={toolUseContext.options.commands} verbose={toolUseContext.options.verbose} inProgressToolUseIDs={new Set()} progressMessagesForMessage={[]} shouldAnimate={false} shouldShowDot={false} style="condensed" isTranscriptMode={false} isStatic={true} />)}
            </Box>
            <Box marginTop={1}>
              <Text dimColor italic>
                Showing last {lastMessages.length} of {session.log.length}{' '}
                messages
              </Text>
            </Box>
          </Box>}

        {/* Teleport error message */}
        {teleportError && <Box marginTop={1}>
            <Text color="error">Teleport failed: {teleportError}</Text>
          </Box>}

        {/* Teleporting status */}
        {isTeleporting && <Text color="background">Teleporting to session…</Text>}
      </Dialog>
    </Box>;
}
