FROM rust:1.80-alpine as builder

# Install build dependencies
RUN apk add --no-cache musl-dev sqlite-dev openssl-dev pkgconfig

WORKDIR /usr/src/a2rchitech

# Copy the entire workspace
COPY . .

# Build the API service
RUN cargo build --bin a2rchitech-api --release

# Production stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs openssl

WORKDIR /usr/local/bin

# Copy the binary from builder stage
COPY --from=builder /usr/src/a2rchitech/target/release/a2rchitech-api .

# Create a non-root user
RUN addgroup -g 1001 -S a2rchitech && \
    adduser -u 1001 -S a2rchitech -G a2rchitech

USER a2rchitech

EXPOSE 3000

CMD ["./a2rchitech-api"]