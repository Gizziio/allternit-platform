/**
 * Cowork Approval Dialog
 * 
 * Shows pending approvals from mobile/remote clients.
 */

import { Show, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useCoworkCollaboration } from "@/cli/ui/tui/context/cowork-collaboration"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { TextAttributes } from "@opentui/core"

export function DialogCoworkApprovals() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const collab = useCoworkCollaboration()
  
  const approvals = () => collab.pendingApprovals()
  
  const handleApproval = (id: string, approved: boolean) => {
    collab.respondToApproval(id, approved)
    
    // Close dialog if no more approvals
    if (approvals().length <= 1) {
      dialog.clear()
    }
  }
  
  return (
    <DialogSelect
      title={`Pending Approvals (${approvals().length})`}
      options={approvals().map(approval => ({
        title: approval.title,
        value: approval.id,
        description: approval.description || `From: ${approval.requester}`,
        onSelect: () => {
          // Show approval detail dialog
          dialog.replace(() => (
            <DialogApprovalDetail
              approval={approval}
              onApprove={() => handleApproval(approval.id, true)}
              onDeny={() => handleApproval(approval.id, false)}
            />
          ))
        },
      }))}
    />
  )
}

interface DialogApprovalDetailProps {
  approval: {
    id: string
    type: string
    title: string
    description?: string
    requester: string
    timestamp: number
  }
  onApprove: () => void
  onDeny: () => void
}

function DialogApprovalDetail(props: DialogApprovalDetailProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  
  const typeIcon = () => {
    switch (props.approval.type) {
      case "file_write": return "✎"
      case "bash_command": return "$"
      case "tool_execution": return "⚙"
      default: return "?"
    }
  }
  
  const typeColor = () => {
    switch (props.approval.type) {
      case "file_write": return theme.accent
      case "bash_command": return theme.info
      case "tool_execution": return theme.warning
      default: return theme.text
    }
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1} minWidth={60}>
      {/* Header */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={typeColor()} attributes={TextAttributes.BOLD}>
          {typeIcon()}
        </text>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {props.approval.title}
        </text>
      </box>
      
      {/* Description */}
      <Show when={props.approval.description}>
        <box paddingLeft={2}>
          <text fg={theme.textMuted}>{props.approval.description}</text>
        </box>
      </Show>
      
      {/* Requester info */}
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>Requested by:</text>
        <text fg={theme.text}>{props.approval.requester}</text>
      </box>
      
      {/* Actions */}
      <box flexDirection="row" gap={2} marginTop={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderColor={theme.success}
          backgroundColor={theme.success}
          onMouseUp={() => {
            props.onApprove()
            dialog.clear()
          }}
        >
          <text fg={theme.background}>✓ Approve</text>
        </box>
        
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderColor={theme.error}
          onMouseUp={() => {
            props.onDeny()
            dialog.clear()
          }}
        >
          <text fg={theme.error}>✗ Deny</text>
        </box>
        
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderColor={theme.border}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={theme.textMuted}>Cancel</text>
        </box>
      </box>
    </box>
  )
}

export function CoworkPendingApprovalBadge() {
  const { theme } = useTheme()
  const { hasPendingApprovals, pendingApprovals } = useCoworkCollaboration()
  const dialog = useDialog()
  
  return (
    <Show when={hasPendingApprovals()}>
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        borderStyle="single"
        borderColor={theme.warning}
        onMouseUp={() => dialog.replace(() => <DialogCoworkApprovals />)}
      >
        <text fg={theme.warning}>⚠</text>
        <text fg={theme.text}>
          {pendingApprovals().length} pending
        </text>
      </box>
    </Show>
  )
}
