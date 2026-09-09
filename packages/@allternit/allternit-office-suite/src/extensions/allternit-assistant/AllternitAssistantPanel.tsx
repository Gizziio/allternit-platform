import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useOfficeAi } from '../../bridge/OfficeHostContext';
import type {
  OfficeAgentLoop,
  OfficeAppKey,
  OfficeExtensionContext,
  OfficeModelOption,
} from '../../bridge/types';
import { getActiveDocument, useActiveDocument } from '../activeDocument';
import { onAssistantPreset } from '../assistantPreset';
import { AllternitBrandMark } from '../../components/AllternitBrandMark';
import './AllternitAssistantPanel.css';

const APP_LABELS: Record<OfficeAppKey, string> = {
  docs: 'Docs',
  sheets: 'Sheets',
  slides: 'Slides',
  pdf: 'PDF',
};

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

/** Cap on document text embedded into the assistant's context per run. */
const DOCUMENT_CONTEXT_MAX_CHARS = 4000;

/**
 * Context block sent with every assistant run: the open document's name plus a
 * bounded plain-text excerpt when the app reports one. Reads the registry at
 * call time so runs always see the current document, never a mount snapshot.
 */
export function buildAssistantContext(appKey: OfficeAppKey, appLabel: string): string {
  const doc = getActiveDocument(appKey);
  if (!doc) return `No document is currently open in Allternit ${appLabel}.`;
  let context = `The user currently has "${doc.name}" open in Allternit ${appLabel}.`;
  try {
    const content = doc.content?.() ?? null;
    const text = content?.trim();
    if (text) {
      const excerpt = text.length > DOCUMENT_CONTEXT_MAX_CHARS
        ? `${text.slice(0, DOCUMENT_CONTEXT_MAX_CHARS)}\n…(truncated)`
        : text;
      context += `\n\nCurrent document content:\n${excerpt}`;
    }
  } catch {
    /* content is best-effort */
  }
  return context;
}

/**
 * First-party "Allternit Office Agent" extension panel.
 *
 * Deliberately mirrors the built-in panels' wiring: it consumes the host AI
 * client through `useOfficeAi()` (inheriting whatever the embedding host
 * provides), streams through the host's AgentLoop, and persists the model
 * choice through the host's per-app model override. The only context it takes
 * from the surrounding app is the open document — name plus a text excerpt —
 * via the module-level active-document registry. Ribbon AI actions
 * (Summarize / Polish / …) arrive through the assistantPreset bus and run
 * through the same path as a typed message.
 */
