FROM oven/bun:1.1 as base
WORKDIR /app

# Budowanie obrazu i instalacja zależności
FROM base as install
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Finalny obraz uruchomieniowy
FROM base as release
COPY --from=install /app/node_modules node_modules
COPY . .

# Tworzenie pliku .env (zmienne przekażemy przez docker-compose)
RUN touch .env

USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
