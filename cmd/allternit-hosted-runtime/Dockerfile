# Allternit Hosted Runtime
# Runs a checksum-pinned Gizzi brain and the agent-daemon relay in a Fly Machine.
# Build context: repository root

FROM oven/bun:1.2-debian AS builder

ARG GIZZI_RELEASE=hosted-runtime-2026.07.16
ARG GIZZI_LINUX_X64_SHA256=f1d29bad0b3903d77261e7706ff80fd292fefece3ebeaa4bb7f08a51ad2fc694

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Fetch the smoke-tested headless runtime artifact. Pinning both its release and
# checksum makes the hosted image reproducible without compiling desktop-only
# Gizzi sources inside the container build.
RUN curl -fsSL \
      "https://github.com/Gizziio/gizzi-code/releases/download/${GIZZI_RELEASE}/gizzi-code-linux-x64-native" \
      -o /app/gizzi-code \
    && echo "${GIZZI_LINUX_X64_SHA256}  /app/gizzi-code" | sha256sum -c - \
    && chmod +x /app/gizzi-code

# Install and bundle only the relay daemon. The compiled Gizzi artifact already
# contains its own runtime and dependencies.
COPY package.json pnpm-lock.yaml ./
COPY cmd/allternit-hosted-runtime/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY cmd/agent-daemon/package.json ./cmd/agent-daemon/

RUN npm install -g pnpm@10.28.0 \
    && pnpm install --filter @allternit/agent-daemon... --frozen-lockfile

COPY cmd/agent-daemon/src ./cmd/agent-daemon/src

RUN cd cmd/agent-daemon \
    && bun build src/index.ts --target=bun --outfile=dist/index.js

# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2-debian

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/gizzi-code ./cmd/gizzi-code/dist/gizzi-code
COPY --from=builder /app/cmd/agent-daemon/dist/index.js ./cmd/agent-daemon/dist/index.js

COPY cmd/allternit-hosted-runtime/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chmod +x /app/cmd/gizzi-code/dist/gizzi-code

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
