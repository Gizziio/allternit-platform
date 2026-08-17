/**
 * Minimal stand-ins for the @genoffice/ui components used by the AI panel
 * (AiComposer, AiTypingIndicator, Markdown). Same props; no Genspark styling.
 */
import { forwardRef } from 'react'
import type { ReactNode, TextareaHTMLAttributes } from 'react'

export function Markdown({ text }: { text: string }) {
  // Plain-text rendering: safe and sufficient until the Allternit AI panel
  // replaces the vendored one.
  return <div className="ai-markdown" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
}

export function AiTypingIndicator({ label }: { label?: string }) {
  return <span className="ai-typing-indicator">{label ?? '…'}</span>
}

interface AiComposerProps {
  value: string
  busy?: boolean
  placeholder?: string
  hintIdle?: string
  hintBusy?: string
  hintIdleTitle?: string
  sendLabel?: string
  stopLabel?: string
  ariaLabel?: string
  iconOnly?: boolean
  sendIconEnabled?: ReactNode
  sendIconDisabled?: ReactNode
  stopIcon?: ReactNode
  footerStart?: ReactNode
  textareaRef?: React.Ref<HTMLTextAreaElement>
  onChange: (value: string) => void
  onSend: () => void
  onStop?: () => void
  onPasteFiles?: (files: File[]) => void
}

export const AiComposer = forwardRef<HTMLTextAreaElement, AiComposerProps>(function AiComposer(
  props,
  forwardedRef,
) {
  const textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {
    value: props.value,
    placeholder: props.placeholder,
    'aria-label': props.ariaLabel,
    onChange: (e) => props.onChange(e.target.value),
    onKeyDown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!props.busy) props.onSend()
      }
    },
  }

  const hint = props.busy ? props.hintBusy : props.hintIdle
  const canSend = !props.busy && props.value.trim().length > 0

  return (
    <div className="ai-input-box">
      <textarea ref={props.textareaRef ?? forwardedRef} {...textareaProps} />
      <div className="ai-input-footer">
        {props.footerStart}
        {hint ? (
          <span className="ai-input-hint" title={props.busy ? undefined : props.hintIdleTitle}>
            {hint}
          </span>
        ) : null}
        {props.busy ? (
          <button
            className="ai-send-btn ai-stop-btn"
            onClick={props.onStop}
            aria-label={props.stopLabel}
            type="button"
          >
            {props.stopIcon ?? props.stopLabel ?? 'Stop'}
          </button>
        ) : (
          <button
            className="ai-send-btn"
            onClick={props.onSend}
            aria-label={props.sendLabel}
            disabled={!canSend}
            type="button"
          >
            {canSend
              ? (props.sendIconEnabled ?? props.sendLabel ?? 'Send')
              : (props.sendIconDisabled ?? props.sendIconEnabled ?? props.sendLabel ?? 'Send')}
          </button>
        )}
      </div>
    </div>
  )
})
