# `js-task` — zadania cykliczne w JavaScripcie

Właściciel bota dodaje przez Discorda fragment JavaScriptu i wyrażenie cron. Kod jest zapisywany w
bazie i uruchamiany cyklicznie w **osobnym procesie**, a to, co zwróci, trafia na wskazany kanał.
Bez redeployu, z zachowaniem harmonogramu po restarcie.

## Szybki start

`/js-task dodaj` otwiera okienko z trzema polami:

| Pole  | Wartość       |
| ----- | ------------- |
| Nazwa | `kurs-usd`    |
| Cron  | `0 9 * * 1-5` |
| Kod   | patrz niżej   |

```js
const r = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json');
const d = await r.json();
return `Kurs USD: **${d.rates[0].mid}** zł`;
```

Po zatwierdzeniu skrypt uruchamia się **od razu**, a Ty widzisz wynik i termin następnego
uruchomienia. Od poniedziałku do piątku o 9:00 wiadomość poleci na kanał.

## Jak testować, zanim zaplanujesz

| Komenda                    | Zapisuje? | Do czego                              |
| -------------------------- | --------- | ------------------------------------- |
| `/js-task testuj`          | nie       | brudnopis — iterujesz nad kodem       |
| `/js-task dodaj`           | tak       | uruchamia raz i pokazuje podgląd      |
| `/js-task uruchom <nazwa>` | —         | powtórka zapisanego zadania, na serio |

Jeśli skrypt się wywali przy dodawaniu, zadanie **zostaje zapisane, ale wyłączone**. Poprawiasz przez
`/js-task edytuj`, które wkleja poprzedni kod z powrotem — nigdy nie piszesz od nowa.

## Co jest dostępne w skrypcie

**Dostępne:** `fetch`, `JSON`, `Math`, `Date`, `console.log`, `store`, `trigger`, `isDryRun`.

**Niedostępne:** `client` (obiekt bota), `db`, `process.env`, `require`, `fs`, `Bun.spawn` do
niczego użytecznego. Zmienne środowiskowe są celowo wyczyszczone — skrypt nie zobaczy
`DISCORD_TOKEN`.

**Nie ma dostępu do bazy bota.** Jedyna persystencja to `store` (niżej) — żadnego SQL ani czytania
tabel bota.

Po `EmbedBuilder` i helpery formatujące sięgnij normalnie, są doładowywane na żądanie:
`EmbedBuilder`, `time`, `bold`, `italic`, `codeBlock`, `inlineCode`, `hyperlink`, `quote`.

## Co zwracać

```js
return null; // cisza — dla zadań będących tylko efektem ubocznym
return 'Kurs USD: 4,02'; // zwykła wiadomość
return { content: 'Uwaga', embeds: [embed] }; // treść i/lub embed
```

Z obiektu przepuszczamy **tylko** `content`, `embeds` i `allowedMentions`. Pola `files`,
`components`, `poll`, `tts` są po cichu wycinane.

`content` jest ucinany do 1900 znaków. **Embedy nie** — mają własne limity (6000 znaków łącznie,
25 pól, tytuł 256, stopka 2048, max 10 embedów) i ciche obcięcie zamieniłoby je w bełkot. Za duży
embed odrzuci API Discorda, a błąd zobaczysz w `/js-task pokaz`.

### Wzmianki są domyślnie wyłączone

Do każdej wiadomości dokładamy `allowedMentions: { parse: [] }`, więc tekst wklejony z zewnętrznego
API nie pingnie przypadkiem `@everyone`. Jeśli naprawdę chcesz pingować, ustaw to pole jawnie:

```js
return { content: '<@&123> deploy gotowy', allowedMentions: { roles: ['123'] } };
```

## Embedy

Najprościej builderem — waliduje od razu i przyjmuje kolory jako hex-stringi:

```js
const e = new EmbedBuilder()
  .setTitle('USD → PLN')
  .setDescription('**4,02** zł')
  .setColor('#5865f2')
  .addFields({ name: 'Tabela', value: 'A/2026', inline: true })
  .setFooter({ text: 'NBP' })
  .setTimestamp();

return { embeds: [e] };
```

**Nie wywołuj `.toJSON()`** — serializacja dzieje się sama. (Nieszkodliwe, jeśli jednak wywołasz.)

Można też zwrócić surowy obiekt, ale wtedy obowiązują reguły API Discorda, nie buildera:

```js
return { embeds: [{ title: 'x', color: 0x5865f2, footer: { text: 'NBP' } }] };
```

Dwa haczyki dotyczące **wyłącznie** surowej drogi — builder rozwiązuje oba za Ciebie:

- `color` musi być **liczbą** (`0x5865f2`), nie stringiem (`'#5865f2'`).
- Nazwy pól to API, nie metody: `footer: { text }` zamiast `.setFooter()`, `author: { name, icon_url }`
  w snake_case.

`timestamp: new Date()` działa w obu wariantach.

## `store` — stan między uruchomieniami

Każdy przebieg to **świeży proces**, więc zmienne globalne nie przetrwają:

```js
let n = 0;
n++; // NIE ZADZIAŁA — nowy proces, nowa zmienna

const n = Number((await store.get('n')) ?? '0') + 1; // zadziała
await store.set('n', n);
```

`store` jest zakresowany do jednego zadania — nie zobaczysz danych innych zadań.

## Sekrety i klucze API

**Nie wklejaj kluczy w kod skryptu** — `/js-task pokaz` wypisze go w całości. Użyj:

```
/js-task sekret ustaw nazwa:kurs-usd klucz:api-key wartosc:abc123
```

```js
const key = await store.get('secret:api-key');
```

