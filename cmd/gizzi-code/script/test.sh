#!/usr/bin/env bash
set -euo pipefail

# Isolated test harness for gizzi-code.
# Creates temp XDG/data dirs and sets env vars BEFORE bun imports any src/
# modules, so xdg-basedir and GlobalPaths pick up the isolated paths.

TEST_DATA_DIR="$(mktemp -d /tmp/gizzi-test-data.XXXXXX)"
export XDG_DATA_HOME="${TEST_DATA_DIR}/share"
export XDG_CACHE_HOME="${TEST_DATA_DIR}/cache"
export XDG_CONFIG_HOME="${TEST_DATA_DIR}/config"
export XDG_STATE_HOME="${TEST_DATA_DIR}/state"

export GIZZI_TEST_HOME="$(mktemp -d /tmp/gizzi-home.XXXXXX)"
export GIZZI_TEST_AUTH_PATH="$(mktemp /tmp/gizzi-auth.XXXXXX)"
export GIZZI_TEST_MANAGED_CONFIG_DIR="${TEST_DATA_DIR}/managed"
echo '{}' > "$GIZZI_TEST_AUTH_PATH"

mkdir -p "$XDG_DATA_HOME" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_STATE_HOME" "$GIZZI_TEST_MANAGED_CONFIG_DIR"

# Pre-create log directory to prevent ENOENT when starting logger.
mkdir -p "${XDG_DATA_HOME}/gizzi-code/log"

# Write the cache version file to prevent global/index.ts from clearing the cache.
mkdir -p "${XDG_CACHE_HOME}/gizzi-code"
echo '21' > "${XDG_CACHE_HOME}/gizzi-code/version"

# Point models.dev at the test fixture and disable network fetches/discovery.
export GIZZI_MODELS_PATH="test/tool/fixtures/models-api.json"
export GIZZI_DISABLE_MODELS_FETCH=1
export GIZZI_DISABLE_PROVIDER_DISCOVERY=1

# Disable sidecar/durable trace noise for speed; durable-trace tests re-enable it.
export ALLTERNIT_SIDECAR_DISABLED=1
export GIZZI_DISABLE_DURABLE_TRACE=1
export GIZZI_TEST_ISOLATED_CONFIG=1

# Clear provider env vars so tests control them explicitly.
unset ANTHROPIC_API_KEY OPENAI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY
unset AZURE_OPENAI_API_KEY AWS_ACCESS_KEY_ID AWS_PROFILE AWS_REGION
unset AWS_BEARER_TOKEN_BEDROCK OPENROUTER_API_KEY GROQ_API_KEY MISTRAL_API_KEY
unset PERPLEXITY_API_KEY TOGETHER_API_KEY XAI_API_KEY DEEPSEEK_API_KEY
unset FIREWORKS_API_KEY CEREBRAS_API_KEY SAMBANOVA_API_KEY

cleanup() {
  rm -rf "$TEST_DATA_DIR" "$GIZZI_TEST_HOME" "$GIZZI_TEST_AUTH_PATH"
}
trap cleanup EXIT

exec bun test --preload ./test/preload.ts --isolate --timeout 30000 "$@"
