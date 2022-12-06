const path = require('path');
const { readFileSync } = require('fs');
const logger = require('bunyan').createLogger({
  name: 'config',
});

const supportedPluginTypes = ['function'];

const importPlugins = (configPath = './dialogic-config.js', configObj = null) => {
  let config;
  if (configObj) {
    // if config is passed as an object, use that
    config = configObj;
  } else {
    // otherwise, fetch it from dialogic.config.json
    console.log(`Dialogic config path: ${configPath}`);
    const configRaw = readFileSync(configPath, 'utf8');
    // eslint-disable-next-line no-eval
    console.log(process.cwd());
    config = eval(configRaw);
  }
  const pluginsDir = '../modules/plugins';
  // iterate through plugins, import functions into functions obj
  const functions = {};
  config.plugins.forEach(({ name, type, arrayArg }) => {
    if (supportedPluginTypes.indexOf(type) < 0) throw new Error('unsupported plugin type!');
    const pluginPath = path.join(pluginsDir, name);
    let plugin = {};
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      plugin = require(`./${pluginPath}`);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') throw new Error('plugin does not exist!');
      throw e;
    }
    const { name: funcName, func } = plugin;
    /* add the function to the function
    object, as well as a boolean flag
    indicating whether a sequence argument passed
    to it need be destructured */
    functions[funcName] = { function: func, arrayArg };
  });
  // return function obj
  return {
    functions,
    serverConfig: config.server,
  };
};

module.exports = {
  importPlugins,
};
