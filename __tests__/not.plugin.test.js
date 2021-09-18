const not = require('../modules/plugins/not/index');

describe('function: Not', () => {
  it('should negate values', () => {
    expect.hasAssertions();
    const cases = [true, false, 1, 345, 0, 'hello', ''];
    expect.assertions(cases.length);
    const output = [false, true, false, false, true, false, true];
    cases.forEach((input, index) => {
      expect(not.func({}, input)).toStrictEqual(output[index]);
    });
  });
});
