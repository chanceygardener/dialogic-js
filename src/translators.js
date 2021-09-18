/**
 * NLG platform request translatrors
 *
 * @module translators
 */
const History = require('./history');

/**
 * @typedef {object} TranslatedRequest
 * @property {string} intent - the intent name in the NLG platform
 * @property {string} session - session path
 * @property {object} parameters - entities and contexts
 * @property {object} parameters.contexts - active contexts
 * @property {object} [history] - optional history object that
 */

/**
 * infer types of values in paramter object from NLP platform request
 *
 * @param {object} params - input parameters
 *
 * @returns {object} - parameter object w/ values wrapped in type/value objects
 */
const inferParamTypes = (params) => {
  const out = {};
  Object.keys(params).forEach((k) => {
    const param = params[k];
    // arrays in JS are just objects, so we need to pick them up w/ isArray
    // otherwise, just use native typeof function
    const type = Array.isArray(param) ? 'array' : typeof param;
    // wrap values in type/val object for condition lang.
    if (type === 'array') out[k] = { type, ...param };
    else out[k] = { type, value: param };
  });
  return out;
};

/**
 * Traslate Dialogflow requests into Dialogic format
 *
 * @param  {object} req - The Dialoflow platform request body
 *
 * @returns {TranslatedRequest} - Dialogic-compat format w/ data from Dialogflow request
 */
const handleDialogflowReq = (req) => {
  const res = {};
  // pull out intent name
  res.intent = req.queryResult.intent.displayName;
  // pull out session path
  res.session = req.session;
  // pull out params
  const { parameters } = req.queryResult;
  // pull out contexts so that we pass them back in the response
  const typeInferedParams = inferParamTypes(parameters);
  res.parameters = { ...typeInferedParams, contexts: {} };
  req.queryResult.outputContexts.forEach((c) => {
    // contexts are at the end of a long path, split by / and just get context name
    const fullContextPath = c.name.split('/').slice(-1);
    const contextName = fullContextPath[0];
    // ignore __system_counters__
    if (contextName !== '__system_counters__') {
      if (contextName === 'historyInstance') {
        res.historyInstance = new History({ ...c.parameters });
      } else {
        // create context obj by key
        const context = {
          contextName,
          ...c,
        };
        res.parameters.contexts[contextName] = context;
      }
    }
  });
  // return complete obj
  return res;
};

/**
 * Create response object to send to Dialogflow
 *
 * @param {TranslatedRequest} content - request body w/ modifications to contexts
 * @param {string} content.text - response text
 *
 * @returns {object} response body formattetd for Dialogflow
 */
const handleDialogflowRes = (content) => {
  // remove contextName key because we added that, keep original context structure
  const outputContexts = Object.keys(content.parameters.contexts).flatMap((c) => {
    const out = content.parameters.contexts[c];
    delete out.contextName;
    return out;
  });
  // if history is present, re-insert into contexts
  if (content.historyInstance) {
    const historyContextName = `${content.session}/contexts/historyInstance`;
    outputContexts.push({
      name: historyContextName,
      parameters: {
        ...content.historyInstance,
      },
    });
  }
  // create response body object
  const body = {
    fulfillmentMessages: [{ text: { text: [content.text] } }],
    outputContexts,
  };
  // return response
  return body;
};

module.exports = {
  handleDialogflowReq,
  handleDialogflowRes,
};
