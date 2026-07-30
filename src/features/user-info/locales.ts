const locales = {
  'en-US': {
    name: 'user-info',
    description: 'Displays information about a user.',
    target: {
      name: 'target',
      description: 'The user you want to get information about (leave empty for yourself)',
    },
    response: '**User:** {{tag}}\n**ID:** {{id}}\n**Joined Discord:** {{createdAt}}',
  },
  pl: {
    name: 'user-info',
    description: 'Wyświetla informacje o użytkowniku.',
    target: {
      name: 'cel',
      description: 'Użytkownik, którego informacje chcesz zobaczyć (zostaw puste dla siebie)',
    },
    response: '**Użytkownik:** {{tag}}\n**ID:** {{id}}\n**Dołączył do Discorda:** {{createdAt}}',
  },
};

export default locales;
