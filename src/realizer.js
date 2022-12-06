// contains code for the Dialogic NLG realizer
const logger = require('bunyan').createLogger({
  name: 'realizer',
});
const { join } = require('path');
const fs = require('fs');
const {
  arraysEqual,
  readJson,
  boolStrings,
  resolveVar,
  getSubTemplateIndices,
  replaceSlice,
} = require('./utils.js');
const { importPlugins } = require('./plugins');
const { interpret, resolveVars } = require('./condition_interpreter');
const History = require('./history');

// BEGIN TEMPLATE SELECTOR HELPER FUNCTIONS
const truthinessOf = (val) => {
  const valType = typeof val;
  if (valType === 'object' && val !== null) {
    throw new Error('Object Truthiness is undefined');
  } else if (valType === 'string') {
    const boolString = boolStrings[val];
    if (boolString !== undefined) {
      return boolString;
    }
  }
  return !!val;
};

const variantMatchesCondition = (variant, env, functions) => {
  if (variant.conditions) {
    const condEval = variant.conditions
      .every(
        (condition) => {
          const resolved = resolveVars(condition, env);
          let evaluated = interpret(resolved, env, functions)[0];
          evaluated = truthinessOf(evaluated);
          return evaluated;
        },
      );
    return condEval;
  }

  return true;
};

const selectTemplateSwitch = (forms, env, functions) => forms.find(
  (variant) => variantMatchesCondition(variant, env, functions),
);

const selectTemplate = (forms, env, functions) => {
  const validVariants = [];
  forms.forEach((variant) => {
    if (variantMatchesCondition(variant, env, functions)) {
      validVariants.push(variant);
    }
  });
  return validVariants[Math.floor(
    Math.random() * validVariants.length,
  )];
};

const argIsValid = (envVal, argSpec) => {
  // TODO: support type checking here when
  // this is included in env from fulfillment request
  if (envVal === undefined && argSpec.required === true) {
    return false;
  }
  return true;
};

// END TEMPLATE SELECTOR HELPER FUNCTIONS

// BEGIN REALIZER CLASS

class NlgRealizer {
  constructor(logicPath, configObj = null, configPath = null) {
    // read all the message sets from
    // file, validate them, and
    // aggregate them into two attributes
    // 1. templates, all available templates
    // 2. schema, a unified argument validation
    // schema for each top-level
    // template, i.e., one corresponding to an intent
    // this.templateSetNames = [];
    const {
      templateLookup,
      schemaMap,
      schema,
    } = NlgRealizer.readTemplateFromDirectory(
      logicPath,
    );
    // validateMessageSetFiles(templateStruct.content, templateStruct.schema);
    // define templates attribute
    this.templates = templateLookup;
    this.schemaMap = schemaMap;
    this.schema = schema;
    // Function plugins for condition language
    this.functions = configObj.functions || importPlugins({
      configObj,
      configPath: configPath || './dialogic-config.js',
    }).functions;
    this.history = new History();
  }

