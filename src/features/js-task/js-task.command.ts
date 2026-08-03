import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
  type APIEmbed,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { createLocalizedCommand } from '../../core/command-builder';
import { getT } from '../../core/i18n';
import { isBotOwner } from '../../core/permissions';
import locales, { NAMESPACE } from './locales';
import { runInSandbox, validateSyntax, type SandboxOutcome } from './sandbox';
import {
  nextRunOf,
  runTask,
  scheduleTask,
  startScheduler,
  unscheduleTask,
  validateCron,
} from './scheduler';
import {
  deleteTask,
  getTask,
  listSecretKeys,
  listTasks,
  MAX_CODE_LENGTH,
  MAX_TASKS,
  NAME_PATTERN,
  SECRET_PREFIX,
  setEnabled,
  storeSet,
  storeUnset,
  upsertTask,
} from './tasks';

type Strings = (typeof locales)['en-US'];
const en: Strings = locales['en-US'];

/** Canonical (default-locale) names; `getSubcommand()` returns these whatever the user's language. */
const SUB = {
  add: en.sub_add.name,
  edit: en.sub_edit.name,
  list: en.sub_list.name,
  show: en.sub_show.name,
  remove: en.sub_remove.name,
  toggle: en.sub_toggle.name,
  run: en.sub_run.name,
  test: en.sub_test.name,
  secretSet: en.sub_secret_set.name,
  secretList: en.sub_secret_list.name,
  secretUnset: en.sub_secret_unset.name,
} as const;

const FIELD = { name: 'name', cron: 'cron', code: 'code' } as const;

/** Leaves room for the surrounding wording within Discord's 2000-character message limit. */
const MAX_REPLY_CHARS = 1_900;
const MAX_LOG_CHARS_SHOWN = 700;

const clamp = (text: string, max = MAX_REPLY_CHARS): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

// --- command definition -----------------------------------------------------------------------

const named = (
  option: { name: string; description: string },
  pl: { name: string; description: string },
) => ({ ...option, pl }) as const;

const nameOption = named(en.opt_name, locales.pl.opt_name);

