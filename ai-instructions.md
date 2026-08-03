# Instrukcje AI (AI Instructions) - Vertical Slice Architecture

Ten projekt wykorzystuje środowisko **Bun**, język **TypeScript**, **Discord.js** oraz bazę **SQLite** z **Drizzle ORM**.

## Najlepsze Praktyki (Best Practices)

1. **Vertical Slice Architecture**:
   - Główne moduły funkcjonalne bota nazywamy "features".
   - Nowe funkcjonalności (komendy, powiązane z nimi handlery eventów, logika specyficzna dla modułu) muszą znajdować się w osobnym folderze w `src/features/` (np. `src/features/ping/`).
   - `src/core/` nie może importować niczego z `src/features/`. Feature podłącza się sam przez auto-discovery (`command-handler.ts`, `i18n.ts`) oraz opcjonalny hook `onReady`.
2. **Kebab Case**:
   - Wszystkie nowo tworzone pliki i foldery muszą korzystać z notacji `kebab-case` (np. `server-info.command.ts`).
   - Identyfikatory w kodzie i klucze tłumaczeń piszemy po angielsku (wartości tłumaczeń oczywiście nie).
3. **TypeScript & Strict Mode**:
   - Kod musi być silnie typowany, bez używania `any`, chyba że to absolutnie konieczne.
   - Wykorzystuj `zod` do walidacji danych ze środowiska (`env-config.ts`).
   - Przed commitem: `bun run verify` (prettier + tsc + testy).
4. **Logowanie**:
   - Nie używaj `console.log`. Używaj skonfigurowanej instancji Winstona (`src/core/logger.ts`).
   - Wyjątek: `env-config.ts` używa `console.error`, bo logger importuje ten moduł (cykl importów).
   - Błąd przekazuj jako osobny argument (`logger.error('Kontekst:', error)`) — format loggera renderuje stack trace z argumentów.
5. **Obsługa błędów (Error Handling)**:
   - Błędy w komendach logujemy za pomocą loggera (level: error). Bot nie może zawiesić działania w przypadku błędu w komendzie.
   - Wiadomość dla użytkownika wysyłamy z `flags: MessageFlags.Ephemeral` (opcja `ephemeral: true` jest deprecated).
   - Odpowiedź na interakcję w bloku `catch` też trzeba owinąć w `try/catch` — token interakcji może już nie być ważny (błąd 10062).
6. **Command Handler Pattern**:
   - Komenda (np. `ping.command.ts`) musi eksportować `data` (np. `SlashCommandBuilder`) oraz funkcję `execute(interaction)`.
   - Opcjonalnie może eksportować `onReady(client)` — uruchamiane raz po połączeniu z gatewayem (np. przywrócenie zapisanego stanu).
   - Opcjonalnie może eksportować `handleModal(interaction)` — obsługa okienek (modali). Core routuje po **pierwszym segmencie** `customId`, który musi być nazwą komendy (`js-task:add:123`), dzięki czemu `bot.ts` nie musi wiedzieć, które feature'y używają modali. W `handleModal` **ponów sprawdzenie uprawnień** — `customId` przychodzi od klienta i nie jest dowodem autoryzacji.
   - Uprawnienia: efekty per-serwer sprawdzamy przez `interaction.memberPermissions`, ale wszystko, co działa globalnie na procesie bota (np. presence), wymaga `isBotOwner()` z `src/core/permissions.ts`.
   - Komendy działające tylko na serwerze oznaczamy `.setContexts(InteractionContextType.Guild)`.
7. **i18n**:
   - Każdy feature ma `locales.ts` z eksportem `NAMESPACE` oraz domyślnym eksportem walidowanym przez `satisfies LocaleBundle<...>`.
   - Komenda pobiera tłumaczenia przez `getT(interaction, NAMESPACE)` — nigdy przez literał, bo rozjazd nazwy namespace'u powoduje wyświetlanie surowych kluczy.
   - Po zapisaniu języka serwera trzeba wywołać `invalidateGuildLanguage(guildId)` (wynik jest cache'owany).
   - Daty formatujemy helperem `time()` z discord.js, nie `toLocaleDateString()` — inaczej użytkownik widzi locale procesu serwera.
8. **Baza danych**:
   - Zmiana `src/core/db/schema.ts` wymaga `bun run db:generate` i zacommitowania plików z `drizzle/`. Migracje są nakładane automatycznie przy starcie.
9. **Testowanie**:
   - Testy są pisane z użyciem `bun:test` w tym samym folderze feature'a obok kodu testowanego, np. `ping.test.ts`.
   - Nie mockuj `core/i18n` ani `core/db/db-client`. `bunfig.toml` preloaduje `src/test-setup.ts`, który daje prawdziwe tłumaczenia i bazę in-memory — dzięki temu testy łapią błędy w warstwie tłumaczeń i zapytaniach.
   - Fake'owe interakcje buduj helperem `createInteraction()` z `src/test-support.ts`.
   - Asercje na treści odpowiedzi powinny sprawdzać przetłumaczony tekst, a nie tylko fakt wywołania `reply`.
