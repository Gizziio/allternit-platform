# Provider abstraction decision

Kimi Code's `packages/kosong` remains a useful protocol reference, but replacing Allternit's AI SDK boundary now would remove broader provider coverage and duplicate working model/credential integrations. The decision is therefore **do not consume `kosong` as a runtime dependency**.

Instead, Allternit keeps one normalization boundary in `runtime/providers/adapters/transform.ts` and treats the four cross-provider goldens in `test/provider/protocol-goldens.test.ts` as the replacement gate. Any future protocol implementation must preserve those Kimi, OpenAI Responses, Anthropic, and Google behaviors plus the existing provider transform/session-stream suites before it can replace the current boundary.

This is a reviewed architectural decision, not a permanent rejection: a future adapter may use `kosong` internally if it passes the same fixtures without changing the public provider/session contracts.
