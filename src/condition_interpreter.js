// contains the logic for the interpreter
// of the dialogic condition mini language
const logger = require('bunyan').createLogger({
  name: 'condition-interpreter',
});
const { boolStrings } = require('./utils');
const History = require('./history');

/**
 * condition mini-language interpreter
 *
 * @module condition_interpreter
 */

// type parser regex patterns
const stringIDPat = /^["'`].*["'`]$/;
const parenIDPat = /[(|)]/;
const varIDPat = /\$(\w+)/;
const dotArgIDPat = /\.(\w+)/;
const arrayIDPat = /\[([^\]]+)\]/;

const operators = {
  '==': (x, y) => x === y,
  '!=': (x, y) => x !== y,
  '<': (x, y) => x < y,
  '>': (x, y) => x > y,
  '>=': (x, y) => x >= y,
  '<=': (x, y) => x <= y,
  '&&': (x, y) => x && y,
  '+': (x, y) => x + y,
  '-': (x, y) => x - y,
  '*': (x, y) => x * y,
  '**': (x, y) => x ** y,
  '/': (x, y) => x / y,
  '||': (x, y) => x || y,
  '%': (x, y) => x % y,
};

const OOO = [
  '**',
  '*',
  '/',
  '%',
  '+',
  '-',
  '==',
  '!=',
  '>',
  '<',
  '<=',
  '>=',
  '&&',
  '||',
];

/* ##### BEGIN HELPER FUNCTIONS ##### */
const idToken = (token, env = {}) => {
  // resolve integers and floats
  const numCheck = parseFloat(token);
  if (!Number.isNaN(numCheck)) return numCheck;

  // resolve operators
  const opCheck = operators[token];
  if (opCheck) return opCheck;

  // resolve booleans
  const boolCheck = boolStrings[token];
  if (boolCheck !== undefined) return boolCheck;

  // resolve strings
  if (stringIDPat.test(token)) return token.slice(1, -1);

  // resolve parantheses
  if (parenIDPat.test(token)) return token;

  if (varIDPat.test(token)) {
    const varLookup = env[token.slice(1)];
    // resolve variables if they are in env arg
    if (varLookup !== undefined) {
      return varLookup;
    }
  }
  // assume string, because this function is called
  // in interpret, which is called after resolveVars
  // strings may be unquoted
  return token;
};

const execBinOp = (f, x, y, env) => {
  const xtok = idToken(x, env);
  const ytok = idToken(y, env);
  if (typeof xtok === 'function' || typeof ytok === 'function') {
    throw new Error('Consecutive binary operators found in condition statement');
  }
  return String(f(xtok, ytok));
};

// helper function to verify the number of enclosing tokens e.g. ( ), { } have open/close matches
const checkEnclosedCount = (openPat, closedPat, tokens) => {
  // if we have a different number of open and close paren, throw syntax error
  const openParenCount = tokens.filter((t) => openPat.test(t)).length;
  const closeParenCount = tokens.filter((t) => closedPat.test(t)).length;
  if (openParenCount !== closeParenCount) throw new SyntaxError('mismatched number of enclosing symbols!');
  return openParenCount;
};

// helper function to find enclosing tokens e.g. ( ... ), { ... }
const findEnclosed = (openPat, closePat, tokens) => tokens.flatMap((t, i) => {
  if (openPat.test(t)) return { type: 'open', index: i };
  if (closePat.test(t)) return { type: 'close', index: i };
  return [];
});
/* ##### END HELPER FUNCTIONS ##### */

/* ##### BEGIN TOKENIZER ##### */

