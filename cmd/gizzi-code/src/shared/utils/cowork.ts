/**
 * Cowork utility - shared state management for collaborative sessions
 * Manages the state of multi-user collaborative coding sessions
 */

export interface CoworkState {
  enabled: boolean
  sessionId: string | null
  participants: CoworkParticipant[]
  hostId: string
  permissions: CoworkPermissions
}

export interface CoworkParticipant {
  id: string
  name: string
  role: 'host' | 'editor' | 'viewer'
  connectedAt: Date
  lastActiveAt: Date
  cursorPosition?: { line: number; column: number }
}

export interface CoworkPermissions {
  canEdit: boolean
  canExecute: boolean
  canInvite: boolean
  canKick: boolean
}

const DEFAULT_STATE: CoworkState = {
  enabled: false,
  sessionId: null,
  participants: [],
  hostId: '',
  permissions: {
    canEdit: true,
    canExecute: false,
    canInvite: false,
    canKick: false,
  },
}

let state: CoworkState = { ...DEFAULT_STATE }
const listeners = new Set<(state: CoworkState) => void>()

export function getCoworkState(): CoworkState {
  return state
}

export function setCoworkState(newState: Partial<CoworkState>): void {
  state = { ...state, ...newState }
  notifyListeners()
}

export function subscribeToCoworkState(listener: (state: CoworkState) => void): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener(state)
    } catch {
      // Ignore listener errors
    }
  }
}

export function addParticipant(participant: CoworkParticipant): void {
  state = {
    ...state,
    participants: [...state.participants, participant],
  }
  notifyListeners()
}

export function removeParticipant(id: string): void {
  state = {
    ...state,
    participants: state.participants.filter((p) => p.id !== id),
  }
  notifyListeners()
}

export function isCoworkEnabled(): boolean {
  return state.enabled
}

export function isHost(): boolean {
  return state.participants.some((p) => p.id === state.hostId && p.role === 'host')
}
