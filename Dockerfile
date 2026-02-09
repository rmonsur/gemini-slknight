# Multi-stage build for SLKnight monolith
# Combines Next.js frontend + Express backend

# ===== Stage 1: Build Frontend =====
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js as standalone
RUN npm run build

# ===== Stage 2: Build Backend =====
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source and compile TypeScript
COPY backend/ ./
RUN npm run build

# ===== Stage 3: Production Image =====
FROM node:20-alpine AS production

WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Copy backend build
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Copy seed data to where compiled code expects it (dist/seed/)
COPY backend/src/seed ./backend/dist/seed

# Copy frontend standalone build
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Copy PM2 config and reverse proxy
COPY ecosystem.config.js ./
COPY proxy.js ./

# Environment
ENV NODE_ENV=production
ENV PORT=8080
ENV DEMO_MODE_ENABLED=true

# Expose the Cloud Run port
EXPOSE 8080

# Start both services with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
