# Allternit Cloud API — Railway/Fly/Docker deployment
# Build context: repository root

FROM rust:1.78-slim AS builder

WORKDIR /app

# Install build dependencies for native crates
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the full workspace source. .dockerignore keeps the context small.
COPY . .

# Build only the cloud API binary
RUN cargo build --release -p allternit-cloud-api

# ─────────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m allternit
WORKDIR /app

COPY --from=builder /app/target/release/allternit-cloud-api /usr/local/bin/allternit-cloud-api

RUN mkdir -p /data && chown -R allternit:allternit /data
USER allternit

ENV PORT=8080 \
    HOST=0.0.0.0 \
    DATABASE_URL=/data/api.db \
    RUST_LOG=info

EXPOSE 8080

CMD ["allternit-cloud-api"]
