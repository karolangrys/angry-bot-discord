import type { LocaleBundle } from '../../core/i18n-config';

export const NAMESPACE = 'js-task';

type NamedThing = { name: string; description: string };

type JsTaskStrings = {
  /** Slash command metadata, read by SlashCommandBuilder rather than through i18next. */
  name: string;
  description: string;
  sub_add: NamedThing;
  sub_edit: NamedThing;
  sub_list: NamedThing;
  sub_show: NamedThing;
  sub_remove: NamedThing;
  sub_toggle: NamedThing;
  sub_run: NamedThing;
  sub_test: NamedThing;
  group_secret: NamedThing;
  sub_secret_set: NamedThing;
  sub_secret_list: NamedThing;
  sub_secret_unset: NamedThing;
  opt_name: NamedThing;
  opt_channel: NamedThing;
  opt_key: NamedThing;
  opt_value: NamedThing;

  /** Modal labels. */
  modal_add_title: string;
  modal_edit_title: string;
  modal_test_title: string;
  field_name: string;
  field_name_placeholder: string;
  field_cron: string;
  field_cron_placeholder: string;
  field_code: string;
  field_code_placeholder: string;

  /** Runtime strings. */
  no_permission: string;
  error: string;
  not_found: string;
  invalid_name: string;
  invalid_cron: string;
  too_frequent: string;
  syntax_error: string;
  too_many_tasks: string;
  no_channel: string;
  saved: string;
  saved_disabled_cron: string;
  saved_disabled_syntax: string;
  saved_disabled_failed: string;
  dry_run_preview: string;
  no_output: string;
  logs: string;
  duration: string;
  next_run: string;
  list_empty: string;
  list_header: string;
  list_more: string;
  removed: string;
  enabled: string;
  disabled: string;
  cannot_enable: string;
  show_header: string;
  show_never_run: string;
  run_failed: string;
  secret_set: string;
  secret_unset: string;
  secret_list_empty: string;
  secret_list_header: string;
  dm_failed: string;
  dm_channel_failed: string;
};

