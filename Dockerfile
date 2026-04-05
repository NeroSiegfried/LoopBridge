# LoopBridge — Production Dockerfile
# Suitable for ECS / Fargate / App Runner / EC2
#
# Build:  docker build -t loopbridge .
# Run:    docker run -p 3000:3000 --env-file .env loopbridge

FROM node:20-alpine AS base

WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# ─── Application ──────────────────────────────────────────
# Copy the full project (frontend + backend)
COPY . .

# ─── Runtime ──────────────────────────────────────────────
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

WORKDIR /app/server

CMD ["node", "index.js"]
