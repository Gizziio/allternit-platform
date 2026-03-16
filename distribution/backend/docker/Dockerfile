# A2R Backend - Production Docker Image
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM rust:1.75-slim-bookworm AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./
COPY .cargo ./.cargo

# Copy all crate source code
COPY 0-substrate ./0-substrate
COPY 1-kernel ./1-kernel
COPY 2-governance ./2-governance
COPY 3-adapters ./3-adapters
COPY 4-services ./4-services
COPY 7-apps/api ./7-apps/api
COPY 7-apps/cli ./7-apps/cli
COPY 8-cloud ./8-cloud
COPY packages ./packages

# Build release binaries
# Build API server (main entry point)
RUN cargo build --release -p a2rchitech-api

# Build additional services
RUN cargo build --release -p kernel-service
RUN cargo build --release -p workspace-service
RUN cargo build --release -p a2rchitech-memory

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a2r user
RUN groupadd -r a2r && useradd -r -g a2r -m -d /var/lib/a2r -s /bin/bash a2r

WORKDIR /opt/a2r

# Copy binaries from builder
COPY --from=builder /build/target/release/a2rchitech-api ./bin/
COPY --from=builder /build/target/release/kernel-service ./bin/
COPY --from=builder /build/target/release/workspace-service ./bin/
COPY --from=builder /build/target/release/a2rchitech-memory ./bin/

# Copy startup scripts
COPY distribution/backend/docker/entrypoint.sh ./
COPY distribution/backend/docker/start-services.sh ./

# Copy default config
COPY distribution/backend/docker/config ./config/

# Set permissions
RUN chmod +x entrypoint.sh start-services.sh && \
    chown -R a2r:a2r /opt/a2r

# Create data directory
RUN mkdir -p /var/lib/a2r/data && chown -R a2r:a2r /var/lib/a2r

# Switch to a2r user
USER a2r

# Environment
ENV A2R_HOME=/var/lib/a2r
ENV A2R_CONFIG=/opt/a2r/config
ENV PATH="/opt/a2r/bin:${PATH}"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4096/health || exit 1

# Expose ports
EXPOSE 4096 3000 3004 3021 8080

# Start
ENTRYPOINT ["./entrypoint.sh"]
CMD ["./start-services.sh"]
