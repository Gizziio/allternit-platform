// =============================================================================
// @allternit/replies-contract — Canonical type contract for the A2R Replies API
//
// Public primitive:  Reply
// Internal primitive: Run (id convention: `run_${replyId}`)
// Continuity:        Conversation (id = gizzi sessionId)
// Output union:      ReplyItem
// Wire events:       ReplyEvent (SSE + reducer input)
//
// Provider-specific types (AnthropicStreamChunk, GizziBusEvent, etc.) must
// never appear in this package. This is pure TypeScript with zero deps.
// =============================================================================
export {};
