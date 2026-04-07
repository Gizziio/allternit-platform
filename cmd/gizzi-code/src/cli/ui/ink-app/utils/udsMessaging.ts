/**
 * UDS messaging stub
 */

export interface UDSMessage {
  type: string
  payload: any
}
export function sendUDSMessage(_message: UDSMessage): void {
  // Stub implementation
export function receiveUDSMessage(): UDSMessage | null {
  return null
  }
}
