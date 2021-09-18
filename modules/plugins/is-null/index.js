const isNull = (env, input) => {
  if (input === null || input === undefined) { return 1; }
  return 0;
};

module.exports = {
  name: 'IsNull',
  func: isNull,
  type: 'function',
};
