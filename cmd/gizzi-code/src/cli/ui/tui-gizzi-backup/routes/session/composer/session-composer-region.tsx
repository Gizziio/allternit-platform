import { Show } from "solid-js"
import { Prompt, type PromptRef } from "@/cli/ui/tui/component/prompt"
import type { PromptInfo } from "@/cli/ui/tui/component/prompt/history"
import { SessionMount } from "@/cli/ui/tui/component/session-mount"
import { createComposerState } from "./session-composer-state"
import { PermissionPrompt } from "./session-permission-dock"
import { QuestionPrompt } from "./session-question-dock"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRequest = any

interface SessionComposerRegionProps {
  permissions: () => AnyRequest[]
  questions: () => AnyRequest[]
  // SessionMount
  isHeightConstrained: boolean
  activeTools?: string[]
  sessionStatus?: "idle" | "thinking" | "executing" | "responding" | "compacting"
  sessionElapsedSeconds?: number
  sessionTokens?: number
  thoughtSeconds?: number
  lastRunMs?: number
  todos?: Array<{ content: string; status: string }>
  // Prompt
  sessionID: string
  /** True when this is a child session (prompt is hidden). */
  isChildSession: boolean
  onPromptMount: (ref: PromptRef) => void
  onPromptSubmit: () => void
  initialPrompt?: PromptInfo
}

/**
 * SessionComposerRegion — the bottom-of-session dock area.
 *
 * Orchestrates blocker mode (permission / question) vs. normal prompt mode.
 * Owns the relative stacking: blocker → SessionMount → Prompt.
 */
export function SessionComposerRegion(props: SessionComposerRegionProps) {
  const { blocked, permissionRequest, questionRequest } = createComposerState(
    props.permissions,
    props.questions,
  )

  return (
    <box flexShrink={0}>
      <Show when={permissionRequest()}>
        {(request) => <PermissionPrompt request={request()} />}
      </Show>
      <Show when={questionRequest()}>
        {(request) => <QuestionPrompt request={request()} />}
      </Show>
      <SessionMount
        isHeightConstrained={props.isHeightConstrained}
        activeTools={props.activeTools}
        sessionStatus={props.sessionStatus}
        sessionElapsedSeconds={props.sessionElapsedSeconds}
        sessionTokens={props.sessionTokens}
        thoughtSeconds={props.thoughtSeconds}
        lastRunMs={props.lastRunMs}
        todos={props.todos}
      />
      <Prompt
        visible={!props.isChildSession && !blocked()}
        ref={(r) => {
          props.onPromptMount(r)
          if (props.initialPrompt) {
            r.set(props.initialPrompt)
          }
        }}
        disabled={blocked()}
        onSubmit={props.onPromptSubmit}
        sessionID={props.sessionID}
      />
    </box>
  )
}
