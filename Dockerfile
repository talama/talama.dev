# --- Build stage ---
FROM node:20-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# --- Production stage ---
FROM caddy:alpine
COPY --from=builder /app/dist /var/www/talama.dev
COPY Caddyfile /etc/caddy/Caddyfile
