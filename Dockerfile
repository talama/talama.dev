# Base stage for building the static files
FROM node:20-slim AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# --- Production stage ---
FROM caddy:alpine
COPY --from=builder /app/dist /var/www/talama.dev
COPY Caddyfile /etc/caddy/Caddyfile
