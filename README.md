# Angry Discord Bot

A high-performance, modular, and multi-language Discord bot built with **Bun**, **TypeScript**, **Discord.js**, and an **SQLite** database (using **Drizzle ORM**).
The project follows the **Vertical Slice Architecture** pattern.

## Features

- **i18n Management**: Built-in system supporting English (`en-US`) and Polish (`pl`), dynamically adjusting to the language selected by the server administrator or the user's client language.
- **Vertical Slice Architecture**: The code is divided into self-contained features in `src/features`, making scaling the bot and maintaining unit tests effortless.
- **SQLite + Drizzle ORM**: A lightweight, lightning-fast database running fully locally without the need for external database engines. Migrations are applied automatically on every startup.
- **Automated CI/CD**: GitHub Actions workflow that verifies, publishes and restarts the service on your VPS.
- **Built-in Commands**: `/ping`, `/server-info`, `/user-info`, `/status` (bot owner), `/config language` (server admin).
- **Scheduled JavaScript tasks**: `/js-task` lets the bot owner add a snippet plus a cron expression;
  it is stored in SQLite and executed in a separate process, with its return value posted to a
  channel. See [`src/features/js-task/README.md`](src/features/js-task/README.md) for how to write
  the scripts. **Owner-only by design**: the subprocess, the scrubbed environment and the timeout
  guard against mistakes — an infinite loop, a leak, an accidental token read — but they are not a
  sandbox against a hostile author, so `OWNER_IDS` is the real access control. This feature also
  makes `mem_limit` in `docker-compose.yml` mandatory rather than optional.

## Requirements

