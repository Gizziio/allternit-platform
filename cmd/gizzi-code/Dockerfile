FROM alpine AS base

# Disable the runtime transpiler cache by default inside Docker containers.
# On ephemeral containers, the cache is not useful
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
RUN apk add libgcc libstdc++ ripgrep

FROM base AS build-amd64
COPY dist/gizzi-code-linux-x64 /usr/local/bin/gizzi-code

FROM base AS build-arm64
COPY dist/gizzi-code-linux-arm64 /usr/local/bin/gizzi-code

ARG TARGETARCH
FROM build-${TARGETARCH}
RUN gizzi-code --version
ENTRYPOINT ["gizzi-code"]
