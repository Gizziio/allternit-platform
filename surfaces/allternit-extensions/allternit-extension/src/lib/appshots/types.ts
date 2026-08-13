/**
 * Appshots — shareable, embeddable snapshots of AI agent sessions.
 *
 * Core type definitions for the Appshot feature.
 */

export interface Appshot {
	id: string
	title: string
	createdAt: string
	pageUrl: string
	pageTitle: string
	thumbnail?: string // base64 data URL
	capturedHtml: string // sanitized snapshot
	agentContext?: AgentSnapshot
	annotations: AppshotAnnotation[]
	shareUrl?: string
}

export interface AgentSnapshot {
	sessionId: string
	messages: CapturedMessage[]
	toolCalls: CapturedToolCall[]
	model: string
	totalTokens: number
}

export interface CapturedMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
	timestamp: string
}

export interface CapturedToolCall {
	name: string
	input: Record<string, unknown>
	output?: string
	timestamp: string
}

export interface AppshotAnnotation {
	id: string
	type: 'highlight' | 'note' | 'arrow'
	position: { x: number; y: number }
	text?: string
	color?: string
}

/** Messages exchanged between content script and background/sidepanel */
export type AppshotMessage =
	| { type: 'APPSHOT_CAPTURE_PAGE' }
	| { type: 'APPSHOT_CAPTURE_RESULT'; appshot: Appshot }
	| { type: 'APPSHOT_CAPTURE_ERROR'; error: string }
	| { type: 'APPSHOT_LIST' }
	| { type: 'APPSHOT_LIST_RESULT'; appshots: Appshot[] }
	| { type: 'APPSHOT_DELETE'; id: string }
	| { type: 'APPSHOT_DELETE_RESULT'; id: string }
