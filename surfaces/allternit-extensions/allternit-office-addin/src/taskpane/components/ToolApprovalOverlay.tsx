import { useMemo } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { PendingToolApproval } from '@/agent/useOfficeAgent'

interface Props {
  approvals: PendingToolApproval[]
  onApprove: (toolCallId: string) => void
  onReject: (toolCallId: string) => void
}

function formatToolArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 4)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 60)}`).join('\n')
}

export function ToolApprovalOverlay({ approvals, onApprove, onReject }: Props) {
  const current = approvals[0]

  if (!current) return null

  const hostLabel = useMemo(() => {
    if (current.name.startsWith('excel_')) return 'Excel'
    if (current.name.startsWith('word_')) return 'Word'
    if (current.name.startsWith('ppt_')) return 'PowerPoint'
    return 'Office'
  }, [current?.name])

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[rgba(41,32,26,0.35)] p-4 backdrop-blur-[2px]">
      <div className="card flex w-full max-w-[420px] flex-col gap-3 rounded-[var(--radius-2xl)] p-4 shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--bg-secondary)]">
            <AlertTriangle size={15} className="text-[var(--status-warning)]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
              Approve tool call
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {hostLabel} · {approvals.length > 1 ? `${approvals.length} pending` : '1 pending'}
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2.5 font-mono text-[11px] leading-relaxed break-words text-[var(--text-secondary)]">
          <div className="mb-1 font-semibold text-[var(--accent-brand)]">{current.name}</div>
          <pre className="m-0 whitespace-pre-wrap text-[var(--text-tertiary)]">
            {formatToolArgs(current.arguments)}
          </pre>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onReject(current.id)}
            className="btn btn-outline h-9 flex-1 text-[12.5px]"
          >
            <X className="size-3.5" />
            Reject
          </button>
          <button
            onClick={() => onApprove(current.id)}
            className="btn btn-primary h-9 flex-1 text-[12.5px]"
          >
            <Check className="size-3.5" />
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
