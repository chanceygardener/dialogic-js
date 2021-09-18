const compareDateTime = require('../modules/plugins/compare-date-time/index.js');

describe('function: CompareDateTime', () => {
  it('should return 0 when times are the same', () => {
    expect.assertions(1);
    const time1 = new Date('2020-08-25T12:00:00-07:00');
    const time2 = new Date('2020-08-25T12:00:00-07:00');
    const overlapInterval = undefined;
    const out = compareDateTime.func({}, time1, time2, overlapInterval);
    expect(out).toStrictEqual(0);
  });
  it('should return different values w/ different overlapInterval', () => {
    expect.assertions(2);
    const time1 = new Date('2020-08-25T12:00:00-07:00');
    const time2 = new Date('2020-08-25T12:00:00-07:10');
    const overlapInterval1 = 60;
    const overlapInterval2 = 3600;
    expect(compareDateTime.func({}, time1, time2, overlapInterval1)).toStrictEqual(1);
    expect(compareDateTime.func({}, time1, time2, overlapInterval2)).toStrictEqual(0);
  });
  it('should return 1 when second time is later than first time', () => {
    expect.assertions(1);
    const time1 = new Date('2020-08-25T12:00:00-07:00');
    const time2 = new Date('2020-08-26T12:00:00-07:00');
    const overlapInterval = undefined;
    const out = compareDateTime.func({}, time1, time2, overlapInterval);
    expect(out).toStrictEqual(1);
  });
  it('should return -1 when second time is earlier than the first time', () => {
    expect.assertions(1);
    const time1 = new Date('2020-08-25T12:00:00-07:00');
    const time2 = new Date('2020-08-24T12:00:00-07:00');
    const overlapInterval = undefined;
    const out = compareDateTime.func({}, time1, time2, overlapInterval);
    expect(out).toStrictEqual(-1);
  });
  it('should throw err when insufficient arguments are provided', () => {
    expect.assertions(2);
    const time1 = '';
    expect(() => compareDateTime.func({}, time1)).toThrow('missing comparison time!');
    expect(() => compareDateTime.func()).toThrow('no arguments provided!');
  });
  it('should throw err when args are not parseable datetimes', () => {
    expect.assertions(2);
    const goodDateTime = new Date('2020-08-25T12:00:00-07:00');
    const badDateTime = 'hi everyone. hope you are all well today';
    expect(() => compareDateTime.func({}, badDateTime, goodDateTime)).toThrow('cannot parse 1st time argument!');
    expect(() => compareDateTime.func({}, goodDateTime, badDateTime)).toThrow('cannot parse 2nd time argument!');
  });
  it('should throw err when overlap interval is not an int', () => {
    expect.assertions(1);
    const time1 = new Date('2020-08-25T12:00:00-07:00');
    const time2 = new Date('2020-08-24T12:00:00-07:00');
    const overlapInterval = 'good morrow!';
    expect(() => compareDateTime.func({}, time1, time2, overlapInterval)).toThrow('overlap interval must be number type!');
  });
});
