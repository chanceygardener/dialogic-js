const length = (env, input) => {
  if (!Array.isArray(input)) throw new TypeError('non-Array type object passed into Length function!');
  return input.length;
};

module.exports = {
  name: 'Length',
  func: length,
  type: 'function',
};
