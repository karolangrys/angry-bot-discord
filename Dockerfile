FROM oven/bun:1 AS base
WORKDIR /app

# Dependency installation
FROM base AS install
# `bun.lock` is the current text lockfile format. The previous `bun.lockb*` glob matched nothing,
# which silently turned --frozen-lockfile into an unpinned install.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Final runtime image
FROM base AS release
ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
# The `drizzle/` folder must be part of this copy: migrations are applied at startup.
COPY . .

# The container runs as the unprivileged `bun` user, so it has to own everything it writes.
# Previously /app was root-owned and both the SQLite database and the log files failed with EACCES.
RUN mkdir -p /app/data /app/logs && chown -R bun:bun /app/data /app/logs

USER bun

# Docker's default is SIGTERM already; stated explicitly because index.ts shuts down gracefully on it.
STOPSIGNAL SIGTERM

CMD ["bun", "run", "start"]
