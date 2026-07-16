# Allternit Hosted Runtime
# Runs the Gizzi brain + agent-daemon relay inside a Fly Machine.
# Build context: repository root

FROM oven/bun:1.2-debian AS builder

WORKDIR /app

# Install build deps for native modules.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy the hosted runtime's minimal workspace and package manifests first for
# deterministic dependency resolution without installing unrelated products.
COPY package.json pnpm-lock.yaml ./
COPY cmd/allternit-hosted-runtime/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY cmd/agent-daemon/package.json ./cmd/agent-daemon/
COPY cmd/gizzi-code/package.json ./cmd/gizzi-code/
COPY cmd/gizzi-code/packages/gizzi-util/package.json ./cmd/gizzi-code/packages/gizzi-util/
COPY cmd/gizzi-code/packages/plugin/package.json ./cmd/gizzi-code/packages/plugin/
COPY cmd/gizzi-code/packages/script/package.json ./cmd/gizzi-code/packages/script/
COPY cmd/gizzi-code/packages/sdk/package.json ./cmd/gizzi-code/packages/sdk/
COPY sdk/allternit-sdk/package.json ./sdk/allternit-sdk/
COPY packages/@allternit/request-scorer/package.json ./packages/@allternit/request-scorer/
COPY packages/@allternit/computer-use-protocol/package.json ./packages/@allternit/computer-use-protocol/
COPY packages/@allternit/util/package.json ./packages/@allternit/util/
COPY services/orchestration/control-plane/allternit-orchestrator/package.json ./services/orchestration/control-plane/allternit-orchestrator/
COPY domains/kernel/core/package.json ./domains/kernel/core/
COPY domains/governance/governor/package.json ./domains/governance/governor/
COPY infrastructure/chrome-stream/agent-systems/allternit-browser/package.json ./infrastructure/chrome-stream/agent-systems/allternit-browser/

# Install dependencies. This project uses pnpm; bun is used only as the runtime.
RUN npm install -g pnpm@10.28.0 \
    && pnpm install --frozen-lockfile

# Copy only the sources reachable from the hosted runtime build.
COPY cmd/agent-daemon ./cmd/agent-daemon
COPY cmd/gizzi-code ./cmd/gizzi-code
COPY sdk/allternit-sdk ./sdk/allternit-sdk
COPY packages/@allternit/request-scorer ./packages/@allternit/request-scorer
COPY packages/@allternit/computer-use-protocol ./packages/@allternit/computer-use-protocol
COPY packages/@allternit/util ./packages/@allternit/util
COPY services/orchestration/control-plane/allternit-orchestrator ./services/orchestration/control-plane/allternit-orchestrator
COPY domains/kernel/core ./domains/kernel/core
COPY domains/governance/governor ./domains/governance/governor
COPY infrastructure/chrome-stream/agent-systems/allternit-browser ./infrastructure/chrome-stream/agent-systems/allternit-browser

RUN pnpm --dir packages/@allternit/util build \
    && mkdir -p cmd/gizzi-code/packages/gizzi-util/dist \
    && cp packages/@allternit/util/dist/*.js cmd/gizzi-code/packages/gizzi-util/dist/ \
    && cd cmd/agent-daemon \
    && bun build src/index.ts --target=bun --outfile=dist/index.js \
    && cd /app/cmd/gizzi-code \
    && bun run build

# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2-debian

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The daemon is a single Bun bundle and Gizzi is a compiled standalone binary.
# Runtime images therefore do not need the builder's multi-gigabyte node_modules.
COPY --from=builder /app/cmd/agent-daemon/dist/index.js ./cmd/agent-daemon/dist/index.js
COPY --from=builder /app/cmd/gizzi-code/dist ./cmd/gizzi-code/dist

# Entrypoint coordinates the local Gizzi gateway and the cloud relay.
COPY cmd/allternit-hosted-runtime/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
ENV ALLTERNIT_RUNTIME_IDENTITY_PATH=/data/runtime-identity.json
ENV XDG_DATA_HOME=/data/.local/share
ENV XDG_CONFIG_HOME=/data/.config
ENV XDG_STATE_HOME=/data/.local/state
ENV XDG_CACHE_HOME=/data/.cache
ENV GIZZI_CONFIG_DIR=/data/.config/gizzi-code
ENV GIZZI_DISABLE_AUTOUPDATE=1
ENV NODE_ENV=production
ENV PORT=8013

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
