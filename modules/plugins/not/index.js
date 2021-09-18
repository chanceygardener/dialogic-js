/**
 * @param {object} env - the environment variables available in
 * the template, unused in this function but necessary to behave properly in context
 * @param {*} input - any input to be negated, no type restrictions.
 * this is simply the native JS ! operator in a function,
 * which may result in some weird behavior if one is not familiar w/ how the operator behaves.
 * @returns {boolean} - the ! value of input
 */
const not = (env, input) => !input;

module.exports = {
  name: 'Not',
  func: not,
  type: 'function',
};
