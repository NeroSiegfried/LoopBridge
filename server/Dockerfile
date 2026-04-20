FROM node:20-alpine AS builder
WORKDIR /app

# Native deps for better-sqlite3 and bcrypt
RUN apk add --no-cache python3 make g++

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Build React frontend
COPY client/package*.json ./client/
RUN cd client && npm ci --legacy-peer-deps
COPY client/ ./client/
RUN cd client && npm run build

# ── Litestream binary ──────────────────────────────────────────────────────
# Kept in its own stage so the final image only gains the ~8 MB binary.
FROM alpine AS litestream-dl
ARG LITESTREAM_VERSION=v0.3.13
RUN apk add --no-cache curl && \
    curl -fsSL \
      "https://github.com/benbjohnson/litestream/releases/download/${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /usr/local/bin litestream

FROM node:20-alpine
WORKDIR /app

# Copy server + built frontend + data
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY data/ ./data/

# Litestream binary
COPY --from=litestream-dl /usr/local/bin/litestream /usr/local/bin/litestream

# Make startup script executable
RUN chmod +x /app/server/start.sh

# Create uploads + default DB directory
RUN mkdir -p uploads/images uploads/videos uploads/audio uploads/documents uploads/other /data

EXPOSE 3000
ENV NODE_ENV=production
# start.sh: restores DB from S3 when LITESTREAM_S3_PATH is set, then runs
# litestream replicate -exec "node server/index.js".
# Without LITESTREAM_S3_PATH it falls back to plain "node server/index.js".
CMD ["/app/server/start.sh"]
