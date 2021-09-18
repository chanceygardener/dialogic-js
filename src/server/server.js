const { lstatSync, existsSync } = require('fs');
const logger = require('bunyan').createLogger({
  name: 'server',
});
const { ArgumentParser } = require('argparse');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { NlgRealizer } = require('../realizer.js');

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
  logger.info();
  p = 'templates';
}

const templatePath = path.resolve(p);
if (!(existsSync(templatePath) && lstatSync(templatePath).isDirectory())) {
  throw new Error(`Invalid template directory path: ${templatePath}`);
}

const realizer = new NlgRealizer(templatePath);
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
    const responseDat = JSON.stringify({
      response: nlgResponse.responseText,
      success: true,
    });
    res.send(responseDat);
    logger.info(`returned '${nlgResponse.responseText}' for template ${rdat.templateName}`);
  } catch (e) {
    logger.error(`NLG request for ${rdat.templateName} failed with ${e}`);
    res.send(JSON.stringify({
      response: e,
      success: false,
    }));
  }
});
logger.info(`Dialogic server listening on port ${port}`);
app.listen(port);
