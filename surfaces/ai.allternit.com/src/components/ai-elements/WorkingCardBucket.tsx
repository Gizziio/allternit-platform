"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  CaretDown,
  CheckCircle,
  XCircle,
  Circle,
  FileText,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// Display-only tool call — subset of the full ToolCall contract
export interface DisplayToolCall {
  id?: string;
  name: string;
  displayName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  arguments?: Record<string, unknown>;
  result?: unknown;
}

interface WorkingCardBucketProps {
  toolCalls: DisplayToolCall[];
  className?: string;
}

type BucketStatus = 'running' | 'done' | 'error';

function getBucketStatus(toolCalls: DisplayToolCall[]): BucketStatus {
  if (toolCalls.some((t) => t.status === 'error')) return 'error';
  if (toolCalls.some((t) => t.status === 'running' || t.status === 'pending')) return 'running';
  return 'done';
}

// Merge repeated edits to the same file into one row with a count badge
function consolidateTools(toolCalls: DisplayToolCall[]): Array<DisplayToolCall & { editCount: number }> {
  const seen = new Map<string, DisplayToolCall & { editCount: number }>();
  const order: string[] = [];

  for (const tc of toolCalls) {
    const filePath =
      typeof tc.arguments === 'object' && tc.arguments !== null
        ? String((tc.arguments as any).path ?? (tc.arguments as any).file_path ?? '')
        : '';

    if (
      filePath &&
      (tc.name === 'str_replace_editor' || tc.name === 'write_file' || tc.name?.includes('edit'))
    ) {
      if (seen.has(filePath)) {
        seen.get(filePath)!.editCount++;
        seen.get(filePath)!.status = tc.status;
      } else {
        seen.set(filePath, { ...tc, editCount: 1 });
        order.push(filePath);
      }
    } else {
      const key = `${tc.name}-${tc.id}`;
      seen.set(key, { ...tc, editCount: 0 });
      order.push(key);
    }
  }

  return order.map((k) => seen.get(k)!);
}

export function WorkingCardBucket({ toolCalls, className }: WorkingCardBucketProps) {
  const [isOpen, setIsOpen] = useState(false);
  const status = getBucketStatus(toolCalls);
  const consolidated = useMemo(() => consolidateTools(toolCalls), [toolCalls]);

  return (
    <div
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{
        borderColor:
          status === 'error'
            ? 'var(--status-error-bg)'
            : status === 'running'
              ? 'color-mix(in srgb, var(--accent-chat) 20%, var(--border-default))'
              : 'var(--border-subtle)',
        background: 'var(--surface-panel)',
        margin: '4px 0',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Status indicator */}
        <div style={{ position: 'relative', width: 16, height: 16, flexShrink: 0 }}>
          {status === 'running' ? (
            <>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'var(--accent-chat)',
                  opacity: 0.25,
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: '25%',
                  borderRadius: '50%',
                  background: 'var(--accent-chat)',
                }}
              />
            </>
          ) : status === 'error' ? (
            <XCircle size={16} color="var(--status-error)" weight="fill" />
          ) : (
            <CheckCircle size={16} color="var(--status-success)" weight="fill" />
          )}
        </div>

        <Wrench size={13} color="var(--text-tertiary)" />

        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {status === 'running'
            ? 'Working…'
            : status === 'error'
              ? 'Error in tool call'
              : `Done · ${consolidated.length} action${consolidated.length !== 1 ? 's' : ''}`}
        </span>

        <span
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}
        </span>

        <CaretDown
          size={12}
          color="var(--text-tertiary)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        />
      </button>

      {/* Expanded tool list */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                padding: '4px 0',
              }}
            >
              {consolidated.map((tc, i) => {
                const filePath =
                  typeof tc.arguments === 'object' && tc.arguments !== null
                    ? String((tc.arguments as any).path ?? (tc.arguments as any).file_path ?? '')
                    : '';
                const displayName = filePath
                  ? (filePath.split('/').pop() ?? filePath)
                  : (tc.displayName ?? tc.name);

                return (
                  <div
                    key={tc.id ?? i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 12px',
                    }}
                  >
                    <ToolStatusDot status={tc.status} />
                    {filePath && <FileText size={11} color="var(--text-tertiary)" />}
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayName}
                    </span>
                    {tc.editCount > 1 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          background: 'var(--surface-panel-muted)',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        ×{tc.editCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolStatusDot({ status }: { status: DisplayToolCall['status'] }) {
  if (status === 'running') {
    return (
      <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'var(--accent-chat)',
            opacity: 0.3,
            animation: 'ping 1s ease infinite',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: '20%',
            borderRadius: '50%',
            background: 'var(--accent-chat)',
          }}
        />
      </div>
    );
  }
  if (status === 'error') {
    return <XCircle size={8} color="var(--status-error)" weight="fill" />;
  }
  if (status === 'completed') {
    return <Circle size={8} color="var(--text-tertiary)" weight="fill" style={{ opacity: 0.5 }} />;
  }
  return <Circle size={8} color="var(--text-tertiary)" weight="regular" style={{ opacity: 0.3 }} />;
}