export const data = createLocalizedCommand(locales)
  // Hides it from regular members. The owner check in `execute` is the actual authorisation.
  .setDefaultMemberPermissions(0)
  .addSubcommand((sub) =>
    sub
      .setName(en.sub_add.name)
      .setDescription(en.sub_add.description)
      .setNameLocalizations({ pl: locales.pl.sub_add.name })
      .setDescriptionLocalizations({ pl: locales.pl.sub_add.description })
      .addChannelOption((option) =>
        option
          .setName(en.opt_channel.name)
          .setDescription(en.opt_channel.description)
          .setNameLocalizations({ pl: locales.pl.opt_channel.name })
          .setDescriptionLocalizations({ pl: locales.pl.opt_channel.description })
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName(en.sub_edit.name)
      .setDescription(en.sub_edit.description)
      .setNameLocalizations({ pl: locales.pl.sub_edit.name })
      .setDescriptionLocalizations({ pl: locales.pl.sub_edit.description })
      .addStringOption((option) =>
        option
          .setName(nameOption.name)
          .setDescription(nameOption.description)
          .setNameLocalizations({ pl: nameOption.pl.name })
          .setDescriptionLocalizations({ pl: nameOption.pl.description })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName(en.sub_list.name)
      .setDescription(en.sub_list.description)
      .setNameLocalizations({ pl: locales.pl.sub_list.name })
      .setDescriptionLocalizations({ pl: locales.pl.sub_list.description }),
  )
  .addSubcommand((sub) =>
    sub
      .setName(en.sub_test.name)
      .setDescription(en.sub_test.description)
      .setNameLocalizations({ pl: locales.pl.sub_test.name })
      .setDescriptionLocalizations({ pl: locales.pl.sub_test.description }),
  );

for (const [key, strings] of [
  ['show', en.sub_show],
  ['remove', en.sub_remove],
  ['toggle', en.sub_toggle],
  ['run', en.sub_run],
] as const) {
  const plStrings = locales.pl[`sub_${key}` as const];
  data.addSubcommand((sub) =>
    sub
      .setName(strings.name)
      .setDescription(strings.description)
      .setNameLocalizations({ pl: plStrings.name })
      .setDescriptionLocalizations({ pl: plStrings.description })
      .addStringOption((option) =>
        option
          .setName(nameOption.name)
          .setDescription(nameOption.description)
          .setNameLocalizations({ pl: nameOption.pl.name })
          .setDescriptionLocalizations({ pl: nameOption.pl.description })
          .setRequired(true),
      ),
  );
}

data.addSubcommandGroup((group) =>
  group
    .setName(en.group_secret.name)
    .setDescription(en.group_secret.description)
    .setNameLocalizations({ pl: locales.pl.group_secret.name })
    .setDescriptionLocalizations({ pl: locales.pl.group_secret.description })
    .addSubcommand((sub) =>
      sub
        .setName(en.sub_secret_set.name)
        .setDescription(en.sub_secret_set.description)
        .setNameLocalizations({ pl: locales.pl.sub_secret_set.name })
        .setDescriptionLocalizations({ pl: locales.pl.sub_secret_set.description })
        .addStringOption((option) =>
          option
            .setName(nameOption.name)
            .setDescription(nameOption.description)
            .setNameLocalizations({ pl: nameOption.pl.name })
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName(en.opt_key.name)
            .setDescription(en.opt_key.description)
            .setNameLocalizations({ pl: locales.pl.opt_key.name })
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName(en.opt_value.name)
            .setDescription(en.opt_value.description)
            .setNameLocalizations({ pl: locales.pl.opt_value.name })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName(en.sub_secret_list.name)
        .setDescription(en.sub_secret_list.description)
        .setNameLocalizations({ pl: locales.pl.sub_secret_list.name })
        .setDescriptionLocalizations({ pl: locales.pl.sub_secret_list.description })
        .addStringOption((option) =>
          option
            .setName(nameOption.name)
            .setDescription(nameOption.description)
            .setNameLocalizations({ pl: nameOption.pl.name })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName(en.sub_secret_unset.name)
        .setDescription(en.sub_secret_unset.description)
        .setNameLocalizations({ pl: locales.pl.sub_secret_unset.name })
        .setDescriptionLocalizations({ pl: locales.pl.sub_secret_unset.description })
        .addStringOption((option) =>
          option
            .setName(nameOption.name)
            .setDescription(nameOption.description)
            .setNameLocalizations({ pl: nameOption.pl.name })
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName(en.opt_key.name)
            .setDescription(en.opt_key.description)
            .setNameLocalizations({ pl: locales.pl.opt_key.name })
            .setRequired(true),
        ),
    ),
);

// --- shared rendering -------------------------------------------------------------------------

type Translate = Awaited<ReturnType<typeof getT>>;

/**
 * Renders a run for the person who triggered it. Used by the dry run, `/js-task run` and
 * `/js-task test`, so all three look the same — including the embeds, so the owner sees exactly
 * what would land on the channel.
 */
function renderOutcome(
  t: Translate,
  outcome: SandboxOutcome,
): { content: string; embeds?: APIEmbed[] } {
  const lines: string[] = [];
  let embeds: APIEmbed[] | undefined;

  if (!outcome.ok) {
    lines.push(t('run_failed', { error: clamp(outcome.error, 900) }));
  } else if (!outcome.message) {
    lines.push(t('no_output'));
  } else {
    lines.push(t('dry_run_preview'));
    if (outcome.message.content) {
      lines.push(outcome.message.content);
    }
    embeds = outcome.message.embeds;
  }

  if (outcome.logs.length > 0) {
    lines.push(
      `${t('logs')}\n\`\`\`\n${clamp(outcome.logs.join('\n'), MAX_LOG_CHARS_SHOWN)}\n\`\`\``,
    );
  }
  lines.push(t('duration', { ms: outcome.durationMs }));

  return { content: clamp(lines.join('\n')), embeds };
}

const nextRunText = (t: Translate, name: string): string => {
  const next = nextRunOf(name);
  return next ? t('next_run', { when: time(next, 'f') }) : '';
};

// --- execute ----------------------------------------------------------------------------------

export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  if (!(await isBotOwner(interaction))) {
    await interaction.reply({ content: t('no_permission'), flags: MessageFlags.Ephemeral });
    return;
  }

  // Checked before getSubcommand(): with a group present, the plain subcommand name is ambiguous.
  if (interaction.options.getSubcommandGroup(false) === en.group_secret.name) {
    await handleSecret(interaction, t);
    return;
  }

  switch (interaction.options.getSubcommand()) {
    case SUB.add:
      await handleAdd(interaction, t);
      return;
    case SUB.edit:
      await handleEdit(interaction, t);
      return;
    case SUB.test:
      await interaction.showModal(buildTestModal(t));
      return;
    case SUB.list:
      await handleList(interaction, t);
      return;
    case SUB.show:
      await handleShow(interaction, t);
      return;
    case SUB.remove:
      await handleRemove(interaction, t);
      return;
    case SUB.toggle:
      await handleToggle(interaction, t);
      return;
    case SUB.run:
      await handleRun(interaction, t);
      return;
    default:
      await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral });
  }
};

async function handleAdd(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  if ((await listTasks()).length >= MAX_TASKS) {
    await interaction.reply({
      content: t('too_many_tasks', { max: MAX_TASKS }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId =
    interaction.options.getChannel(en.opt_channel.name)?.id ?? interaction.channelId;
  if (!channelId) {
    await interaction.reply({ content: t('no_channel'), flags: MessageFlags.Ephemeral });
    return;
  }

  // A modal IS the response to the interaction, so this must not be preceded by deferReply.
  await interaction.showModal(buildTaskModal(t, `${en.name}:${SUB.add}:${channelId}`, null));
}

async function handleEdit(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  const task = await getTask(name);
  if (!task) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.showModal(buildTaskModal(t, `${en.name}:${SUB.edit}:${name}`, task));
}

async function handleList(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const tasks = await listTasks();
  if (tasks.length === 0) {
    await interaction.reply({ content: t('list_empty'), flags: MessageFlags.Ephemeral });
    return;
  }

  const header = t('list_header', { count: tasks.length });
  const lines: string[] = [];
  let shown = 0;

  for (const task of tasks) {
    const next = nextRunOf(task.name);
    const line = `${task.enabled ? '🟢' : '⚪'} **${task.name}** — \`${task.cron}\`${
      next ? ` · ${time(next, 'R')}` : ''
    }`;
    // Rendered incrementally rather than joined blindly: 50 tasks would overflow a message.
    if (header.length + lines.join('\n').length + line.length > MAX_REPLY_CHARS) {
      break;
    }
    lines.push(line);
    shown += 1;
  }

  const remaining = tasks.length - shown;
  const body = [header, ...lines, ...(remaining > 0 ? [t('list_more', { count: remaining })] : [])];
  await interaction.reply({ content: body.join('\n'), flags: MessageFlags.Ephemeral });
}

async function handleShow(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  const task = await getTask(name);
  if (!task) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = [
    t('show_header', { name }),
    `\`${task.cron}\` · ${task.enabled ? t('enabled', { name, next: '' }) : t('disabled', { name })}`,
    nextRunText(t, name),
    task.lastRunAt ? time(task.lastRunAt, 'f') : t('show_never_run'),
    ...(task.lastError ? [`⚠️ \`${clamp(task.lastError, 300)}\``] : []),
    ...(task.lastResult ? [`→ ${clamp(task.lastResult, 300)}`] : []),
    `\`\`\`js\n${clamp(task.code, 1200)}\n\`\`\``,
  ].filter((line) => line.length > 0);

  // Ephemeral without exception: the code may contain credentials pasted despite the advice.
  await interaction.reply({ content: clamp(lines.join('\n')), flags: MessageFlags.Ephemeral });
}

async function handleRemove(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  if (!(await getTask(name))) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }
  unscheduleTask(name);
  await deleteTask(name);
  await interaction.reply({ content: t('removed', { name }), flags: MessageFlags.Ephemeral });
}

async function handleToggle(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  const task = await getTask(name);
  if (!task) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }

  if (task.enabled) {
    unscheduleTask(name);
    await setEnabled(name, false);
    await interaction.reply({ content: t('disabled', { name }), flags: MessageFlags.Ephemeral });
    return;
  }

  // Re-validated on the way in: a task saved with a broken expression must not be schedulable.
  const cron = validateCron(task.cron);
  if (!cron.ok) {
    await interaction.reply({
      content: t('cannot_enable', { name }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await setEnabled(name, true);
  scheduleTask(interaction.client, name, task.cron);
  await interaction.reply({
    content: t('enabled', { name, next: nextRunText(t, name) }),
    flags: MessageFlags.Ephemeral,
  });
}

async function handleRun(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  if (!(await getTask(name))) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }

  // The sandbox may take up to 10s; the interaction has to be acknowledged within 3s.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const outcome = await runTask(interaction.client, name, 'manual');
  await interaction.editReply(
    outcome ? renderOutcome(t, outcome) : { content: t('not_found', { name }) },
  );
}

async function handleSecret(interaction: ChatInputCommandInteraction, t: Translate): Promise<void> {
  const name = interaction.options.getString(nameOption.name, true);
  if (!(await getTask(name))) {
    await interaction.reply({ content: t('not_found', { name }), flags: MessageFlags.Ephemeral });
    return;
  }

  switch (interaction.options.getSubcommand()) {
    case SUB.secretSet: {
      const key = interaction.options.getString(en.opt_key.name, true);
      const value = interaction.options.getString(en.opt_value.name, true);
      await storeSet(name, `${SECRET_PREFIX}${key}`, value);
      // The value is never echoed back, which is the whole point of storing it outside the code.
      await interaction.reply({
        content: t('secret_set', { name, key }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    case SUB.secretUnset: {
      const key = interaction.options.getString(en.opt_key.name, true);
      await storeUnset(name, `${SECRET_PREFIX}${key}`);
      await interaction.reply({
        content: t('secret_unset', { name, key }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    default: {
      const keys = await listSecretKeys(name);
      const content =
        keys.length === 0
          ? t('secret_list_empty', { name })
          : `${t('secret_list_header', { name })}\n${keys.map((key) => `• \`${key}\``).join('\n')}`;
      await interaction.reply({ content: clamp(content), flags: MessageFlags.Ephemeral });
    }
  }
}

// --- modals -----------------------------------------------------------------------------------

const row = (input: TextInputBuilder) =>
  new ActionRowBuilder<TextInputBuilder>().addComponents(input);

function codeInput(t: Translate, value: string | null): TextInputBuilder {
  const input = new TextInputBuilder()
    .setCustomId(FIELD.code)
    .setLabel(t('field_code'))
    .setPlaceholder(t('field_code_placeholder'))
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(MAX_CODE_LENGTH)
    .setRequired(true);
  return value ? input.setValue(value) : input;
}

/** For `add` the name is typed; for `edit` it comes from the customId, so the field is omitted. */
function buildTaskModal(
  t: Translate,
  customId: string,
  existing: { cron: string; code: string } | null,
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(existing ? t('modal_edit_title') : t('modal_add_title'));

  if (!existing) {
    modal.addComponents(
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.name)
          .setLabel(t('field_name'))
          .setPlaceholder(t('field_name_placeholder'))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32)
          .setRequired(true),
      ),
    );
  }

  const cron = new TextInputBuilder()
    .setCustomId(FIELD.cron)
    .setLabel(t('field_cron'))
    .setPlaceholder(t('field_cron_placeholder'))
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  modal.addComponents(
    row(existing ? cron.setValue(existing.cron) : cron),
    row(codeInput(t, existing?.code ?? null)),
  );
  return modal;
}

function buildTestModal(t: Translate): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${en.name}:${SUB.test}`)
    .setTitle(t('modal_test_title'))
    .addComponents(row(codeInput(t, null)));
}

// --- modal submissions ------------------------------------------------------------------------

export const handleModal = async (interaction: ModalSubmitInteraction): Promise<void> => {
  const t = await getT(interaction, NAMESPACE);

  // Re-checked deliberately: the customId comes from the client and proves nothing.
  if (!(await isBotOwner(interaction))) {
    await interaction.reply({ content: t('no_permission'), flags: MessageFlags.Ephemeral });
    return;
  }

  // The dry run can take as long as the sandbox timeout, far beyond the 3s ack window.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [, action, argument] = interaction.customId.split(':');

  if (action === SUB.test) {
    await submitTest(interaction, t);
    return;
  }
  if (action === SUB.add || action === SUB.edit) {
    await submitTask(interaction, t, action, argument ?? '');
    return;
  }
  await interaction.editReply({ content: t('error') });
};

async function submitTest(interaction: ModalSubmitInteraction, t: Translate): Promise<void> {
  const code = interaction.fields.getTextInputValue(FIELD.code);

  const syntax = validateSyntax(code);
  if (!syntax.ok) {
    await interaction.editReply({ content: t('syntax_error', { error: syntax.error }) });
    return;
  }

  // A scratchpad run has no task to key storage to, so it gets a throwaway map.
  const scratch = new Map<string, string>();
  const outcome = await runInSandbox(code, {
    trigger: 'test',
    store: {
      get: async (key) => scratch.get(key) ?? null,
      set: async (key, value) => {
        scratch.set(key, value);
      },
    },
  });

  await interaction.editReply(renderOutcome(t, outcome));
}

/**
 * Saves a task, then runs it once to prove it works.
 *
 * Every failure path still stores the row: a modal cannot be reopened with its contents, so
 * rejecting the save would throw away the code the author just wrote. Broken tasks are stored
 * disabled instead, and `/js-task edit` brings the code back for fixing.
 */
async function submitTask(
  interaction: ModalSubmitInteraction,
  t: Translate,
  action: string,
  argument: string,
): Promise<void> {
  const isEdit = action === SUB.edit;
  const cron = interaction.fields.getTextInputValue(FIELD.cron).trim();
  const code = interaction.fields.getTextInputValue(FIELD.code);
  const name = isEdit ? argument : interaction.fields.getTextInputValue(FIELD.name).trim();

  if (!NAME_PATTERN.test(name)) {
    // The only path that cannot save: the name is the primary key we would store it under.
    await interaction.editReply({ content: t('invalid_name') });
    return;
  }

  const existing = await getTask(name);
  const channelId = isEdit ? existing?.channelId : argument;
  if (!channelId) {
    await interaction.editReply({ content: isEdit ? t('not_found', { name }) : t('no_channel') });
    return;
  }

  const syntax = validateSyntax(code);
  const cronCheck = validateCron(cron);
  const blocked = !syntax.ok || !cronCheck.ok;

  await upsertTask({
    name,
    cron,
    code,
    channelId,
    enabled: !blocked,
    createdBy: interaction.user.id,
  });

  if (!syntax.ok) {
    unscheduleTask(name);
    await interaction.editReply({
      content: clamp(
        `${t('saved_disabled_syntax', { name })}\n${t('syntax_error', { error: syntax.error })}`,
      ),
    });
    return;
  }

  if (!cronCheck.ok) {
    unscheduleTask(name);
    const reason = cronCheck.reason === 'too_frequent' ? t('too_frequent') : t('invalid_cron');
    await interaction.editReply({
      content: `${t('saved_disabled_cron', { name })}\n${reason}`,
    });
    return;
  }

  const outcome = await runTask(interaction.client, name, 'dry-run');

  if (!outcome || !outcome.ok) {
    unscheduleTask(name);
    await setEnabled(name, false);
    const rendered = outcome ? renderOutcome(t, outcome) : { content: t('error') };
    await interaction.editReply({
      content: clamp(`${t('saved_disabled_failed', { name })}\n${rendered.content}`),
      embeds: [],
    });
    return;
  }

  scheduleTask(interaction.client, name, cron);
  const rendered = renderOutcome(t, outcome);
  await interaction.editReply({
    content: clamp(
      [t('saved', { name }), nextRunText(t, name), rendered.content].filter(Boolean).join('\n'),
    ),
    embeds: rendered.embeds ?? [],
  });
}

/** Restores the schedule after a restart; see the `onReady` hook on the Command interface. */
export const onReady = startScheduler;
