FROM rust:1.78-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build -p kernel --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/kernel /usr/local/bin/kernel
EXPOSE 3004
CMD ["kernel"]