- **Bun** (latest version).
- **Docker** & **Docker Compose v2** (for production deployment).
- A Discord Bot Token generated via the [Discord Developer Portal](https://discord.com/developers/applications).

The bot requires no privileged gateway intents.

## Local Development

1. Clone the repository.
2. Copy the environment variables template:

   ```bash
   cp .env.example .env
   ```

   Fill in `DISCORD_TOKEN`, `CLIENT_ID` and — while developing — `TEST_GUILD_ID`.

3. Install dependencies:

   ```bash
   bun install
   ```

4. Register Slash Commands on your test server:

   ```bash
   bun run deploy-commands
   ```

5. Start the bot with hot-reload enabled:
   ```bash
   bun run dev
   ```

Database tables are created on startup from the committed migrations in `drizzle/`, so there is no
separate migration step for a normal run.

### Environment variables

| Variable        | Required | Default         | Purpose                                                                                                                                                                                |
| --------------- | -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN` | yes      | —               | Bot token.                                                                                                                                                                             |
| `CLIENT_ID`     | yes      | —               | Application ID, used when registering commands.                                                                                                                                        |
| `TEST_GUILD_ID` | no       | —               | Register commands in this guild only (instant updates). **Must be empty in production.**                                                                                               |
| `OWNER_IDS`     | no       | —               | Comma-separated user IDs allowed to run `/status`. Falls back to the Discord application owner.                                                                                        |
| `DATABASE_URL`  | no       | `sqlite.db`     | SQLite file path.                                                                                                                                                                      |
| `LOG_DIR`       | no       | `logs`          | Directory for the Winston log files.                                                                                                                                                   |
| `NODE_ENV`      | no       | `development`   | `development` enables debug logging; `test` silences logs and file transports.                                                                                                         |
| `CRON_TIMEZONE` | no       | `Europe/Warsaw` | IANA timezone the `/js-task` cron expressions are read in. Nothing sets `TZ`, so the container runs in UTC; without this a `0 9 * * *` task would fire at 11:00 Polish time in summer. |

### Changing the database schema

```bash
# 1. Edit src/core/db/schema.ts, then generate a migration:
bun run db:generate
# 2. Commit the new files in drizzle/ — startup applies them automatically.
# Optional: inspect the data
bun run db:studio
```

## Testing

The project uses the built-in `bun:test` test runner. `bunfig.toml` preloads `src/test-setup.ts`,
which supplies dummy credentials, an in-memory database and real translations — the suite needs no
`.env` and is safe to run in CI.

```bash
bun test
bun run typecheck      # tsc --noEmit
bun run lint           # prettier --check .
bun run format         # prettier --write .
bun run verify         # all three, the same checks CI runs
```

## Directory Structure

- `src/core/` — Global infrastructure: Discord client, command loader, database, i18next, logging.
- `src/features/` — Functional modules. Each feature holds its command logic, its language
  dictionary (`locales.ts`) and its unit tests.
- `drizzle/` — Generated SQL migrations. Committed, and applied on every startup.

### Adding a feature

Create `src/features/<name>/` containing:

- `locales.ts` — a `NAMESPACE` export plus a default export validated with
  `satisfies LocaleBundle<...>`, so a missing translation is a compile error.
- `<name>.command.ts` — exports `data` (a `SlashCommandBuilder`) and `execute(interaction)`, and
  optionally `onReady(client)` for state that must be restored after login.
- `<name>.test.ts` — unit tests.

Both the command loader and the i18n loader discover the folder automatically; nothing in `src/core`
needs to be edited.

## Production Deployment (Docker)

The image is published to GHCR by CI. `docker-compose.yml` deliberately has no `build:` section.
Copy it manually to the VPS deployment directory — the CI pipeline verifies its presence but does
not overwrite it.

From your local machine, copy `docker-compose.yml` to the VPS:

```bash
scp docker-compose.yml user@your-vps-host:/opt/angry-bot-discord/

# If using a custom SSH port or key:
scp -P 2222 -i ~/.ssh/your_key docker-compose.yml user@your-vps-host:/opt/angry-bot-discord/
```

On the VPS, in the deployment directory:

```bash
# .env holds the bot credentials plus the two image variables read by docker-compose.yml
cat > .env <<'EOF'
DISCORD_TOKEN=...
CLIENT_ID=...
TEST_GUILD_ID=
IMAGE_OWNER=your-github-username-lowercase
IMAGE_TAG=latest
EOF

mkdir -p data logs
# The container runs as the unprivileged `bun` user (uid 1000) and writes both directories.
sudo chown -R 1000:1000 data logs

docker compose pull
docker compose up -d
```

`data/` holds `sqlite.db` and `logs/` the Winston log files, both as bind mounts so they survive
container replacement.

To build and run the image locally instead:

```bash
docker build -t ghcr.io/your-github-username-lowercase/angry-bot-discord:latest .
docker compose up -d
```

### Continuous deployment

The project uses two GitHub Actions workflows:

**CI** (`ci.yml`) — runs on every pull request:

- `prettier --check`, `tsc --noEmit` and `bun test`.

**Build and Deploy** (`build-and-deploy.yml`) — runs on `v*` tags and `workflow_dispatch`:

1. **ci** — calls the CI workflow as a reusable workflow to verify the code.
2. **build-and-push-image** — builds and pushes to GHCR, tagged with the version, the branch, and
   the immutable `sha-<commit>`.
3. **deploy** — verifies that `docker-compose.yml` and `.env` exist on the VPS, pulls the exact
   `sha-<commit>` image, registers the slash commands, and restarts the container.

The deploy job uses the `production` GitHub environment, so you can require a manual approval under
**Settings > Environments**.

### Required GitHub Secrets for Deployment

Configure these under **Settings > Secrets and variables > Actions**:

- `VPS_HOST` — The IP address or domain name of your VPS.
- `VPS_USERNAME` — SSH username. Prefer a dedicated non-root user that is a member of the `docker` group.
- `VPS_SSH_KEY` — The private SSH key for authentication.
- `VPS_TARGET_PATH` — The absolute path on the VPS where the bot is deployed (e.g. `/opt/angry-bot-discord`).
- `VPS_SSH_PORT` — _(Optional)_ Custom SSH port. Defaults to `22`.

The `.env` file on the VPS is never overwritten by the deployment; create it once, as shown above.
