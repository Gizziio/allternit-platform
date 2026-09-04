FROM debian:bookworm-slim AS base

# Disable the runtime transpiler cache by default inside Docker containers.
# On ephemeral containers, the cache is not useful
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
# The release binaries are compiled as glibc targets (bun-linux-x64/arm64),
# so the runtime base must be glibc-based (Alpine/musl would fail to exec).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 ripgrep ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# dist/gizzi-code-linux-* is produced by `bun run build --all` (script/build.ts).
# The COPY below fails the docker build loudly if the binary is missing, and
# the `gizzi-code --version` smoke check rejects a stale/broken binary — never
# embed one silently.
FROM base AS build-amd64
COPY dist/gizzi-code-linux-x64 /usr/local/bin/gizzi-code

FROM base AS build-arm64
COPY dist/gizzi-code-linux-arm64 /usr/local/bin/gizzi-code

ARG TARGETARCH
FROM build-${TARGETARCH}
RUN gizzi-code --version
ENTRYPOINT ["gizzi-code"]