  static subEnvFromCall(callString, upperEnv) {
    const subEnv = {};

    const kvPat = /(?<key>\S+)=(?<value>\S+)/g;
    let kvPair;
    /* iterate over regex matches
     indicating argument passing, e.g.,
     lowerScopeName=$upperScopeName
     then turn this into an object to
     serve as the environment for the lower
     level template */
    do {
      kvPair = kvPat.exec(callString);
      if (!kvPair) {
        break;
      } else if (kvPair.groups.key === '_env') {
        if (kvPair.groups.value === '$_env') {
          Object.assign(subEnv, upperEnv);
        } else {
          /* Make sure anything you pass as
             _env is an object */
          if (upperEnv[kvPair.groups.value]?.constructor !== Object) {
            throw new Error(`Value passed to _env must be an object type\n\tOriginal callstring: ${callString}`);
          }
          Object.assign(subEnv, upperEnv);
        }
      }
      const compoundValueMatch = /(?<root>[^\[\]\.]+)(?<calls>(\[\d*:?\d*\]|\.\w+)+)/g.exec(
        kvPair.groups.value,
      );
      let varName;

      if (compoundValueMatch) {
        /* Indicates we have one or more
        array index, slice or object lookup
        operations to perform on the variable
        in the upper environment before
        passing it down to the lower one */
        varName = (compoundValueMatch.groups.root[0] === '$') ? compoundValueMatch
          .groups.root.substring(1) : compoundValueMatch.groups.root;
        /* ok, so this feels a little hacky, so revisit this
        But we need to remove the ] that sometimes is included
        at the end of the varName match. The regex needs to be as
        such because it's the only way found thus far to
        not match template references themselves */
        if (varName.substring(varName.length - 1) === ']') {
          varName = varName.substring(0, varName.length - 1);
        }
        // logger.info(`resolving detected variable ${varName}`);

        subEnv[kvPair.groups.key] = resolveVar(varName, upperEnv,
          compoundValueMatch.groups.calls);
      } else {
        varName = (kvPair.groups.value[0] === '$') ? kvPair.groups
          .value.substring(1) : kvPair.groups.value;
        if (varName.substring(varName.length - 1) === ']') {
          varName = varName.substring(0, varName.length - 1);
        }
        // If this is a variable reference (e.g., starts with '$')
        // then we look up from upper env, otherwise just pass
        // down a hardcoded value

        if (kvPair.groups.value[0] === '$') {
          subEnv[kvPair.groups.key] = resolveVar(varName, upperEnv);
        } else {
          subEnv[kvPair.groups.key] = varName;
        }
      }
    } while (kvPair);

    return subEnv;
  }

  static readTemplateFromDirectory(path) {
    const templateLookup = {};
    const schemaMap = {};
    const schema = {};
    const messageSetCheck = {
      content: [],
      schema: [],
    };
    let scope = fs.readdirSync(path);
    if (!scope.includes('schema') || !scope.includes('content')) {
      throw new Error('Template directory must include '
      + 'content and schema directories');
    }
    // read schema
    const schemaDir = join(path, 'schema');
    if (!fs.lstatSync(join(path, 'schema')).isDirectory()
      || !fs.statSync(join(path, 'content')).isDirectory()) {
      // ensure schema and content are both directories.
      throw new Error('schema and content must both be directories');
    }
    scope = fs.readdirSync(schemaDir)
      .sort();
    let schemaFound = false;
    scope.forEach((entry) => {
      const schemaPath = join(schemaDir, entry);
      if (fs.lstatSync(schemaPath).isFile()
     && entry.endsWith('.schema.json')) {
        schemaFound = true;
        const dat = readJson(schemaPath);
        // Update the checker with schema set name
        messageSetCheck.schema.push(dat.name);
        Object.keys(dat.schema).forEach((templateKey) => {
          if (schemaMap[templateKey] !== undefined) {
            throw new Error(`Multiple schema templates found across files for key: ${templateKey}`);
          }
          schemaMap[templateKey] = dat.name;
          schema[templateKey] = dat.schema[templateKey];
        });
      }
    });
    if (!schemaFound) {
      throw new Error('No Schema files found.');
    }
    // read content files
    const contentDir = join(path, 'content');
    scope = fs.readdirSync(contentDir)
      .sort();
    scope.forEach((entry) => {
      const contentPath = join(contentDir, entry);
      if (fs.lstatSync(contentPath).isFile()
     && entry.endsWith('.template.json')) {
        const dat = readJson(contentPath);
        templateLookup[dat.name] = dat.templates;
        // A little safety rail here, we assert that
        // no template is named "import" as
        // this word is reserved because we keep
        // the import reference lookup table here
        // under that name
        Object.keys(templateLookup[dat.name])
          .forEach((templateName) => {
            if (templateName === 'import') {
              throw new Error(`Cannot name template "import", this is a reserved word. Found in domain ${dat.name}`);
            } else if (/^[\d:]+$/.test(templateName)) {
              throw new Error(`Invalid template name: ${templateName}, must contain at least one letter`);
            }
          });
        // Now we assign the import lookup table to
        // that attribute of this object
        templateLookup[dat.name].import = dat.import;
        // Update the checker with content set name
        messageSetCheck.content.push(dat.name);
      }
    });
    if (!arraysEqual(messageSetCheck.schema.sort(),
      messageSetCheck.content.sort())) {
      throw new Error('Mismatched content and schema names.');
    }
    return { templateLookup, schemaMap, schema };
  }

