const index = require('../index');

describe('index file', () => {
  // make sure we aren't exposing things we don't want to be?
  // not sure how useful this is
  it('should contain n keys', () => {
    expect.assertions(1);
    expect(Object.keys(index)).toHaveLength(2);
  });
  it('should contain realizer', () => {
    expect.assertions(1);
    expect('realizer' in index).toStrictEqual(true);
  });
  it('should contain translator', () => {
    expect.assertions(1);
    expect('translators' in index).toStrictEqual(true);
  });
});
