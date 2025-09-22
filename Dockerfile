# --- Build stage ---
FROM node:20-slim AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# --- Production stage ---
FROM caddy:alpine
COPY --from=builder /app/dist /var/www/talama.dev
COPY Caddyfile /etc/caddy/Caddyfile
