'use client';

import React, { useRef, useState } from 'react';
import {
  Plus,
  CaretDown,
  Check,
  Image,
  Folder,
  Plugs,
  PuzzlePiece,
  Command,
  GithubLogo,
  LockSimple,
} from '@phosphor-icons/react';
import { CODE_SESSION_MODE_LABELS } from './CodeWorkspaceBar';
import type { CodeSessionMode } from './CodeModeStore';
import type { ChatAttachment } from '../chat/ChatComposer';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface CodeBottomStatusBarProps {
  sessionMode: CodeSessionMode;
  onSessionModeChange: (mode: CodeSessionMode) => void;
  selectedModelDisplayName: string;
  onAddAttachment?: (attachment: ChatAttachment) => void;
  metadata?: React.ReactNode;
}

const BORDER = 'rgba(255, 255, 255, 0.08)';
const PILL_BG = 'rgba(255, 255, 255, 0.03)';
const PILL_HOVER_BG = 'rgba(255, 255, 255, 0.07)';
const TEXT_PRIMARY = 'var(--text-primary)';
const TEXT_SECONDARY = 'var(--text-secondary)';

const MODE_ITEMS: { id: CodeSessionMode; label: string; index: number }[] = [
  { id: 'SAFE', label: 'Manual', index: 1 },
  { id: 'DEFAULT', label: 'Accept edits', index: 2 },
  { id: 'PLAN', label: 'Plan', index: 3 },
  { id: 'AUTO', label: 'Auto', index: 4 },
];

const PLUS_ITEMS: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
  disabled?: boolean;
}> = [
  { id: 'files', label: 'Add files or photos', icon: <Image size={16} /> },
  { id: 'folder', label: 'Add folder', icon: <Folder size={16} /> },
  { id: 'github', label: 'Import GitHub issue', icon: <GithubLogo size={16} /> },
  { id: 'slash', label: 'Slash commands', icon: <Command size={16} /> },
  { id: 'connectors', label: 'Connectors', icon: <Plugs size={16} />, hasSubmenu: true },
  { id: 'plugins', label: 'Plugins', icon: <PuzzlePiece size={16} />, hasSubmenu: true },
];

export function CodeBottomStatusBar({
  sessionMode,
  onSessionModeChange,
  selectedModelDisplayName,
  onAddAttachment,
  metadata,
}: CodeBottomStatusBarProps): React.ReactNode {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !onAddAttachment) return;
    await Promise.all(
      Array.from(files).map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        onAddAttachment({
          id: `code-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          dataUrl,
          type: extToAttachmentType(file.name),
        });
      }),
    );
  };

  const handleAddFolder = async () => {
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        // eslint-disable-next-line no-console
        console.log('[CodeBottomStatusBar] Opened folder:', dirHandle?.name ?? '');
      }
    } catch {
      // User cancelled or picker unavailable.
    }
  };

  return (
    <div
      data-testid="code-bottom-status-bar"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <ModeSelector sessionMode={sessionMode} onChange={onSessionModeChange} />
        <PlusMenu
          onAddFiles={() => fileInputRef.current?.click()}
          onAddFolder={handleAddFolder}
        />
        {metadata ? (
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>{metadata}</div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <ModelPill label={selectedModelDisplayName} />
        <ModelPill label="High" />
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function extToAttachmentType(filename: string): ChatAttachment['type'] {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'document';
  if (['docx', 'doc', 'txt', 'md'].includes(ext)) return 'document';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) return 'code';
  if (['json'].includes(ext)) return 'json';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
  return 'other';
}

function ModeSelector({
  sessionMode,
  onChange,
}: {
  sessionMode: CodeSessionMode;
  onChange: (mode: CodeSessionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = CODE_SESSION_MODE_LABELS[sessionMode];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="code-bottom-status-mode"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: TEXT_SECONDARY,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span>{activeLabel}</span>
          <CaretDown size={12} style={{ opacity: 0.7 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-56 p-2 rounded-xl border bg-popover shadow-xl"
        style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
      >
        <div
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--ui-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Mode
        </div>
        {MODE_ITEMS.map((item) => {
          const active = item.id === sessionMode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 8,
                border: 'none',
                background: active ? PILL_HOVER_BG : 'transparent',
                color: TEXT_PRIMARY,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = PILL_BG;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>{item.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {active ? <Check size={14} style={{ color: 'var(--accent-primary)' }} /> : null}
                <span style={{ color: 'var(--ui-text-muted)', fontSize: 12, minWidth: 16, textAlign: 'right' }}>
                  {item.index}
                </span>
              </div>
            </button>
          );
        })}
        <DropdownDivider />
        <button
          type="button"
          disabled
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--ui-text-muted)',
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'left',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <span>Bypass permissions</span>
          <span style={{ fontSize: 11 }}>Enable</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

function PlusMenu({
  onAddFiles,
  onAddFolder,
}: {
  onAddFiles: () => void;
  onAddFolder?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="code-bottom-status-plus"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 7,
            border: `1px solid ${BORDER}`,
            background: PILL_BG,
            color: TEXT_SECONDARY,
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = PILL_HOVER_BG;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = PILL_BG;
          }}
        >
          <Plus size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-60 p-2 rounded-xl border bg-popover shadow-xl"
        style={{ background: 'var(--surface-floating)', borderColor: BORDER }}
      >
        {PLUS_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.id === 'files') onAddFiles();
              if (item.id === 'folder') onAddFolder?.();
              setOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: item.disabled ? 'var(--ui-text-muted)' : TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.6 : 1,
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = PILL_BG;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.75 }}>
              {item.icon}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.hasSubmenu ? (
              <span style={{ color: 'var(--ui-text-muted)', fontSize: 11 }}>›</span>
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ModelPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${BORDER}`,
        background: PILL_BG,
        color: TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <LockSimple size={10} style={{ opacity: 0.5 }} />
      <span>{label}</span>
    </div>
  );
}

function DropdownDivider() {
  return (
    <div
      style={{
        height: 1,
        margin: '4px 8px',
        background: BORDER,
      }}
    />
  );
}