Czego to **nie** daje: kod i sekrety leżą w SQLite jawnym tekstem. To ochrona przed przypadkowym
pokazaniem kodu, nie sejf. Kto ma dostęp do pliku bazy, ma dostęp do sekretów.

## Dry run i odgradzanie nieodwracalnych operacji

Część rzeczy jest chroniona automatycznie, część musisz odgrodzić sam:

| Rodzaj zmiany                       | Kto pilnuje                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `store.set`                         | **automat** — zapisy z dry-runu są kasowane, nie owijaj w `if` |
| wiadomość na kanale                 | **automat** — dry-run nie publikuje, widzisz wynik tylko Ty    |
| `fetch` z POST/PUT/DELETE, webhooki | **Ty**, przez `isDryRun`                                       |

```js
const dane = await fetch(url).then((r) => r.json()); // GET zawsze — chcemy to przetestować
await store.set('ostatni', dane.rate); // bez if-a: na dry-runie i tak nie zapisze

if (!isDryRun) {
  await fetch(webhook, { method: 'POST', body: JSON.stringify(dane) }); // tylko na serio
}
return `Kurs: ${dane.rate}${isDryRun ? ' (test, webhook pominięty)' : ''}`;
```

Cztery konteksty uruchomienia:

| Uruchomienie         | `trigger`    | `isDryRun` |
| -------------------- | ------------ | ---------- |
| Cron                 | `'schedule'` | `false`    |
| `/js-task uruchom`   | `'manual'`   | `false`    |
| Dry-run przy zapisie | `'dry-run'`  | `true`     |
| `/js-task testuj`    | `'test'`     | `true`     |

`/js-task uruchom` **nie** jest dry-runem — to jawne „wykonaj teraz". Kto chce przebiegu bez skutków,
używa `/js-task testuj`.

⚠️ **Czego dry run nie sprawdzi:** kod schowany za `if (!isDryRun)` nie jest wykonywany. „Dry run
przeszedł" nie znaczy „skrypt działa" — im więcej odgrodzisz, tym mniej test dowodzi.

## Cron

Wyrażenia interpretowane w strefie z `CRON_TIMEZONE` (domyślnie `Europe/Warsaw`), więc `0 9 * * *` to
9:00 czasu polskiego zimą i latem.

| Wyrażenie     | Znaczenie                      |
| ------------- | ------------------------------ |
| `*/5 * * * *` | co 5 minut                     |
| `0 * * * *`   | o każdej pełnej godzinie       |
| `0 9 * * 1-5` | 9:00 od poniedziałku do piątku |
| `0 */2 * * *` | co 2 godziny                   |
| `30 8 1 * *`  | 8:30 pierwszego dnia miesiąca  |

**Minimum to 60 sekund między uruchomieniami.** Croner rozumie sekundy, więc `* * * * * *` jest
składniowo poprawne — i odrzucane, bo utopiłoby bota w limitach Discorda.

**Pominięte uruchomienia nie są nadrabiane.** Jeśli bot leżał w momencie odpalenia, ten przebieg
przepada. Świadoma decyzja: po godzinie przestoju nikt nie chce dwunastu zaległych wiadomości naraz.

## Limity

| Co                             | Ile                              |
| ------------------------------ | -------------------------------- |
| Czas jednego przebiegu         | 10 s, potem `SIGKILL`            |
| Równolegle uruchomione skrypty | 2, reszta czeka w kolejce        |
| Długość kodu                   | 4000 znaków (limit pola okienka) |
| Nazwa zadania                  | `^[a-z0-9-]{1,32}$`              |
| Liczba zadań                   | 50                               |
| Logi w wyniku                  | 100 linii / 10 KB                |

**Pamięć:** Bun nie ma działającego limitu heapu na proces (sprawdzone na 1.3.14 — `--smol`,
`--max-old-space-size` ani `BUN_JSC_forceRAMSize` nie zatrzymują rozbiegniętej alokacji), więc limit
egzekwuje cgroup kontenera. Zmierzone pod `--memory 512m`: skrypt `while(true) a.push(...)` zostaje
ubity przez OOM killera po ~2,6 s, **bot przeżywa** i raportuje `Sandbox exited with code 137`.
Jądro wybiera największego konsumenta pamięci, czyli sam sandbox, a nie proces bota.

Dlatego `mem_limit` w `docker-compose.yml` jest **obowiązkowy, nie opcjonalny**. Bez niego (np. przy
lokalnym `bun run dev`) jedynym ogranicznikiem jest 10-sekundowy timeout, a przez te 10 sekund skrypt
alokuje bez przeszkód.

## Debugowanie

- `console.log` jest zbierany i pokazywany w wyniku każdego trybu.
- `/js-task pokaz <nazwa>` — kod, ostatnie uruchomienie, `lastError`.
- Logi winstona: szukaj `js-task "<nazwa>"`. **Czasy w logach są w UTC** (winston formatuje czasem
  lokalnym procesu, a kontener działa w UTC) — inaczej niż daty w Discordzie, renderowane w Twojej
  strefie.

## Granica zaufania

Komenda jest dostępna **tylko dla właściciela bota** (`isBotOwner()`), nie dla administratorów
serwera. Dowolny JavaScript w infrastrukturze bota to więcej władzy niż `ManageGuild` na jednym
serwerze.

Osobny proces, wyczyszczone `env` i timeout chronią przed **pomyłką**: nieskończoną pętlą, wyciekiem
pamięci, rzuconym wyjątkiem, przypadkowym odczytem tokenu. **Nie są sandboxem przed wrogim
właścicielem** — kod w subprocesie nadal ma `Bun`, `fs` i możliwość uruchamiania procesów. Realną
kontrolą dostępu jest lista `OWNER_IDS`, nie izolacja.
