# ── Stage 1: Build ─────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Use Go module proxy mirror for faster downloads in China
ENV GOPROXY=https://goproxy.cn,direct

# Copy Go module files first (layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the scheduler binary with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -X main.version=$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')" \
    -o /app/scheduler \
    ./cmd/scheduler

# ── Stage 2: Production runtime ────────────────────────────
FROM alpine:3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install CA certificates for TLS
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy the binary
COPY --from=builder /app/scheduler .

USER appuser

EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["/app/scheduler", "health"] || exit 1

CMD ["/app/scheduler"]