const locales = {
  'en-US': {
    name: 'js-task',
    description: 'Schedules JavaScript snippets on a cron timer (bot owner only).',
    sub_add: { name: 'add', description: 'Adds a task and runs it once to check that it works' },
    sub_edit: { name: 'edit', description: 'Edits the cron expression or code of a task' },
    sub_list: { name: 'list', description: 'Lists every scheduled task' },
    sub_show: { name: 'show', description: 'Shows the code and last run of a task' },
    sub_remove: { name: 'remove', description: 'Deletes a task and its stored state' },
    sub_toggle: { name: 'toggle', description: 'Enables or disables a task' },
    sub_run: { name: 'run', description: 'Runs a task once now, for real' },
    sub_test: { name: 'test', description: 'Runs code once without saving anything' },
    group_secret: { name: 'secret', description: 'Manages credentials a task can read' },
    sub_secret_set: { name: 'set', description: 'Stores a secret for a task' },
    sub_secret_list: { name: 'list', description: 'Lists secret names of a task, never values' },
    sub_secret_unset: { name: 'unset', description: 'Removes a secret from a task' },
    opt_name: { name: 'name', description: 'Task name' },
    opt_channel: { name: 'channel', description: 'Channel the results are posted to' },
    opt_key: { name: 'key', description: 'Secret name' },
    opt_value: { name: 'value', description: 'Secret value' },

    modal_add_title: 'New scheduled task',
    modal_edit_title: 'Edit task',
    modal_test_title: 'Run code once',
    field_name: 'Name (a-z, 0-9, dashes)',
    field_name_placeholder: 'daily-report',
    field_cron: 'Cron expression',
    field_cron_placeholder: '0 9 * * 1-5',
    field_code: 'JavaScript code',
    field_code_placeholder: "return 'Hello!';",

    no_permission: 'Only the bot owner can manage scheduled tasks.',
    error: 'Something went wrong while handling this command.',
    not_found: 'No task named **{{name}}**.',
    invalid_name:
      'Invalid name. Use 1-32 characters: lowercase letters, digits and dashes. Your code was not saved — sorry, the name is the key we store it under.',
    invalid_cron: 'That is not a valid cron expression.',
    too_frequent: 'Tasks may run at most once a minute. Use a longer interval.',
    syntax_error: 'The code does not parse:\n```\n{{error}}\n```',
    too_many_tasks: 'The limit of {{max}} tasks is reached. Remove one first.',
    no_channel: 'Pick a channel — this command needs one to post results to.',
    saved: 'Saved **{{name}}** and ran it once.',
    saved_disabled_cron:
      'Saved **{{name}}** but left it **disabled**, because the cron expression is unusable. Fix it with `/js-task edit` — your code is kept.',
    saved_disabled_syntax:
      'Saved **{{name}}** but left it **disabled**, because the code does not parse. Fix it with `/js-task edit` — your code is kept.',
    saved_disabled_failed:
      'Saved **{{name}}** but left it **disabled**, because the test run failed. Fix it with `/js-task edit` — your code is kept.',
    dry_run_preview: 'This is what it would post:',
    no_output: '_Returned nothing, so no message would be posted._',
    logs: 'Logs:',
    duration: 'Took {{ms}} ms.',
    next_run: 'Next run: {{when}}',
    list_empty: 'No tasks yet. Add one with `/js-task add`.',
    list_header: 'Scheduled tasks ({{count}}):',
    list_more: '_...and {{count}} more._',
    removed: 'Deleted **{{name}}** together with its stored state.',
    enabled: 'Enabled **{{name}}**. {{next}}',
    disabled: 'Disabled **{{name}}**.',
    cannot_enable:
      'Cannot enable **{{name}}**: its cron expression is unusable. Fix it with `/js-task edit` first.',
    show_header: 'Task **{{name}}**',
    show_never_run: 'Has not run yet.',
    run_failed: 'The run failed:\n```\n{{error}}\n```',
    secret_set:
      'Stored secret `{{key}}` for **{{name}}**. Read it with `store.get("secret:{{key}}")`.',
    secret_unset: 'Removed secret `{{key}}` from **{{name}}**.',
    secret_list_empty: '**{{name}}** has no secrets.',
    secret_list_header: 'Secrets of **{{name}}** (names only):',
    dm_failed: 'Task `{{name}}` reported an error:\n```\n{{error}}\n```',
    dm_channel_failed: 'Task `{{name}}` could not post to its channel.',
  },
  pl: {
    name: 'js-task',
    description: 'Uruchamia fragmenty JavaScriptu wg harmonogramu cron (tylko właściciel bota).',
    sub_add: { name: 'dodaj', description: 'Dodaje zadanie i uruchamia je raz, żeby je sprawdzić' },
    sub_edit: { name: 'edytuj', description: 'Zmienia wyrażenie cron lub kod zadania' },
    sub_list: { name: 'lista', description: 'Pokazuje wszystkie zaplanowane zadania' },
    sub_show: { name: 'pokaz', description: 'Pokazuje kod i ostatnie uruchomienie zadania' },
    sub_remove: { name: 'usun', description: 'Usuwa zadanie razem z jego zapisanym stanem' },
    sub_toggle: { name: 'przelacz', description: 'Włącza lub wyłącza zadanie' },
    sub_run: { name: 'uruchom', description: 'Uruchamia zadanie teraz, na serio' },
    sub_test: { name: 'testuj', description: 'Uruchamia kod raz, bez zapisywania' },
    group_secret: { name: 'sekret', description: 'Zarządza danymi dostępowymi zadania' },
    sub_secret_set: { name: 'ustaw', description: 'Zapisuje sekret dla zadania' },
    sub_secret_list: { name: 'lista', description: 'Pokazuje nazwy sekretów, nigdy wartości' },
    sub_secret_unset: { name: 'usun', description: 'Usuwa sekret z zadania' },
    opt_name: { name: 'nazwa', description: 'Nazwa zadania' },
    opt_channel: { name: 'kanal', description: 'Kanał, na który trafiają wyniki' },
    opt_key: { name: 'klucz', description: 'Nazwa sekretu' },
    opt_value: { name: 'wartosc', description: 'Wartość sekretu' },

    modal_add_title: 'Nowe zadanie cykliczne',
    modal_edit_title: 'Edycja zadania',
    modal_test_title: 'Jednorazowe uruchomienie kodu',
    field_name: 'Nazwa (a-z, 0-9, myślniki)',
    field_name_placeholder: 'dzienny-raport',
    field_cron: 'Wyrażenie cron',
    field_cron_placeholder: '0 9 * * 1-5',
    field_code: 'Kod JavaScript',
    field_code_placeholder: "return 'Cześć!';",

    no_permission: 'Tylko właściciel bota może zarządzać zadaniami cyklicznymi.',
    error: 'Coś poszło nie tak podczas obsługi tej komendy.',
    not_found: 'Nie ma zadania o nazwie **{{name}}**.',
    invalid_name:
      'Niepoprawna nazwa. Użyj 1-32 znaków: małe litery, cyfry i myślniki. Kod nie został zapisany — niestety nazwa jest kluczem, pod którym go przechowujemy.',
    invalid_cron: 'To nie jest poprawne wyrażenie cron.',
    too_frequent: 'Zadanie może uruchamiać się najwyżej raz na minutę. Wybierz dłuższy odstęp.',
    syntax_error: 'Kod się nie parsuje:\n```\n{{error}}\n```',
    too_many_tasks: 'Osiągnięto limit {{max}} zadań. Usuń najpierw któreś z istniejących.',
    no_channel: 'Wskaż kanał — ta komenda potrzebuje go, żeby wysyłać wyniki.',
    saved: 'Zapisano **{{name}}** i uruchomiono raz.',
    saved_disabled_cron:
      'Zapisano **{{name}}**, ale zostało **wyłączone**, bo wyrażenie cron jest nieużywalne. Popraw przez `/js-task edytuj` — Twój kod jest zachowany.',
    saved_disabled_syntax:
      'Zapisano **{{name}}**, ale zostało **wyłączone**, bo kod się nie parsuje. Popraw przez `/js-task edytuj` — Twój kod jest zachowany.',
    saved_disabled_failed:
      'Zapisano **{{name}}**, ale zostało **wyłączone**, bo testowe uruchomienie się nie udało. Popraw przez `/js-task edytuj` — Twój kod jest zachowany.',
    dry_run_preview: 'Tak wyglądałaby wysłana wiadomość:',
    no_output: '_Nic nie zwrócono, więc żadna wiadomość nie zostałaby wysłana._',
    logs: 'Logi:',
    duration: 'Zajęło {{ms}} ms.',
    next_run: 'Następne uruchomienie: {{when}}',
    list_empty: 'Nie ma jeszcze żadnych zadań. Dodaj przez `/js-task dodaj`.',
    list_header: 'Zaplanowane zadania ({{count}}):',
    list_more: '_...i jeszcze {{count}}._',
    removed: 'Usunięto **{{name}}** razem z zapisanym stanem.',
    enabled: 'Włączono **{{name}}**. {{next}}',
    disabled: 'Wyłączono **{{name}}**.',
    cannot_enable:
      'Nie można włączyć **{{name}}**: wyrażenie cron jest nieużywalne. Popraw je najpierw przez `/js-task edytuj`.',
    show_header: 'Zadanie **{{name}}**',
    show_never_run: 'Jeszcze się nie uruchomiło.',
    run_failed: 'Uruchomienie się nie udało:\n```\n{{error}}\n```',
    secret_set:
      'Zapisano sekret `{{key}}` dla **{{name}}**. Czytaj przez `store.get("secret:{{key}}")`.',
    secret_unset: 'Usunięto sekret `{{key}}` z **{{name}}**.',
    secret_list_empty: '**{{name}}** nie ma żadnych sekretów.',
    secret_list_header: 'Sekrety zadania **{{name}}** (tylko nazwy):',
    dm_failed: 'Zadanie `{{name}}` zgłosiło błąd:\n```\n{{error}}\n```',
    dm_channel_failed: 'Zadanie `{{name}}` nie mogło wysłać wiadomości na swój kanał.',
  },
} satisfies LocaleBundle<JsTaskStrings>;

export default locales;