  validateRequestParameters(handlerName, env) {
    // for check that env corresponds to this.logic[handlerName].args
    const handlerSchema = this.schema[handlerName];
    const invalidArgs = Object.keys(handlerSchema.args)
      .filter((argName) => !argIsValid(env[argName],
        handlerSchema.args[argName]));
    if (invalidArgs.length === 0) {
      return true;
    }
    return false;
  }

  evaluateVariantText(variant, env, domain, calledFrom) {
    // Replace subtemplate invocations with their results
    let outText = replaceSlice(variant.text,
      getSubTemplateIndices(variant.text),
      (subString) => {
        const parsed = /^\[(?<subTemplate>(?<=\[)(?<templateName>[^\s\]]+)\s*(?<envCall>.*)?(?=\]))\]$/
          .exec(subString).groups;
        const subEnv = NlgRealizer.subEnvFromCall(parsed.envCall, env);
        return this.executeTemplate(parsed.templateName, subEnv, domain, calledFrom).responseText;
      });
    // then resolve variable invocations
    outText = outText.replace(/\(?\$(?<root>[^\[\]\.\)\s]+)(?<calls>(\[\d*:?\d*\]|\.\w+)+)?\)?/g,
      (match, $root, $calls) => {
        let resolved;
        if (env[$root] === undefined) {
          throw new ReferenceError(`variable ${$root} not defined in environment`);
        }
        if ($calls !== undefined) {
          resolved = resolveVar($root, env, $calls);
        } else { resolved = env[$root]; }
        return resolved;
      });
    return outText;
  }

  executeTemplate(handlerName, env, domain = null, calledFrom = null) {
    // check to see if the realizer has loaded functions
    const calledFromInfo = calledFrom || 'Request (top level)';
    logger.info(`Executing ${handlerName} with env: ${JSON.stringify(env)}`, `called from '${calledFromInfo}'`);
    if (env === undefined) {
      throw new Error(`No environment passed for ${handlerName}`);
    }
    const out = { responseText: null };

    // lookup the procedure from
    // logic schema
    const templateDomain = this.schemaMap[handlerName];
    if (templateDomain === undefined && domain === null) {
      throw new Error(`Template ${handlerName} not found in schema`);
    }
    const handlerDomain = domain === null ? templateDomain : domain;
    let intentHandler = this.templates[handlerDomain][handlerName];
    if (intentHandler === undefined) {
      // first check if this is an imported template
      if (this.templates[handlerDomain].import !== undefined) {
        this.templates[handlerDomain].import.forEach((domainImport) => {
          /*
          get the intent handler from the domain as specified
          in the import statement, which in the template set looks like:
          {
            "templates": ["importedTemplate1", "importedTemplate2"...],
            "from": "domainName"
          }
          */
          if (this.templates[domainImport.from][handlerName] !== undefined) {
            intentHandler = this.templates[domainImport.from][handlerName];
          }
        });
        if (intentHandler === undefined) {
          throw new Error(`Handling procedure for intent: ${handlerName} not found in template set or template imports.`);
        }
      } else {
        throw new Error(`Handling procedure for intent: ${handlerName} not found in template set.`);
      }
    }
    const selector = (intentHandler.switch ? selectTemplateSwitch : selectTemplate);

    const selectedVariant = selector(intentHandler.forms,
      { ...env, historyInstance: this.history }, this.functions);

    if (selectedVariant === undefined) {
      throw new Error(`No valid variant for template ${handlerName}`);
    }

    out.responseText = this.evaluateVariantText(
      selectedVariant, env, handlerDomain, handlerName,
    );

    // pull historyInstance out of env or init a new one if env doesn't contain it
    if ('historyInstance' in env) out.historyInstance = new History(env.historyInstance);
    else out.historyInstance = new History();
    // record step in history if it's a top level template
    if (handlerName in this.schema) out.historyInstance.recordStep(handlerName);
    logger.info(`\t\tRealized ${handlerName} as: '${out.responseText}'`);

    return out;
  }
}

module.exports = {
  NlgRealizer,
};
