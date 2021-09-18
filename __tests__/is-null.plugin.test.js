const isNull = require('../modules/plugins/is-null/index');

describe('function: IsNull', () => {
  it('should return 1 if value is null', () => {
    expect.assertions(2);
    expect(isNull.func({}, null)).toStrictEqual(1);
    expect(isNull.func({}, undefined)).toStrictEqual(1);
  });
  it('should return 0 if value is not null', () => {
    expect.assertions(3);
    expect(isNull.func({}, 1)).toStrictEqual(0);
    expect(isNull.func({}, 'hello')).toStrictEqual(0);
    expect(isNull.func({}, '')).toStrictEqual(0);
  });
});
