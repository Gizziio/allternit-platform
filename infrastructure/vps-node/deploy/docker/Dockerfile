# Allternit Node Agent Dockerfile
# 
# Usage:
#   docker build -t allternit-node .
#   docker run -d --name allternit-node -v /var/run/docker.sock:/var/run/docker.sock -e ALLTERNIT_TOKEN=xxx allternit-node

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
RUN groupadd -r allternit && useradd -r -g allternit allternit

# Create directories
RUN mkdir -p /opt/allternit/bin /etc/allternit /var/log/allternit && \
    chown -R allternit:allternit /opt/allternit /etc/allternit /var/log/allternit

# Copy binary from builder
COPY --from=builder /app/target/release/allternit-node /opt/allternit/bin/allternit-node
RUN chmod +x /opt/allternit/bin/allternit-node && \
    chown allternit:allternit /opt/allternit/bin/allternit-node

# Switch to non-root user
USER allternit

WORKDIR /opt/allternit

# Set environment variables
ENV Allternit_NODE_ID=
ENV ALLTERNIT_TOKEN=
ENV Allternit_CONTROL_PLANE=wss://control.allternit.io
ENV RUST_LOG=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /opt/allternit/bin/allternit-node --health || exit 1

# Run the binary
CMD ["/opt/allternit/bin/allternit-node"]

# Metadata
LABEL org.opencontainers.image.title="Allternit Node Agent"
LABEL org.opencontainers.image.description="Allternit Node Agent - Connect your infrastructure to Allternit Control Plane"
LABEL org.opencontainers.image.vendor="Allternit"
LABEL org.opencontainers.image.licenses="MIT OR Apache-2.0"
