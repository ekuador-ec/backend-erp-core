# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
WORKDIR /app
RUN apk add --no-cache curl \
 && curl -fsSL https://get.pnpm.io/install.sh | env ENV="$HOME/.shrc" SHELL="$(which sh)" sh - \
 && pnpm config set store-dir /pnpm/store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

FROM base AS dev
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS build
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS prod
ENV NODE_ENV=production
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3000}/" >/dev/null || exit 1
CMD ["node", "dist/server.js"]