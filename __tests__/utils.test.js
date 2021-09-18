const utils = require('../src/utils.js');

describe('test arraysEqual', () => {
  it('returns true for equivalent '
        + 'nonempty array of the same order', () => {
    expect.assertions(1);
    const result = utils.arraysEqual([1, 2, 3], [1, 2, 3]);
    expect(result).toBe(true);
  });
  it('returns true for equivalent '
        + 'nonempty array of the different order', () => {
    expect.assertions(1);
    const result = utils.arraysEqual([1, 2, 3], [3, 2, 1]);
    expect(result).toBe(true);
  });
  it('returns false for non-equivalent arrays of the same length', () => {
    expect.assertions(1);
    const result = utils.arraysEqual([1, 4, 3], [3, 2, 1]);
    expect(result).toBe(false);
  });
  it('returns true for empty arrays', () => {
    expect.assertions(1);
    const result = utils.arraysEqual([], []);
    expect(result).toBe(true);
  });
  it('returns false for arrays of different lengths', () => {
    expect.assertions(1);
    const result = utils.arraysEqual(['hello', 3, 4], [1, 2]);
    expect(result).toBe(false);
  });
});

describe('test resolveVar', () => {
  it('resolves plain old vanilla variable', () => {
    expect.assertions(1);
    expect(utils.resolveVar('frog_name', {
      frog_name: 'Alejandro',
    })).toStrictEqual('Alejandro');
  });
  it('resolves array variable with an index', () => {
    expect.assertions(1);
    expect(utils.resolveVar('grief_stages', {
      grief_stages: ['denial', 'anger', 'bargaining', 'depression', 'acceptance'],
    }, '[2]')).toStrictEqual('bargaining');
  });
  it('resolves object attribute variable', () => {
    expect.assertions(1);
    expect(utils.resolveVar('thought_state',
      {
        thought_state: {
          mood: 'meh',
        },
      }, '.mood')).toStrictEqual('meh');
  });

  it('resolves array slices', () => {
    expect.assertions(3);
    expect(utils.resolveVar('grief_stages', {
      grief_stages: ['denial', 'anger', 'bargaining', 'depression', 'acceptance'],
    }, '[2:]')).toMatchObject(['bargaining', 'depression', 'acceptance']);
    expect(utils.resolveVar('grief_stages', {
      grief_stages: ['denial', 'anger', 'bargaining', 'depression', 'acceptance'],
    }, '[:2]')).toMatchObject(['denial', 'anger']);
    expect(utils.resolveVar('grief_stages', {
      grief_stages: ['denial', 'anger', 'bargaining', 'depression', 'acceptance'],
    }, '[1:3]')).toMatchObject(['anger', 'bargaining']);
  });

  it('resolves variable with a combination of array indices and object attribute calls', () => {
    expect.assertions(1);
    expect(utils.resolveVar('thought',
      {
        thought: {
          tangent: [{ type: 'irrelevant', magnitude: 12 },
            { type: 'relevant', magnitude: 15 }],
        },
      }, '.tangent[1].magnitude')).toStrictEqual(15);
  });
});
describe('test boolStrings', () => {
  it('boolStrings object maps correctly', () => {
    expect.assertions(2);
    expect(utils.boolStrings.true).toBe(true);
    expect(utils.boolStrings.false).toBe(false);
  });
});
describe('test readJson', () => {
  it('returns valid json object from valid json file.', () => {
    expect.assertions(1);
    const resultJson = utils
      .readJson('./__tests__/data/valid_json.json');
    expect(resultJson).toMatchObject({
      testKey: 'hello',
      theAnswer: 42,
      theQuestion: null,
    });
  });
  it('throws SyntaxError from invalid json file.', () => {
    expect.assertions(1);

    expect(() => {
      utils.readJson('./__tests__/data/invalid_json.json');
    }).toThrow(SyntaxError);
  });
});
