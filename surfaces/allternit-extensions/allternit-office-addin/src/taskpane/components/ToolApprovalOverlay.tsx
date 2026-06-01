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
    <div className="absolute inset-0 z-50 flex items-end justify-center p-4 bg-black/45 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
            <AlertTriangle size={14} className="text-[var(--accent-primary)]" />
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

        <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5 font-mono text-xs text-[var(--text-secondary)] leading-relaxed break-words">
          <div className="text-[var(--accent-primary)] font-semibold mb-1">{current.name}</div>
          <pre className="m-0 whitespace-pre-wrap text-[var(--text-tertiary)]">
            {formatToolArgs(current.arguments)}
          </pre>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => onReject(current.id)}
            className="flex-1 py-2 rounded-lg border border-[var(--border-default)] bg-transparent text-[var(--text-tertiary)] text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1.5 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={14} />
            Reject
          </button>
          <button
            onClick={() => onApprove(current.id)}
            className="flex-1 py-2 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--text-inverse)] text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-110 transition-all"
          >
            <Check size={14} />
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
