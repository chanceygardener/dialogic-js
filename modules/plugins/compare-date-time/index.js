/**
 * take 2 datetime strings and compare to see if they overlap
 *
 * @param {object} env - envi
 * @param {(object|Date)} time1Input - Date instance or Date wrapped in type/value object
 * @param {(object|Date)} time2Input - Date instance or Date wrapped in type/value object
 * @param {number} [overlapIntervalInSeconds=60] - Number of seconds that two dates should
 * overlap to be conidered the same (optional)
 *
 * @returns {(-1|0|1)} - indicator of if the second date is before, aproximately the same time,
 * or after the first
 */
const dateTimeCompare = (env, time1Input, time2Input, overlapIntervalInSeconds = 60) => {
  // throw errors if args are missing
  if (time1Input === undefined) throw new Error(`no arguments provided! ${time1Input}`);
  if (time2Input === undefined) throw new Error('missing comparison time!');
  // pull out values from object if date obj is in top-level obj
  const time1 = time1Input.value || time1Input;
  const time2 = time2Input.value || time2Input;
  // type checking
  if (typeof time1 !== 'object' || time1 instanceof Date === false) throw new TypeError('cannot parse 1st time argument!');
  if (typeof time2 !== 'object' || time2 instanceof Date === false) throw new TypeError('cannot parse 2nd time argument!');
  // check overlapIntervalInSeconds is a number
  if (typeof overlapIntervalInSeconds !== 'number') throw new TypeError('overlap interval must be number type!');
  // take interval arg in seconds, but convert to milliseconds for comparison
  const overlapInterval = overlapIntervalInSeconds * 1000;
  const diff = time1 - time2;
  // take absolute value of time difference
  // if less than allowed interval return 0, indicating times are the same
  if (Math.abs(diff) < overlapInterval) return 0;
  // if time1 is before time2, return 1
  if (time1 < time2) return 1;
  // if time1 is after time2, return -1
  return -1;
};

module.exports = {
  name: 'CompareDateTime',
  func: dateTimeCompare,
  type: 'function',
};
