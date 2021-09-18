const length = require('../modules/plugins/length/index');

describe('function: Length', () => {
  it('should return length val when passed an array object', () => {
    expect.assertions(1);
    const testObj = [1, 2, 3, 4];
    expect(length.func({}, testObj)).toStrictEqual(4);
  });
  it('should throw an error if a non-array object is passed as arg', () => {
    expect.assertions(1);
    expect(() => length.func({}, {
      type: 'DateTime',
      resolves: '2020-09-04T23:52:06.020Z',
      methods: {},
    })).toThrow('non-Array type object passed into Length function!');
  });
});
