const config = {
  name: 'dialogic-dev',
  description: 'config file for dialogic development',
  // plugins maybe can have multiple types, maybe syntax extensions later on
  // default to checking modules/plugins/ directory for dir w/ same name
  // TODO: add git support, automatically import modules through git
  // TODO: remove builtins (compare-date-time, is-null), import them by default
  plugins: [
    {
      name: 'compare-date-time',
      type: 'function',
    },
    {
      name: 'is-null',
      type: 'function',
    },
    {
      name: 'length',
      type: 'function',
      arrayArg: true,
    },
    {
      name: 'thread-touched',
      type: 'function',
    },
    {
      name: 'not',
      type: 'function',
    },
  ],
};

module.exports = config;
