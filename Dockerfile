# Build stage - React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage - Node server + static client
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-builder /app/client/dist ./client/dist
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "index.js"]
