# A2R Node Agent Dockerfile
# 
# Usage:
#   docker build -t a2r-node .
#   docker run -d --name a2r-node -v /var/run/docker.sock:/var/run/docker.sock -e A2R_TOKEN=xxx a2r-node

FROM rust:1.75-bookworm AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy source
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r a2r && useradd -r -g a2r a2r

# Create directories
RUN mkdir -p /opt/a2r/bin /etc/a2r /var/log/a2r && \
    chown -R a2r:a2r /opt/a2r /etc/a2r /var/log/a2r

# Copy binary from builder
COPY --from=builder /app/target/release/a2r-node /opt/a2r/bin/a2r-node
RUN chmod +x /opt/a2r/bin/a2r-node && \
    chown a2r:a2r /opt/a2r/bin/a2r-node

# Switch to non-root user
USER a2r

WORKDIR /opt/a2r

# Set environment variables
ENV A2R_NODE_ID=
ENV A2R_TOKEN=
ENV A2R_CONTROL_PLANE=wss://control.a2r.io
ENV RUST_LOG=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /opt/a2r/bin/a2r-node --health || exit 1

# Run the binary
CMD ["/opt/a2r/bin/a2r-node"]

# Metadata
LABEL org.opencontainers.image.title="A2R Node Agent"
LABEL org.opencontainers.image.description="A2R Node Agent - Connect your infrastructure to A2R Control Plane"
LABEL org.opencontainers.image.vendor="A2R"
LABEL org.opencontainers.image.licenses="MIT OR Apache-2.0"
