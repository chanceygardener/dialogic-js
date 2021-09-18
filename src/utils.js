const fs = require('fs');

const getSubTemplateIndices = (variantText) => {
  const out = [];
  let currentSpan = null;
  let depthCount = 0;
  for (let i = 0; i < variantText.length; i += 1) {
    if (variantText[i] === '[') {
      depthCount += 1;
      if (currentSpan === null) {
        currentSpan = [i];
      }
    } else if (variantText[i] === ']') {
      depthCount -= 1;
    }
    if (depthCount === 0 && currentSpan !== null) {
      currentSpan.push(i + 1);
      // Only include if this
      // isn't a variable index or slice
      if (!variantText.slice(...currentSpan).match(/^\[[\d:]+\]$/)) {
        out.push(currentSpan);
      }
      currentSpan = null;
    }
  }
  return out;
};

const replaceSlice = (text, spans, callBack) => {
  if (spans.length === 0) {
    return text;
  }
  let ptr = 0;
  let outText = '';
  spans.forEach((span) => {
    outText += text.slice(ptr, span[0]);
    outText += callBack(text.slice(...span));
    [, ptr] = span;
  });
  outText += text.slice(ptr, text.length);
  return outText;
};

const resolveVar = (varName, env, attCalls = null) => {
  let val = env[varName];
  if (attCalls !== null) {
    // console.log(`resolving ${varName}${attCalls} from \n${JSON.stringify(env)}`);
    const attCallPat = /\[\d*:?\d*\]|\.\w+/g;
    let attCallLeft = attCallPat.exec(attCalls);
    while (attCallLeft !== null) {
      if (!attCallLeft) { break; }
      // eslint-disable-next-line prefer-destructuring
      attCallLeft = attCallLeft[0];
      const arrCallMatch = attCallLeft.match(/\[(?<initSlice>\d*)(?<slice>:?)(?<termSlice>\d*)\]/);
      const objCallMatch = attCallLeft.match(/\.(?<attribute>[\w_]+)/);
      if (arrCallMatch) {
        if (!Array.isArray(val)) {
          throw new Error(`Array operation called on Non-Array value: ${JSON.stringify(val)}`);
        }
        let initSlice = parseInt(arrCallMatch.groups.initSlice, 10);
        let termSlice = parseInt(arrCallMatch.groups.termSlice, 10);
        const { slice } = arrCallMatch.groups;
        if (slice === ':') {
          if (Number.isNaN(termSlice)) {
            termSlice = val.length;
          }
          if (Number.isNaN(initSlice)) {
            initSlice = 0;
          }
          val = val.slice(initSlice, termSlice);
        } else {
          val = val[initSlice];
        }
      } else if (objCallMatch) {
        val = val[objCallMatch.groups.attribute];
      } else {
        throw new Error(
          `invalid attribute call in resolving ${varName}${attCalls} at ${attCallLeft.input}`,
        );
      }
      attCallLeft = attCallPat.exec(attCalls);
    }
  }// else { console.log(`resolving ${varName} from \n${JSON.stringify(env)}`); }
  // console.log(`resolved as: ${val}`);
  /* throw an error if the
  value is not defined */
  if (val === undefined) {
    console.log(`\n\tWARNING: ${varName} was undefined`);
    return null;
  }
  return val;
};

const arraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) {
    return false;
  }
  const sortedArr1 = arr1.sort();
  const sortedArr2 = arr2.sort();
  let result = true;
  sortedArr1.forEach((val, idx) => {
    if (val !== sortedArr2[idx]) {
      result = false;
    }
  });
  return result;
};

// const isUnique = (array) => (new Set(array)).size === array.length;

const readJson = (path) => {
  const dat = fs.readFileSync(path);
  try {
    const out = JSON.parse(dat);
    return out;
  } catch (error) {
    // include file path in error message
    throw SyntaxError(`Invalid JSON at ${path}, ${error}`);
  }
};

const boolStrings = {
  true: true,
  false: false,
};

module.exports = {
  arraysEqual,
  readJson,
  boolStrings,
  resolveVar,
  getSubTemplateIndices,
  replaceSlice,
};
