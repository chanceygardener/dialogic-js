const {
  handleRasaNlgReq,
  handleRasaNlgResp,
} = require('./translators');

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
  server: {
    requestTranslators: [
    /*
     These will be applied to the
     dialogic server as middleware
     in the order in which they are
     declared in this array. Each
     request translator plugin should
     contain the following keys:
     ONE OF [ functionObj, functionPath ]
       * functionObj: a javascript function
     object either defined in or imported
     into this file.
       * functionPath: the path to a javascript
       module that exports this function as default

     name: An identifier for this translator, primarily
     for logging purposes

     description (optional) a brief description of what
     this request translator does

    */
      {
        name: 'rasaNlgRequestTranslator',
        description: 'Translates incoming rasa NLG server requests into dialogic request format',
        funcObj: handleRasaNlgReq,
      },
    ],
    responseTranslators: [
      {
        name: 'rasaNlgResponseTranslator',
        description: 'Translates outgoing dialogic web server respones to the format expected by rasa from an NLG server',
        funcObj: handleRasaNlgResp,
      },
    ],
  },
};

module.exports = config;
