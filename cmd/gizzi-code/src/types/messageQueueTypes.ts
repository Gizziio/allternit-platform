/**
 * Message queue types
 */

export interface MessageQueueItem {
  id: string
  priority: number
  data: unknown
}

export interface QueueOperation {
  type: 'enqueue' | 'dequeue' | 'peek'
  queueName: string
  item?: MessageQueueItem
}

export interface QueueOperationMessage {
  type: 'queue_operation'
  operation: QueueOperation
  timestamp: number
}
