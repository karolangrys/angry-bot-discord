const locales = {
  'en-US': {
    name: 'server-info',
    description: 'Displays information about the server.',
    not_in_guild: 'This command can only be used on a server.',
    response: '**Server:** {{name}}\n**Members:** {{memberCount}}\n**Created:** {{createdAt}}\n**Owner ID:** {{ownerId}}',
  },
  pl: {
    name: 'server-info',
    description: 'Wyświetla informacje o serwerze.',
    not_in_guild: 'Ta komenda może być użyta tylko na serwerze.',
    response: '**Serwer:** {{name}}\n**Liczba członków:** {{memberCount}}\n**Stworzony:** {{createdAt}}\n**Właściciel ID:** {{ownerId}}',
  },
};

export default locales;
