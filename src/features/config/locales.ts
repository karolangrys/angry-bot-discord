const locales = {
  'en-US': {
    name: 'config',
    description: 'Server configuration commands.',
    language: {
      name: 'language',
      description: 'Change the bot language on this server.',
      lang_option: 'language',
      lang_desc: 'Select the language',
    },
    no_permission: 'You do not have permission to change server configuration.',
    success: 'Language has been successfully changed to: {{lang}}.',
    error: 'An error occurred while saving the configuration.',
  },
  pl: {
    name: 'config',
    description: 'Komendy konfiguracyjne serwera.',
    language: {
      name: 'jezyk',
      description: 'Zmienia język bota na tym serwerze.',
      lang_option: 'wybor',
      lang_desc: 'Wybierz język',
    },
    no_permission: 'Nie masz uprawnień do zmiany konfiguracji serwera.',
    success: 'Pomyślnie zmieniono język bota na: {{lang}}.',
    error: 'Wystąpił błąd podczas zapisywania konfiguracji.',
  },
};

export default locales;