const shiftToken = (tokens, buff) => {
  let outBuff = buff;
  if (outBuff !== '') {
    tokens.push(outBuff);
    outBuff = '';
  }
  return outBuff;
};
const tokenize = (expr) => {
  const out = [];
  const toParse = expr.split('');
  let tokenBuff = '';
  let char;
  let inString = null;
  while (toParse.length > 0) {
    // grab the 1st character
    // off what's left unparsed
    char = toParse.shift();
    // if we're in a string, add
    // the space to the token,
    // otherwise shift token buffer
    // and throw away the space
    if (/\s/.test(char)) {
      if (inString === null) {
        tokenBuff = shiftToken(out, tokenBuff);
      } else {
        tokenBuff += char;
      }
    } else if (/[)({}:]/.test(char) && inString === null) {
      // we encounter a bracket either as either
      // the beginning of an array which is
      // preceded by whitespace so
      // for well formed input the token
      // buffer should be empty
      // or as indexing, which follows
      // tokens immediately, requiring
      // the token buffer to be shifted.
      // before adding the bracket as
      // its own token
      tokenBuff = shiftToken(out, tokenBuff);
      out.push(char);
      // if we encounter a quote,
      // determine whether we're in
      // a string or not and
      // store the specific open quote
    } else if (/['"`\[\]]/.test(char)) {
      if (char === '[' && inString === null) tokenBuff = shiftToken(out, tokenBuff);
      if (inString === null) {
        tokenBuff += char;
        inString = char;
        // character so we know where to close
        // include the enclosing
        // quote chars in a string
        // so we can identify the token
        // as a string in the interpreter.
        // TODO: revisit that decision.
        // and shift the token buffer
      } else if (inString === char || (inString === '[' && char === ']')) {
        inString = null;
        tokenBuff += char;
        tokenBuff = shiftToken(out, tokenBuff);
      } else {
        tokenBuff += char;
      }
    } else {
      tokenBuff += char;
    }
  }
  // add final token
  tokenBuff = shiftToken(out, tokenBuff);
  return out;
};
/* ##### END TOKENIZER ##### */

/* ##### BEGIN INTERPRETER ##### */
const checkForObjComparisons = (tokens) => {
  // direct comparisons of objects is not allowed, throw an error instructing
  // user to use dot notation to reduce value or use a comparison function that accepts objects
  tokens.map((t, i) => {
    if (typeof t === 'object') {
      const possiblyOperator = tokens[i + 1];
      const possiblyObj = tokens[i + 2];
      const isOperation = OOO.indexOf(possiblyOperator) > -1;
      const isObj = typeof possiblyObj === 'object';
      if (isOperation && isObj) {
        throw new SyntaxError(
          'direct comparison of objects is not permitted! use dot notation to resolve value or a comparison function',
        );
      }
    } return true;
  });
};

const interpretObjects = (tokens) => {
  // first, we need to gather all of the keys/indexes/slices that modify other obj/arrays
  // and compile a keys array in the modified object
  let modifyingIndex = null;
  const groupedObjTokens = [];
  tokens.forEach((token) => {
    if (token !== null && typeof token === 'object') {
      if (token.type === 'date') {
        // Because dates can be consecutive tokens
        // in the CompareDateTime function,
        // update modifying index regardless of whether
        // or not it is null
        // TODO: revisit this.
        groupedObjTokens.push(token);
        modifyingIndex = groupedObjTokens.length - 1;
      } else if ((token.type === 'object' || token.type === 'array') && modifyingIndex === null) {
        // if we encounter an object, reset modifyingIndex
        // if we encounter an array *and* modifyingIndex is null, reset modifyingIndex
        // this is because array types can also act as index refs for other arrays
        groupedObjTokens.push(token);
        modifyingIndex = groupedObjTokens.length - 1;
      } else if (token.type === 'key' || token.type === 'array') {
        // push key values to key array in the obj we are modifying
        if (modifyingIndex !== null && 'keys' in groupedObjTokens[modifyingIndex] === false) groupedObjTokens[modifyingIndex].keys = [];
        // grab from value key or first index of array
        // ignore the rest of the array contents for index (same behavior as js)
        const val = token.value || token[0];
        groupedObjTokens[modifyingIndex].keys.push(val);
      } else if (token.type === 'slice') {
        // push key values to key array in the obj we are modifying
        if ('keys' in groupedObjTokens[modifyingIndex] === false) groupedObjTokens[modifyingIndex].keys = [];
        // push slice to keys array in modifyingObject
        groupedObjTokens[modifyingIndex].keys.push(token);
      } else { logger.info(`Unrecognized object token type: ${JSON.stringify(token)}, type: ${token.type}`); }
    } else {
      // if we encounter a non-object token, clear modifyingIndex
      groupedObjTokens.push(token);
      modifyingIndex = null;
    }
  });
  const objInterpretedTokens = groupedObjTokens.flatMap((token) => {
    if (token !== null && typeof token === 'object' && 'keys' in token) {
      // recursively resolve object output
      // recursively invoke chain of sub-methods and return output as token
      const invokeMethods = (keys, recursiveInput, i = 0) => {
        const key = keys[i];
        let recursiveOutput;
        if (typeof key === 'object' && 'type' in key && key.type === 'slice') {
          // get array values using array rest operator
          const { keys: arrayKeys, ...modifyingArray } = recursiveInput;
          // need to insert length key to make an "array-like" object
          modifyingArray.length = Object.keys(modifyingArray).length;
          // create Array instance from array-like object
          const arr = Array.from(modifyingArray);
          // slice array using start and end indexes
          recursiveOutput = arr.slice(key.start, key.end);
          // if input is a function, run the function and set output to the returned val
        } else if (typeof recursiveInput[key] === 'function') recursiveOutput = recursiveInput[key]();
        // if input is an object/array, just fetch the value
        else recursiveOutput = recursiveInput[key];

        // if there are no more submethods to invoke, reuturn output
        if (keys[i + 1] === undefined) return recursiveOutput;
        // otherwise, recursively continue
        return invokeMethods(keys, recursiveOutput, i + 1);
      };
      // if token is a top-level object, then contents will be in value,
      // otherwise, just pull out the rest of the object contents and ignore type key
      const { type, value, ...arrayVal } = token;
      const input = value || arrayVal;
      // start recursion
      return invokeMethods(token.keys, input);
    }
    // if token isn't an object, don't do anything
    return token;
  });
  return objInterpretedTokens;
};

// recursively interpret paran contents, splice into tokens array
const spliceAndInterpretParens = (tokens, env) => {
  // check that we have same # open close parens
  checkEnclosedCount(/\(/, /\)/, tokens);
  // get index for all parentheses
  const parens = findEnclosed(/\(/, /\)/, tokens);

  // find a set of parens that have no children (are next to each other) and interpret contents
  parens.forEach(({ type, index: parenIndex }, index) => {
    const nextParen = parens[index + 1];
    // if we find an open paren at the end w/ no parens after,
    // presume that a paren is facing the wrong way and throw a syntax error
    if (type === 'open' && nextParen === undefined) throw new SyntaxError('mismatched paren direction');
    // if we find a pair of parens, interpret the contents and replace w/ interpreted output
    else if (type === 'open' && nextParen.type === 'close') {
      const openParenIndex = parenIndex;
      const closeParenIndex = nextParen.index;
      // get paren contents
      const parenContents = tokens.slice(openParenIndex + 1, closeParenIndex);
      // interpret paren contents
      OOO.forEach((op) => {
        const opFunc = operators[op];
        // find indexes of operators
        const OpInstIdx = parenContents.flatMap((ctok, i) => (ctok === op ? i : []));
        // get x and y values, splice resolved output into parenContents array
        while (OpInstIdx.length) {
          const opIdx = OpInstIdx.shift();
          const x = parenContents[opIdx - 1];
          const y = parenContents[opIdx + 1];
          parenContents.splice(opIdx - 1, 3, execBinOp(opFunc, x, y, env));
        }
      });
      // replace paren and contents with interpreted output
      tokens.splice(openParenIndex, closeParenIndex - openParenIndex + 1, ...parenContents);
      // if there are more than 2 parens left (ie more than this pair), recursively repeat
      if (parens.length > 2) spliceAndInterpretParens(tokens, env);
    }
  });
  // otherwise, return tokens array w/ paren contents interpreted
  return tokens;
};

const runFuncs = (tokens, env, functions) => {
  // copy tokens array
  const tokensOutput = tokens;
  // check that we have same # open close brackets
  checkEnclosedCount(/{/, /}/, tokens);
  // find functions by { }
  const brackets = findEnclosed(/{/, /}/, tokens);
  brackets.forEach((b, i) => {
    // check to make sure there are no nested or unpaired brackets
    const { type: firstBracket } = b;
    const secondBracket = brackets[i + 1];
    const mismatchedBracketsError = new SyntaxError('mismatched { } brackets!');
    // capture and check function name, args
    // then invoke function and replace brackets, contets w/ output
    if (firstBracket === 'open') {
      if (secondBracket === undefined || secondBracket.type === 'open') throw mismatchedBracketsError;
      // capture function name
      const start = b.index + 1;
      const end = secondBracket.index;
      const funcName = tokens[start];
      // throw error if brackets are empty
      if (funcName === '}') throw new SyntaxError('empty { } brackets!');
      // throw error if function can't be found
      if (!(funcName in functions)) throw new Error(`can't find function ${funcName}! did you pass in a functions object?`);
      // capture function args
      const funcArgs = tokens.slice(start + 1, end);
      // invoke function
      let out;
      if (!functions[funcName].arrayArg) {
        if (funcName === 'CompareDateTime') {
          logger.info(`Executing comparedatetime with the args below at tokens ${start} : ${end}`);
          logger.info(funcArgs);
          logger.info(`tokens: ${JSON.stringify(tokens)}`);
          logger.info(`env: ${JSON.stringify(env)}`);
        }
        out = functions[funcName].function(env, ...funcArgs);
      } else {
        out = functions[funcName].function(env, funcArgs);
      }
      // splice output into tokens array
      tokensOutput.splice(b.index, secondBracket.index - b.index + 1, out);
      // TODO(Issue #56) This fails when there are multiple function
      // calls as it assumes that bracket indices are unchanged when
      // the token array is spliced to include the resolved value
    }
  });

  // return new token array
  return tokensOutput;
};

const fullyReduceArrays = (tokens) => {
  const out = tokens.map((token) => {
    // if token is an array, reduce to single val, true, or false
    if (token === null) { return token; }
    if (typeof token === 'object' && 'type' in token && token.type === 'array') {
      const { type, ...arrVals } = token;
      // need to insert length key to make an "array-like" object
      arrVals.length = Object.keys(arrVals).length;
      const arr = Array.from(arrVals);
      // if there are no values, return false
      if (arr.length === 0) return false;
      // if there is more than zero values, return true
      return true;
    }
    // if token isn't an array, don't do anything
    return token;
  });
  return out;
};

const runOOO = (tokens, env) => {
  // copy tokens array
  const tokensOutput = tokens;
  // iterate through operators and splice in completed operation results
  OOO.forEach((op) => {
    const opFunc = operators[op];
    // find indexes of operators
    const OpInstIdx = tokensOutput.flatMap((ctok, i) => (ctok === op ? i : []));
    // get x and y values, splice resolved output into tokensOutput array
    while (OpInstIdx.length) {
      const opIdx = OpInstIdx.shift();
      const x = tokensOutput[opIdx - 1];
      const y = tokensOutput[opIdx + 1];
      tokensOutput.splice(opIdx - 1, 3, execBinOp(opFunc, x, y, env));
    }
  });
  // return OOO interpreted output
  return tokensOutput;
};
/**
 * condition language interpetter
 *
 * @param  {Array} tokens - output from `resolveVars`
 * @param  {object} env - environment object that contains variable values
 * @param  {object} [functions] - functions that can process and
 * compare specific types of tokens (optional)
 *
 * @returns {Array} interpreter output
 */
const interpret = (tokens, env = {}, functions = {}) => {
  // check that we are not directly comparing any objects
  checkForObjComparisons(tokens);
  // invoke implicit object interpretation
  if (tokens.includes('CompareDateTime') || tokens.includes('ThreadTouched')) {
    logger.info(`tokens before object interpretation: ${JSON.stringify(tokens)}`);
    tokens.forEach((tkn) => { logger.info(`\t\tToken: "${JSON.stringify(tkn)}"" -- Type: ${typeof tkn} -- Constructor: ${tkn.constructor}`); });
  }
  // logger.info(`tokens before object interpretation: ${JSON.stringify(tokens)}`);

  const objInterpretedTokens = interpretObjects(tokens);
  if (objInterpretedTokens.includes('CompareDateTime') || objInterpretedTokens.includes('ThreadTouched')) {
    logger.info(`tokens after object interpretation: ${JSON.stringify(objInterpretedTokens)}`);
  }
  // logger.info(`tokens after object interpretation: ${JSON.stringify(objInterpretedTokens)}`);
  // invoke recursive paren interpretation
  const parenInterpretedTokens = spliceAndInterpretParens(objInterpretedTokens, env);
  // interpret functions

  const funcInterpretedTokens = runFuncs(parenInterpretedTokens, env, functions);
  // fully reduce arrays to true/false depending on empty/not
  const fullyReducedArrayTokens = fullyReduceArrays(funcInterpretedTokens);
  // Tokens should be an array of tokens with the variables resolved
  // iterate through tokens, detect operators
  const oooInterpretedTokens = runOOO(fullyReducedArrayTokens, env);
  // return interpreted tokens
  return oooInterpretedTokens;
};
/* ##### END INTERPRETER ##### */

/* ### BEGIN VARIABLE RESOLVER ### */
/**
 * resolve variables and performs initial processing of objects and arrays
 *
 * @param  {string} expr - raw condition language input
 * @param  {object} inputEnv - environment object that contains variable values
 *
 * @returns {Array} array containing tokenized input with
 * variables resolved and object/array keys/indexes parsed
 */

const resolveVars = (expr, inputEnv = {}) => {
  // _ is a built-in object with some useful things
  // tempalte string w/ space makes regex easier to make haha
  if (/\$_[^.]/gm.exec(`${expr} `) !== null) throw new Error('$_ cannot be called alone, refrence a child method using dot notation!');
  if (inputEnv !== undefined && '_' in inputEnv) throw new Error('$_ is a reserved name and is not assignable!');
  // pull out historyInstance since we need to check that it's an instance of the History class
  const { historyInstance, ...input } = inputEnv;
  const env = {
    _: {
      type: 'object',
      value: {
        // whatever globals we want can go in here
        now: Date.now(),
      },
    },
    ...input,
  };
  // check over history object, add to environment
  if (/\$history/gm.exec(`${expr}`) !== null && 'historyInstance' in inputEnv === false) throw new Error('history referenced but no history instance provided!');
  if (/\$historyInstance/gm.exec(`${expr}`) !== null) throw new Error('history cannot be referenced using $historyInstance, use $history instead!');
  if ('historyInstance' in inputEnv && historyInstance instanceof History === false) throw new Error('value provided for historyInstance is not an instance of History class!');
  if (historyInstance instanceof History) env.history = { type: 'object', value: historyInstance };

  // checks that # of [ ] symbols match
  checkEnclosedCount(/\[/gm, /\]/gm, expr.split(''));
  // tokenize expression
  const toks = tokenize(expr);

  // detect variables and replace them with their resolved values
  const varResolvedTokens = toks.flatMap((token) => {
    // if we detect a variable, resolve and replace token w/ value
    const detectVar = varIDPat.exec(token);
    const detectDotArg = dotArgIDPat.exec(token);
    const detectArray = arrayIDPat.exec(token);
    // check for variables w/ dot args
    if (detectVar !== null && detectVar[1]) {
      let resolvedVal = env[detectVar[1]];
      if (resolvedVal === undefined) throw new Error(`Undefined reference: ${token}`);

      // wrap objects in {type: object, value: {...}} to id objects in
      // downstream variable realization processes, e.g., connecting
      // attribute selection statements to their original objects
      if (resolvedVal && resolvedVal.constructor === Object && resolvedVal.type === undefined) {
        // logger.info(`detected object variable: ${JSON.stringify(resolvedVal)}`);
        resolvedVal = { type: 'object', value: resolvedVal };
      } else if (resolvedVal && resolvedVal.constructor === Date) {
        logger.info(`Detected date value: ${resolvedVal}`);
        resolvedVal = { type: 'date', value: resolvedVal };
      }

      // args might be in this tok, or they could be seperated by a [key], so we need to check twice
      if (detectDotArg) {
        // logger.info(`DETECTDOTARG[0]: ${detectDotArg[0]}`);
        const argVals = detectDotArg[0].split('.').filter((t) => (t !== '' ? t : null));
        const args = argVals.map((a) => ({
          type: 'key',
          value: a,
        }));
        // return var value with args
        return [resolvedVal, ...args];
      }
      // otherwise, just return var value
      return resolvedVal;
    }
    // check for arrays/keys in []
    if (detectArray !== null && detectArray[0]) {
      // we support array slice notation w/ [start:end]
      // test to see if the brackets contain a slice
      const indexAndSplitIDPat = /([0-9]+)?(:?)([0-9]+)?/gm;
      const sliceOut = indexAndSplitIDPat.exec(detectArray[1]);
      // if the slice regex detects a colon between two nubmers, then this token must be a slice
      // slices may contain just one number
      if (sliceOut[2] === ':') {
        const start = parseInt(sliceOut[1], 10);
        const end = parseInt(sliceOut[3], 10);
        const sliceArg = { type: 'slice', start, end };
        return sliceArg;
      }

      // otherwise, the token is an array. use JSON.parse() to get array contents
      const rawArrayContents = detectArray[0];
      const arrayContents = JSON.parse(rawArrayContents);
      const arr = {
        type: 'array',
        ...arrayContents,
      };
      return arr;
    }
    // check for dot args again
    if (detectDotArg) {
      if (/\d+\.\d+/.exec(token)) {
        return token;
      }
      const argVals = detectDotArg[0].split('.').filter((t) => (t !== '' ? t : null));
      const args = argVals.map((a) => ({
        type: 'key',
        value: a,
      }));
      return args;
    }
    return token;
  });
  // check that there is an arg or array following an object
  // except in functions
  let inFunction = false;
  varResolvedTokens.forEach((token, index) => {
    if (token === '{') inFunction = true;
    else if (token === '}') inFunction = false;
    if (token !== null && typeof token === 'object' && 'type' in token && token.type === 'object') {
      const nextToken = varResolvedTokens[index + 1];
      if (inFunction === false && (nextToken === undefined || typeof nextToken !== 'object')) throw new SyntaxError('objects cannot be referenced w/out a key reference');
    }
  });
  // return token array
  return varResolvedTokens;
};
/* ##### END VARIABLE RESOLVER ##### */

module.exports = {
  resolveVars,
  interpret,
  tokenize,
  idToken,
  interpretObjects,
};
