# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ops/runtime/package.json ops/runtime/package.json
RUN --mount=type=cache,id=gusti-pnpm,target=/pnpm/store,sharing=locked \
    npm install --global "pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')" \
    && pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile \
    && pnpm --filter @gusti/runtime-tools --prod deploy --offline /runtime-tools
COPY . .
ENV UV_THREADPOOL_SIZE=2
RUN pnpm build

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl fonts-dejavu-core ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node -m 0750 /app/storage
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 MEDIA_DIRECTORY=/app/storage MALLOC_ARENA_MAX=2
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /runtime-tools ./runtime-tools
COPY prisma.config.ts ./runtime-tools/
COPY prisma ./runtime-tools/prisma
COPY src/lib/database-url.ts ./runtime-tools/src/lib/
COPY src/modules/auth/password.ts ./runtime-tools/src/modules/auth/
COPY scripts/create-admin.mjs ./runtime-tools/scripts/
COPY --chmod=755 ops/runtime/start.sh /usr/local/bin/gusti-start
USER node
EXPOSE 3000
CMD ["/usr/local/bin/gusti-start"]
