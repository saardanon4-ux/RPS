# --- Stage 1: Base (Shared setup) ---
FROM node:20-slim AS base
# Install OpenSSL (Required for Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# --- Stage 2: Client Builder ---
FROM base AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Stage 3: Production Server ---
FROM base
WORKDIR /app

# Copy server dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server code
COPY server/ ./

# Copy built client from previous stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port and set environment
ENV NODE_ENV=production
EXPOSE 3000

# STARTUP COMMAND (Fixes the crash loop)
CMD ["sh", "-c", "npx prisma generate && node index.js"]