export function AllternitAssistantPanel({ ctx }: { ctx: OfficeExtensionContext }): ReactNode {
  const ai = useOfficeAi();
  const appKey = ctx.appKey;
  const appLabel = APP_LABELS[appKey] ?? appKey;
  const docInfo = useActiveDocument(appKey);
  const docName = docInfo?.name ?? null;
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelId, setModelId] = useState<string | undefined>(() => ai.resolveModelId(appKey));
  const chatRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const onChatScroll = (): void => {
    const el = chatRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    const el = chatRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const loopRef = useRef<OfficeAgentLoop | null>(null);
  if (!loopRef.current) {
    loopRef.current = new ai.AgentLoop({
      modelId,
      skill: {
        systemPrompt:
          `You are the Allternit Office Agent, embedded in the Allternit ${appLabel} app as a ` +
          'first-class extension. Help the user with their work in this app: answer questions, ' +
          'explain concepts, draft and refine content. Be concise and concrete.',
        buildContext: () => buildAssistantContext(appKey, appLabel),
      },
      events: {
        onText: (text) => {
          setChat((previous) => {
            const next = [...previous];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, text, streaming: false };
            } else {
              next.push({ role: 'assistant', text });
            }
            return next;
          });
        },
        onDone: () => setBusy(false),
        onError: (error) => {
          setBusy(false);
          setChat((previous) => [...previous, { role: 'assistant', text: `⚠ ${error}` }]);
        },
      },
    });
  }

  const run = useCallback(
    (instruction: string) => {
      const trimmed = instruction.trim();
      if (!trimmed || busy) return;
      stickToBottomRef.current = true;
      setChat((previous) => [...previous, { role: 'user', text: trimmed }]);
      setPrompt('');
      setBusy(true);
      loopRef.current!.run(trimmed);
    },
    [busy],
  );

  const reset = useCallback(() => {
    loopRef.current?.reset();
    setChat([]);
    setPrompt('');
  }, []);

  // Ribbon AI actions (Summarize / Polish / context-menu presets) submit
  // through the assistantPreset bus; run them exactly like a typed message.
  useEffect(() => {
    return onAssistantPreset(({ appKey: targetApp, instruction }) => {
      if (targetApp !== appKey) return;
      run(instruction);
    });
  }, [appKey, run]);

  return (
    <div className="aos-assistant">
      <header className="aos-assistant-header">
        <span className="aos-assistant-title">
          <AllternitBrandMark size={14} />
          Allternit Office Agent
        </span>
        <div className="aos-assistant-header-actions">
          <AssistantModelPicker
            value={modelId}
            onChange={(next) => {
              setModelId(next);
              ai.setModelOverride(appKey, next);
              loopRef.current?.setModelId(next);
            }}
          />
          {chat.length > 0 && (
            <button
              type="button"
              className="aos-assistant-icon-btn"
              title="New chat"
              onClick={reset}
            >
              ↺
            </button>
          )}
          {ctx.close && (
            <button
              type="button"
              className="aos-assistant-icon-btn"
              title="Close panel"
              onClick={ctx.close}
            >
              ✕
            </button>
          )}
        </div>
      </header>
      <div className="aos-assistant-context">
        {docName ? (
          <span className="aos-assistant-doc" title={docName}>
            📄 {docName}
          </span>
        ) : (
          <span className="aos-assistant-doc aos-assistant-doc-none">
            Allternit {appLabel} — no document open
          </span>
        )}
      </div>
      <div className="aos-assistant-chat" ref={chatRef} onScroll={onChatScroll}>
        {chat.length === 0 ? (
          <div className="aos-assistant-empty">
            <div className="aos-assistant-empty-title">Ask the Allternit Office Agent</div>
            <div className="aos-assistant-empty-body">
              {docName
                ? `Chat with context on "${docName}".`
                : 'Open a document to give the assistant context, or ask anything.'}
            </div>
          </div>
        ) : (
          chat.map((entry, index) => (
            <div key={index} className={`aos-assistant-msg aos-assistant-msg-${entry.role}`}>
              <div className="aos-assistant-msg-text" style={{ whiteSpace: 'pre-wrap' }}>
                {entry.text}
                {entry.streaming ? '…' : ''}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="aos-assistant-typing">
            <span className="aos-assistant-typing-dots">●</span> Thinking…
          </div>
        )}
      </div>
      <div className="aos-assistant-composer">
        <textarea
          value={prompt}
          placeholder={`Ask about this ${appLabel.toLowerCase()}…`}
          aria-label="Assistant instruction"
          rows={2}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              run(prompt);
            }
          }}
        />
        <div className="aos-assistant-composer-footer">
          <span className="aos-assistant-hint">Enter to send · Shift+Enter for newline</span>
          {busy ? (
            <button
              type="button"
              className="aos-assistant-send aos-assistant-stop"
              aria-label="Stop"
              onClick={() => loopRef.current?.cancel()}
            >
              ■
            </button>
          ) : (
            <button
              type="button"
              className="aos-assistant-send"
              aria-label="Send"
              disabled={!prompt.trim()}
              onClick={() => run(prompt)}
            >
              ↵
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantModelPicker({
  value,
  onChange,
}: {
  value?: string | undefined;
  onChange?: (modelId: string | undefined) => void;
}): ReactNode {
  const ai = useOfficeAi();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OfficeModelOption[]>(() => ai.getModelOptions());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    ai
      .refreshModelOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ai]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selected =
    options.find((o) => o.id === (value ?? 'platform')) ??
    options.find((o) => o.runtimeId === value) ??
    options[0];

  return (
    <div className="aos-assistant-model-picker" ref={menuRef}>
      <button
        type="button"
        className="aos-assistant-model-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="aos-assistant-model-picker-label">{selected?.label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="aos-assistant-model-picker-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === selected?.id}
              className={
                o.id === selected?.id
                  ? 'aos-assistant-model-picker-option active'
                  : 'aos-assistant-model-picker-option'
              }
              onClick={() => {
                onChange?.(o.id === 'platform' ? undefined : o.id);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.provider && <span className="aos-assistant-model-picker-provider">{o.provider}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
