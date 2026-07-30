const locales = {
  'en-US': {
    name: 'status',
    description: 'Changes the bot status (administrators only).',
    opis: {
      name: 'description',
      description: 'The status description (e.g. "Playing a game")',
    },
    no_permission: 'You do not have permission to change the bot status.',
    success: 'Successfully changed the bot status to: **{{opis}}**',
    error: 'An error occurred while changing the status.',
  },
  pl: {
    name: 'status',
    description: 'Zmienia status bota (tylko dla administratorów).',
    opis: {
      name: 'opis',
      description: 'Opis statusu (np. "Gram w grę")',
    },
    no_permission: 'Nie masz uprawnień do zmiany statusu bota.',
    success: 'Pomyślnie zmieniono status bota na: **{{opis}}**',
    error: 'Wystąpił błąd podczas zmiany statusu.',
  },
};

export default locales;
