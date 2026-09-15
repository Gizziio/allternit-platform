# Resolve the ai.allternit.com workspace UI (private Gizziio/allternit-ai).
# Not the cloud console (platform.allternit.com).
#
# Usage:  HOSTED_UI="$(. scripts/hosted-ui.sh; resolve_hosted_ui "$REPO_ROOT")"
# Env:    ALLTERNIT_AI_PATH  — explicit checkout

resolve_hosted_ui() {
  local root="${1:?repo root}"
  if [ -n "${ALLTERNIT_AI_PATH:-}" ] && [ -f "${ALLTERNIT_AI_PATH}/package.json" ]; then
    (cd "$ALLTERNIT_AI_PATH" && pwd)
    return 0
  fi
  local c
  for c in \
    "$root/.hosted-ui" \
    "$root/../allternit-ai" \
    "$root/surfaces/ai.allternit.com"
  do
    if [ -f "$c/package.json" ]; then
      (cd "$c" && pwd)
      return 0
    fi
  done
  echo "ai.allternit.com UI not found." >&2
  echo "Clone Gizziio/allternit-ai next to this repo, or set ALLTERNIT_AI_PATH." >&2
  echo "Do not use surfaces/platform.allternit.com — that is the cloud console." >&2
  return 1
}

link_oss_platform() {
  local hosted="${1:?hosted ui dir}"
  local oss="${2:?oss platform repo root}"
  ln -sfn "$oss" "$hosted/.oss-platform"
}
