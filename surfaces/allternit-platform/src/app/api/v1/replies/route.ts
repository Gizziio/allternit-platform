/**
 * POST /v1/replies
 *
 * Canonical Replies API — Anthropic/OpenAI-aligned surface.
 *
 * Creates a new Reply and streams ReplyEvents as SSE (default).
 * When stream=false, waits for completion and returns the full Reply object.
 *
 * Request body:
 *   conversation_id  string   — maps to chatId in the agent-chat backend
 *   message          string   — user message text
 *   model?           string   — "provider/model" slug (e.g. "claude/claude-sonnet-4-6")
 *   runtime_model?   string   — override model resolved by the runtime backend
 *   gateway_url?     string   — explicit gateway URL (bypasses resolution)
 *   gateway_token?   string   — gateway auth token
 *   stream?          boolean  — default true; false returns a complete Reply JSON
 *
 * Response (stream=true):  text/event-stream, each line: data: <ReplyEvent JSON>
 * Response (stream=false): application/json Reply object
 */

export { POST } from "../../agent-chat/v1-replies-handler";
