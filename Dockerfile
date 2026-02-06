# Build stage - React client
FROM node:20-alpine AS client-builder
RUN apk add --no-cache openssl compat-openssl1.1
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage - Node server + static client
FROM node:20-alpine
RUN apk add --no-cache openssl compat-openssl1.1
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source and built client
COPY server/ ./
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Ensure Prisma Client is generated in the runtime image before starting
CMD ["sh", "-c", "npx prisma generate && node index.js"]
