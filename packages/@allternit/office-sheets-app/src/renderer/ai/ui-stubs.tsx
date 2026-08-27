/**
 * Composer/presentational stand-ins for the @genoffice/ui components the
 * sheets AI panel uses (AiComposer, AiTypingIndicator, Markdown). The class
 * names match the vendored styles.css (`.ai-input-box`, `.ai-input-footer`,
 * `.ai-send-btn`, …) so the panel renders with the app's own composer skin.
 */
import { forwardRef } from 'react'
import type { ReactNode, TextareaHTMLAttributes } from 'react'

export function Markdown({ text }: { text: string }) {
  // Plain-text rendering until the Allternit markdown component is wired in.
  return <div className="ai-markdown" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
}

export function AiTypingIndicator({ label }: { label?: string }) {
  return (
    <span className="ai-typing">
      <span className="ai-typing-dots">
        <span className="ai-typing-dot-slot">
          <span className="ai-typing-dot-grow">●</span>
        </span>
      </span>
      {label ? <span className="ai-typing-label">{label}</span> : null}
    </span>
  )
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
    rows: 2,
    onChange: (e) => props.onChange(e.target.value),
    onKeyDown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!props.busy && props.value.trim()) props.onSend()
      }
    },
  }
  const hint = props.busy ? props.hintBusy : props.hintIdle
  return (
    <div className="ai-input-box">
      <textarea ref={props.textareaRef ?? forwardedRef} {...textareaProps} />
      <div className="ai-input-footer">
        {props.footerStart}
        {hint ? (
          <span className="ai-input-hint" title={props.hintIdleTitle}>
            {hint}
          </span>
        ) : null}
        {props.busy ? (
          <button
            className="ai-send-btn ai-stop-btn"
            onClick={props.onStop}
            aria-label={props.stopLabel}
            title={props.stopLabel}
          >
            {props.stopIcon ?? props.stopLabel ?? 'Stop'}
          </button>
        ) : (
          <button
            className="ai-send-btn"
            onClick={props.onSend}
            aria-label={props.sendLabel}
            title={props.sendLabel}
            disabled={!props.value.trim()}
          >
            {props.value.trim()
              ? (props.sendIconEnabled ?? props.sendLabel ?? 'Send')
              : (props.sendIconDisabled ?? props.sendIconEnabled ?? props.sendLabel ?? 'Send')}
          </button>
        )}
      </div>
    </div>
  )
})
