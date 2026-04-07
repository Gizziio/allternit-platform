FROM rust:1.80-alpine as builder

# Install build dependencies
RUN apk add --no-cache musl-dev sqlite-dev openssl-dev pkgconfig

WORKDIR /usr/src/allternit

# Copy the entire workspace
COPY . .

# Build the API service
RUN cargo build --bin allternit-api --release

# Production stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs openssl

WORKDIR /usr/local/bin

# Copy the binary from builder stage
COPY --from=builder /usr/src/allternit/target/release/allternit-api .

# Create a non-root user
RUN addgroup -g 1001 -S allternit && \
    adduser -u 1001 -S allternit -G allternit

USER allternit

EXPOSE 3000

CMD ["./allternit-api"]