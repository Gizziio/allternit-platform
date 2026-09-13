-- Bot default model → Kimi (follow-up to PR #439 session/botdefault-0912 and
-- PR #443 session/botdefault2-0912).
--
-- Pre-#439 bot rows carry `model = 'openai/gpt-5-mini'` (the old agent-catalog
-- default), which desktop gizzi does not serve — any code path that still
-- reads the row's model (resolveModelRef for byok/subprocess/cloud harness in
-- surfaces/ai.allternit.com/src/lib/bots/bot-runtime-env.ts, reached from
-- group-chat turns and the no-picker send fallback; and the server-side
-- parse_model_ref fallback in gizzi_chat_stream.rs when no runtimeModelId is
-- supplied) forwards it to gizzi and fails with ProviderModelNotFoundError.
-- #439/#443 removed the *primary* UI fallbacks but not these row readers.
--
-- Repoint exactly the retired default value on bot rows to what defineAgent
-- writes for new rows today: model 'kimi/kimi-for-coding', provider 'custom'
-- (getDefaultAgentModel() in src/lib/agents/agent-models.ts, synthesized
-- because the virtual kimi id is absent from the gateway registry).
--
-- Scoped to is_bot = 1: non-bot agents may have been deliberately configured
-- with openai/gpt-5-mini against a gateway that does serve it.
--
-- IRREVERSIBLE: a down migration cannot distinguish these rows from rows
-- legitimately created with the Kimi default after this migration, so no
-- down-migration is provided.
UPDATE agents
SET model = 'kimi/kimi-for-coding',
    provider = 'custom'
WHERE is_bot = 1
  AND model = 'openai/gpt-5-mini';
