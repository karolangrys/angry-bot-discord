# Instrukcje AI (AI Instructions) - Vertical Slice Architecture

Ten projekt wykorzystuje środowisko **Bun**, język **TypeScript**, **Discord.js** oraz bazę **SQLite** z **Drizzle ORM**.

## Najlepsze Praktyki (Best Practices)

1. **Vertical Slice Architecture**:
   - Główne moduły funkcjonalne bota nazywamy "features".
   - Nowe funkcjonalności (komendy, powiązane z nimi handlery eventów, logika specyficzna dla modułu) muszą znajdować się w osobnym folderze w `src/features/` (np. `src/features/ping/`).
2. **Kebab Case**:
   - Wszystkie nowo tworzone pliki i foldery muszą korzystać z notacji `kebab-case` (np. `server-info.command.ts`).
3. **TypeScript & Strict Mode**:
   - Kod musi być silnie typowany, bez używania `any`, chyba że to absolutnie konieczne.
   - Wykorzystuj `zod` do walidacji danych ze środowiska (`env-config.ts`).
4. **Logowanie**:
   - Nie używaj `console.log`. Używaj skonfigurowanego instancji Winstona (`src/core/logger.ts`).
5. **Obsługa błędów (Error Handling)**:
   - Błędy w komendach logujemy za pomocą loggera (level: error). Bot nie może zawiesić działania w przypadku błędu w komendzie. Należy wysłać użytkownikowi wiadomość typu `ephemeral`.
6. **Command Handler Pattern**:
   - Komenda (np. `ping.command.ts`) musi eksportować obiekt z właściwością `data` (np. `SlashCommandBuilder`) oraz funkcję `execute(interaction)`.
7. **Testowanie**:
   - Testy są pisane z użyciem `bun:test` w tym samym folderze feature'a obok kodu testowanego, np. `ping.test.ts`.
