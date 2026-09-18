import type {
  AttachmentMessage,
  MessageAttachment,
  RenderableMessage,
} from '../types/message.js'

// TODO(types): message.ts MessageAttachment does not declare the task_status
// payload fields or the teammate_shutdown_batch count field
interface TaskStatusAttachment extends MessageAttachment {
  type: 'task_status'
  taskType?: string
  status?: string
}

interface TeammateShutdownBatchAttachment extends MessageAttachment {
  type: 'teammate_shutdown_batch'
  count: number
}

type TeammateShutdownMessage = RenderableMessage &
  AttachmentMessage<TaskStatusAttachment>

function isTeammateShutdownAttachment(
  msg: RenderableMessage,
): msg is TeammateShutdownMessage {
  const m = msg as TeammateShutdownMessage
  return (
    m.type === 'attachment' &&
    m.attachment.type === 'task_status' &&
    m.attachment.taskType === 'in_process_teammate' &&
    m.attachment.status === 'completed'
  )
}

/**
 * Collapses consecutive in-process teammate shutdown task_status attachments
 * into a single `teammate_shutdown_batch` attachment with a count.
 */
export function collapseTeammateShutdowns(
  messages: RenderableMessage[],
): RenderableMessage[] {
  const result: RenderableMessage[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!
    if (isTeammateShutdownAttachment(msg)) {
      let count = 0
      while (
        i < messages.length &&
        isTeammateShutdownAttachment(messages[i]!)
      ) {
        count++
        i++
      }
      if (count === 1) {
        result.push(msg)
      } else {
        result.push({
          type: 'attachment',
          uuid: msg.uuid,
          timestamp: msg.timestamp,
          attachment: {
            type: 'teammate_shutdown_batch',
            count,
          } as TeammateShutdownBatchAttachment,
          // TODO(types): the synthesized batch entry is a RenderableMessage at
          // runtime (isRenderable carried by the render pipeline) — cast only
        } as unknown as RenderableMessage)
      }
    } else {
      result.push(msg)
      i++
    }
  }

  return result
}
