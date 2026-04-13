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

FROM node:20-alpine
WORKDIR /app

# Copy server + built frontend + data
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY data/ ./data/

# Create uploads directories
RUN mkdir -p uploads/images uploads/videos uploads/audio uploads/documents uploads/other

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server/index.js"]