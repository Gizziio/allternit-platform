export function messageQueueTypes_ts(): void {
  // Not yet implemented
}

export default messageQueueTypes_ts

// ink-app queue-operation wire format. Differs from src/types/messageQueueTypes.ts
// (shared surface uses 'queue_operation' + numeric timestamps); the ink-app
// sessionStorage reader matches the hyphenated type and ISO timestamps below.
export type QueueOperation = 'enqueue' | 'dequeue' | 'remove' | 'popAll'

export interface QueueOperationMessage {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
}
