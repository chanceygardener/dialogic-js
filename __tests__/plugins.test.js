// require modules to be spied on
// const fs = require('fs');
const { NlgRealizer } = require('../src/realizer.js');

// insert spies
// const readFileSpy = jest.spyOn(fs, 'readFileSync');

// import units
const { importPlugins } = require('../src/plugins');

// set mode env var to testing so app does not run
process.env.mode = 'TESTING';

// dummy testing obj so we don't have to make a fake testing file
const testConfig = {
  name: 'dialogic-testing',
  description: 'config file for dialogic testing',
  plugins: [
    {
      name: 'compare-date-time',
      type: 'function',
    },
    {
      name: 'is-null',
      type: 'function',
    },
  ],
};

describe('plugin importer', () => {
  it('should import each function in dialogic config', () => {
    expect.assertions(1);
    const { functions } = importPlugins();
    expect(functions).toMatchObject({
      CompareDateTime: {
        function: expect.any(Function),
        arrayArg: undefined,
      },
      IsNull: {
        function: expect.any(Function),
        arrayArg: undefined,
      },
    });
  });
  it('should accept config object', () => {
    expect.assertions(1);
    const { functions } = importPlugins('', testConfig);
    expect(functions).toMatchObject({
      CompareDateTime: {
        function: expect.any(Function),
        arrayArg: undefined,
      },
      IsNull: {
        function: expect.any(Function),
        arrayArg: undefined,
      },
    });
  });
  it('should throw error when unsupported module type is present', () => {
    expect.assertions(1);
    const badType = testConfig;
    badType.plugins = [{ name: 'bad-type', type: 'lkjadlkdj' }];
    // use obj destructuring pattern
    expect(() => importPlugins('', badType)).toThrow('unsupported plugin type!');
  });
  it('should throw error when function that does not exist is present', () => {
    expect.assertions(1);
    const nonExistantPlugin = testConfig;
    nonExistantPlugin.plugins = [{ name: 'does-not-exist', type: 'function' }];
    // use obj destructuring pattern
    expect(() => importPlugins('', nonExistantPlugin)).toThrow('plugin does not exist!');
  });
  it.todo('should create a dialogic-config.js file if one does not exist');
});

describe('standard Plugins', () => {
  const realizer = new NlgRealizer('./__tests__/data/templates/golden');
  it('test IsNull', () => {
    expect.assertions(2);
    expect(realizer.executeTemplate('testNullVar', { test_variable: null })
      .responseText).toStrictEqual('The test variable was null!');
    expect(realizer.executeTemplate('testNullVar', { test_variable: 1 })
      .responseText).toStrictEqual('The test variable was not null');
  });

  it('test CompareDateTime', () => {
    expect.assertions(3);
    const before = new Date('2021-03-13T15:56:53.298Z');
    const after = new Date('2021-03-16T17:35:09.626Z');
    expect(realizer.executeTemplate('testCompareDateTime', { target: before, source: after })
      .responseText).toStrictEqual('The source event happened before the target event');
    expect(realizer.executeTemplate('testCompareDateTime', { target: after, source: before })
      .responseText).toStrictEqual('The target event happened before the source event!');
    expect(realizer.executeTemplate('testCompareDateTime', { target: new Date(), source: new Date() })
      .responseText).toStrictEqual('The source and target events happened around the same time.');
  });

  it('test Not', () => {
    expect.assertions(2);
    expect(realizer.executeTemplate('testNot', { var: true })
      .responseText).toStrictEqual('The variable was true');
    expect(realizer.executeTemplate('testNot', { var: false })
      .responseText).toStrictEqual('The variable was false');
  });

  it('test ThreadTouched', () => {
    expect.assertions(1);
    expect(realizer.executeTemplate('testThreadTouched', {}).responseText)
      .toStrictEqual('The thread was not touched');
  });
});
