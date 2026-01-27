# syntax=docker/dockerfile:1.6

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Only copy dependency manifests first (best cache reuse)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Cache npm downloads between builds
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy the rest
COPY . .

# Prisma + build
RUN npx prisma generate
RUN npm run build


# Production stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user (recommended)
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy only what's needed to run
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# (Optional) if you need runtime files like views/public, copy them too
# COPY --from=builder /app/public ./public

# If you MUST generate prisma at runtime, keep this, but usually not needed if node_modules copied
# RUN npx prisma generate

RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
