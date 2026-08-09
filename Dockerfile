# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Pinned to the version in package.json's packageManager field. Installing pnpm unpinned
# meant every build picked up whatever npm served that day: a newer pnpm started trying to
# self-manage to the declared version, then failed --frozen-lockfile with "Cannot verify the
# identity of the @pnpm/exe.linux-x64 native binary: it is missing from pnpm-lock.yaml".
# The same commit built fine hours earlier, so the break arrived from outside the repo.
# --allow-build is disabled because the install below already passes --ignore-scripts.
RUN npm install -g pnpm@10.33.2

# Copy all workspace manifests first for layer caching.
# pnpm requires every workspace package.json to be present before `pnpm install`
# or it considers the lockfile dirty — even for packages excluded from the build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
# These three are not built here, but the comment above is only true if EVERY workspace
# manifest is present. They were missing, so pnpm produced no node_modules/@nodeira links
# at all — and since shared-types resolves through "main": "./src/index.ts", the api and web
# builds could not find it. (apps/mobile is a Gradle project with no package.json.)
COPY apps/cli/package.json ./apps/cli/
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/e2e/package.json ./apps/e2e/

# Prisma schema and config must be present before `pnpm install` because the
# apps/api postinstall script runs `prisma generate`, which requires the schema.
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

# Copy source (apps/docs excluded via .dockerignore — manifest above is enough)
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types
COPY packages/eslint-config ./packages/eslint-config

RUN cd apps/api && pnpm exec prisma generate
RUN pnpm exec turbo run build --filter=@nodeira/api... --filter=@nodeira/web...

# Drop devDependencies now that everything is built. Stage 2 copied the builder's entire
# node_modules, so the runtime image shipped TypeScript, Vite, ESLint, Electron Forge,
# Playwright and the rest -- the bulk of a 2.4 GB image.
#
# Order matters: `prisma generate` writes the client into node_modules/@prisma/client, and
# pruning reinstalls that package and discards it. So prune first, then regenerate. The
# regenerate step is also why `prisma` moved to dependencies -- the server runs
# `prisma migrate deploy` on boot, so it has to survive the prune either way.
# confirmModulesPurge=false because switching an existing install to --prod makes pnpm want
# to remove node_modules, and it refuses to do that unprompted without a TTY.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir /pnpm/store     --config.confirmModulesPurge=false
RUN cd apps/api && pnpm exec prisma generate

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Production-only node_modules (devDependencies pruned in the builder), including the
# generated Prisma client.
COPY --from=builder /app/node_modules ./node_modules

# Workspace package that node_modules/@nodeira/shared-types symlinks to
COPY --from=builder /app/packages/shared-types ./packages/shared-types

# Compiled NestJS server
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Prisma schema, migrations, and config (needed for `prisma migrate deploy`)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Web app static files — NestJS serves these via ServeStaticModule from ./public
COPY --from=builder /app/apps/web/dist ./apps/api/public

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["node", "dist/main.js"]
