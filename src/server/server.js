const { lstatSync, existsSync } = require('fs');
const logger = require('bunyan').createLogger({
  name: 'server',
});
const { ArgumentParser } = require('argparse');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { NlgRealizer } = require('../realizer.js');
const { importPlugins } = require('../plugins');

const port = process.env.PORT || 5050;
const argHandler = ArgumentParser();
argHandler.addArgument('templates', {
  action: 'append',
  nargs: '?',
});
logger.info('Starting Server');
const args = argHandler.parseArgs();
const app = express();
app.use(bodyParser.json());
// Load, validate and apply server config
const config = importPlugins();
// console.log(JSON.stringify(config, null, 4))

/**
 * Get path to to template
 * set for NLG service
 */

let p;
if (args.templates[0]) {
  [p] = args.templates;
  logger.info('Using template path specified at entrypoint: ', args.templates[0]);
} else if (process.env.DIALOGIC_TEMPLATE_PATH) {
  logger.info(`Using path specified in environment at ${process.env.DIALOGIC_TEMPLATE_PATH}`);
  p = process.env.DIALOGIC_TEMPLATE_PATH;
} else {
  logger.info('Using default path ./templates');
  p = 'templates';
}

const templatePath = path.resolve(p);
if (!(existsSync(templatePath) && lstatSync(templatePath).isDirectory())) {
  throw new Error(`Invalid template directory path: ${templatePath}`);
}

const realizer = new NlgRealizer(templatePath, config);
app.get('/', (req, res) => {
  res.send('\nHello from dialogic!\n');
});
app.post('/nlg', (req, res) => {
  const rdat = req.body;
  logger.info(`Received NLG request for template: ${rdat.templateName}`, `env: ${JSON.stringify(rdat.env)}`);
  try {
    const nlgResponse = realizer.executeTemplate(
      rdat.templateName, rdat.env,
    );
    let responseDat = {
      response: nlgResponse.responseText,
      success: true,
    };
    config.serverConfig.responseTranslators.forEach((translator) => {
      logger.info(`Applying ${translator.name} to outgoing response`);
      let f;
      if (translator.funcObj) {
        logger.info(`Found function object for ${translator.name}`);
        f = translator.funcObj;
      } else if (translator.funcPath) {
        logger.info(`Found module path to import for ${translator.name}`);
        try {
          f = require(translator.funcPath);
        } catch (e) {
          logger.error(`Failed to import function for response translator '${translator.name}' Failed with ${e}. Not running this translator`);
          f = (t) => t;
        }
      } else {
        logger.warn(`Response translator '${translator.name}' had no procedure defined, running no translators.`);
        f = (t) => t;
      }
      try {
        responseDat = f(responseDat);
      } catch (e) {
        logger.error(`Response translator '${translator.name}' failed with ${e}. Skipping`);
      }
    });
    res.send(JSON.stringify(responseDat));
    logger.info(`returned '${nlgResponse.responseText}' for template ${rdat.templateName}`);
  } catch (e) {
    logger.error(`NLG request for ${rdat.templateName} failed with ${e}`);
    // TODO: add default error NLG template in config
    res.send(JSON.stringify({
      response: e,
      success: false,
    }));
  }
});
logger.info(`Dialogic server listening on port ${port}`);
app.listen(port);
