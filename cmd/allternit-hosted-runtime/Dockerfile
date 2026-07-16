# Allternit Hosted Runtime
# Runs the Gizzi brain + agent-daemon relay inside a Fly Machine.
# Build context: repository root

FROM oven/bun:1.2-debian AS builder

WORKDIR /app

# Install build deps for native modules.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace package manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cmd/agent-daemon/package.json ./cmd/agent-daemon/
COPY cmd/gizzi-code/package.json ./cmd/gizzi-code/
COPY surfaces/ai.allternit.com/package.json ./surfaces/ai.allternit.com/

# Install dependencies. This project uses pnpm; bun is used only as the runtime.
RUN npm install -g pnpm@10 \
    && pnpm install --frozen-lockfile

# Copy source and build gizzi-code.
COPY cmd/agent-daemon ./cmd/agent-daemon
COPY cmd/gizzi-code ./cmd/gizzi-code
COPY surfaces/ai.allternit.com ./surfaces/ai.allternit.com

RUN cd cmd/gizzi-code && bun run build

# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2-debian

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed node_modules and built artifacts.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/cmd/agent-daemon ./cmd/agent-daemon
COPY --from=builder /app/cmd/gizzi-code ./cmd/gizzi-code
COPY --from=builder /app/surfaces/ai.allternit.com ./surfaces/ai.allternit.com
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./

# Entrypoint coordinates the local Gizzi gateway and the cloud relay.
COPY cmd/allternit-hosted-runtime/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
ENV ALLTERNIT_RUNTIME_IDENTITY_PATH=/data/runtime-identity.json
ENV NODE_ENV=production
ENV PORT=8013

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
