# Angry Discord Bot

A high-performance, modular, and multi-language Discord bot built with **Bun**, **TypeScript**, **Discord.js**, and an **SQLite** database (using **Drizzle ORM**).
The project follows the **Vertical Slice Architecture** pattern.

## Features
* **i18n Management**: Built-in system supporting English (`en-US`) and Polish (`pl`), dynamically adjusting to the language selected by the server administrator or the user's client language.
* **Vertical Slice Architecture**: The code is divided into self-contained features in `src/features`, making scaling the bot and maintaining unit tests effortless.
* **SQLite + Drizzle ORM**: A lightweight, lightning-fast database running fully locally without the need for external database engines.
* **Automated CI/CD**: Integrated GitHub Actions workflow that automatically publishes and restarts services on your VPS.
* **Built-in Commands**: `/ping`, `/server-info`, `/user-info`, `/status` (admin), `/config language` (admin).

## Requirements
* **Bun** (latest version).
* **Docker** & **Docker Compose** (for production deployment).
* A Discord Bot Token generated via the [Discord Developer Portal](https://discord.com/developers/applications).

## Local Development

1. Clone the repository.
2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
   *Fill in the `.env` file with your credentials (especially `DISCORD_TOKEN`, `CLIENT_ID`, and `TEST_GUILD_ID`).*

3. Install dependencies:
   ```bash
   bun install
   ```

4. Run database migrations to generate the table structures:
   ```bash
   bun run db:generate
   bun run db:migrate
   # Alternatively, in development mode: bunx drizzle-kit push
   ```

5. Register Slash Commands on your test server:
   ```bash
   bun run deploy-commands
   ```

6. Start the bot with hot-reload enabled:
   ```bash
   bun run dev
   ```

## Testing
The project uses the built-in `bun:test` test runner.

```bash
bun test
```
To format and lint the code, use:
```bash
bun run lint
bun run format
```

## Directory Structure
* `src/core/` - Global files necessary for the entire system (Discord client initialization, database connection, i18next setup).
* `src/features/` - The actual functional modules. Each feature contains its command logic, language dictionaries (`locales.ts`), and unit tests.

## Production Deployment (Docker)
Simply use the `docker-compose.yml` file, which will load the `.env` variables and expose the `sqlite.db` file via a volume in the `data/` directory.

```bash
docker-compose up -d --build
```
The default GitHub Actions workflow will automatically execute the necessary steps by logging into your VPS via SSH when you push a new tag (e.g. `v1.0.0`) or trigger it manually from the Actions tab.

### Required GitHub Secrets for Deployment
To enable the automated GitHub Actions deployment, configure the following secrets in your repository settings (**Settings > Secrets and variables > Actions**):
* `VPS_HOST` - The IP address or domain name of your VPS.
* `VPS_USERNAME` - SSH username (e.g. `root`).
* `VPS_SSH_KEY` - The private SSH key for authentication.
* `VPS_TARGET_PATH` - The absolute path on the VPS where the bot will be deployed (e.g. `/opt/angry-bot-discord`).
* `VPS_SSH_PORT` - *(Optional)* Custom SSH port. If omitted, defaults to `22`.
