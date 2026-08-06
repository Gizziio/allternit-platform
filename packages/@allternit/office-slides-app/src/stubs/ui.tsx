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
  return (
    <div className="ai-composer">
      <textarea ref={props.textareaRef ?? forwardedRef} {...textareaProps} />
      <div className="ai-composer-footer">
        {props.footerStart}
        {props.busy ? (
          <button onClick={props.onStop} aria-label={props.stopLabel}>
            {props.stopIcon ?? props.stopLabel ?? 'Stop'}
          </button>
        ) : (
          <button onClick={props.onSend} aria-label={props.sendLabel} disabled={!props.value.trim()}>
            {props.sendIconEnabled ?? props.sendLabel ?? 'Send'}
          </button>
        )}
      </div>
    </div>
  )
})
