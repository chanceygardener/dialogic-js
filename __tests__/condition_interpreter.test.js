const {
  resolveVars, interpret, tokenize, idToken,
} = require('../src/condition_interpreter');
const { importPlugins } = require('../src/plugins');
const History = require('../src/history');

describe('tokenizer', () => {
  it('tokenizes operators and itegers separated by whitespace', () => {
    expect.assertions(1);
    const testExp = '2 + 4 == 6';
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['2', '+', '4', '==', '6']);
  });
  it('tokenizes strings that include whitespace', () => {
    expect.assertions(1);
    const testExp = "2 + 4 == 'not six'";
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['2', '+', '4', '==', "'not six'"]);
  });
  it('tokenizes strings with different quote chars correctly', () => {
    expect.assertions(1);
    const testExp = "`is six` == 'not six'";
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['`is six`', '==', "'not six'"]);
  });
  it('tokenizes parentheses as separate tokens in compound statements', () => {
    expect.assertions(1);
    const testExp = "$user_test && ($this != 'circuit breaker' && $other_val == 43)";
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['$user_test', '&&', '(', '$this', '!=',
      "'circuit breaker'", '&&', '$other_val', '==', '43', ')']);
  });
  it('string literals should be able to contain unescaped [ or ] when contained in quotes', () => {
    expect.assertions(1);
    expect(tokenize('"[this]" == 2')).toStrictEqual(['"[this]"', '==', '2']);
  });
  it('tokenizes array indices as separate tokens', () => {
    expect.assertions(1);
    const testExp = '$user_test[1:4]';
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['$user_test', '[1:4]']);
  });
  it('tokenizes array index syntax as one token when it appears within a string', () => {
    expect.assertions(1);
    const testExp = "$user_test == 'index syntax[1:3]'";
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['$user_test', '==', "'index syntax[1:3]'"]);
  });
  it('tokenizes arrays of integers as separate tokens with commas excluded', () => {
    expect.assertions(1);
    const testExp = '[1, 2, 3]';
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(['[1, 2, 3]']);
  });
  it('tokenizes arrays of strings with whitespace included in strings correctly', () => {
    expect.assertions(1);
    const testExp = "['this', 'is', 'a thing']";
    const tokens = tokenize(testExp);
    expect(tokens).toStrictEqual(["['this', 'is', 'a thing']"]);
  });
  it('tokens of different types are identified correctly',
    () => {
      expect.assertions(7);
      const testTokens = ['1', '3.14', 'true', '"cheese"', '(', '==', '$someVar'];
      const testTypes = ['number', 'number', 'boolean', 'string', 'string', 'function', 'string'];
      testTokens.forEach((token, idx) => {
        expect(typeof idToken(token, { someVar: 'yes it is' }))
          .toStrictEqual(testTypes[idx]);
      });
    });
});

describe('condition interpreter', () => {
  it('resolves integer variables', () => {
    expect.assertions(1);
    const testEnv = {
      this: 2,
      that: 4,
      other: 6,
    };
    const testExp = '$this + $that == $other';
    const tokens = resolveVars(testExp, testEnv);
    expect(tokens).toStrictEqual([2, '+', 4, '==', 6]);
  });
  it('resolves and interprets string variables', () => {
    expect.assertions(2);
    const testEnv = {
      this: '"testing"',
    };
    const testExp = '$this == "testing"';
    const tokens = resolveVars(testExp, testEnv);
    expect(tokens).toStrictEqual(['"testing"', '==', '"testing"']);
    const out = interpret(tokens);
    expect(out).toStrictEqual(['true']);
  });
  // TODO (CSB-405): revisit handling operators in the wrong spot
  it('resolves and throws an error when interpreting operators as variables', () => {
    expect.assertions(2);
    const testEnv = {
      this: '==',
    };
    const testExp = '1 $this ==';
    const tokens = resolveVars(testExp, testEnv);
    expect(tokens).toStrictEqual(['1', '==', '==']);
    expect(() => interpret(tokens)).toThrow('Consecutive binary operators found in condition statement');
  });
  it('should resolve variables within variables', () => {
    expect.assertions(2);
    const testEnv = {
      that: '$this',
      this: true,
    };
    const testExp = '$that == true';
    const tokens = resolveVars(testExp, testEnv);
    expect(tokens).toStrictEqual(['$this', '==', 'true']);
    const out = interpret(tokens, testEnv);
    expect(out).toStrictEqual(['true']);
  });
  it('resolves and interprets all operators', () => {
    expect.assertions(25);
    const testEnv = { this: 2, that: 4 };
    const operators = ['>', '<', '**', '*', '/', '%', '+', '-', '==', '!=', '&&', '||'];
    const expectedOut = ['false', 'true', '16', '8', '0.5', '2', '6', '-2', 'false', 'true', '4', '2'];
    operators.forEach((o, i) => {
      const testExp = `$this ${o} $that`;
      const tokens = resolveVars(testExp, testEnv);
      expect(tokens).toStrictEqual([testEnv.this, o, testEnv.that]);
      const out = interpret(tokens);
      expect(out).toStrictEqual([expectedOut[i]]);
    });
    // || operator needs it's own assertion set because it resolves before
    // the end of the line if one val is true
    const orTestEnv = { this: false, that: false };
    const orTestExp = '$this || $that';
    const orTokens = resolveVars(orTestExp, orTestEnv);
    const orOut = interpret(orTokens);
    expect(orOut).toStrictEqual(['false']);
  });
  it('interprets tokens', () => {
    expect.assertions(1);
    const out = interpret([2, '+', 4, '==', 6]);
    expect(out).toStrictEqual(['true']);
  });
  it('should throw err when var is undefined', () => {
    expect.assertions(1);
    const testEnv = {};
    const testExp = '$this';
    expect(() => resolveVars(testExp, testEnv)).toThrow('Undefined reference: $this');
  });
});

describe('parentheses interpreter', () => {
  it('resolves and interprets compound statements', () => {
    expect.assertions(2);
    const testExp = '2 * ( 1 + 1 )';
    const tokens = resolveVars(testExp, {});
    expect(tokens).toStrictEqual(['2', '*', '(', '1', '+', '1', ')']);
    const out = interpret(tokens);
    expect(out).toStrictEqual(['4']);
  });
  it('resolves and interprets statements with very deep parentheses', () => {
    expect.assertions(2);
    const testExp = '2 * ( ( ( ( 1 + 1 ) ) + 1 ) )';
    const tokens = resolveVars(testExp, {});
    expect(tokens).toStrictEqual(['2', '*', '(', '(', '(', '(', '1', '+', '1', ')', ')', '+', '1', ')', ')']);
    const out = interpret(tokens);
    expect(out).toStrictEqual(['6']);
  });
  it('interprets multiple parentheses sets w/in more parentheses', () => {
    expect.assertions(1);
    const testExp = '2 * ( ( 1 + 1 ) + ( 1 + 1 ) )';
    const tokens = resolveVars(testExp, {});
    const out = interpret(tokens);
    expect(out).toStrictEqual(['8']);
  });
  it('should throw an error if # paren is mismatched', () => {
    expect.assertions(1);
    const testExp = '2 * ( 1';
    const tokens = resolveVars(testExp, {});
    expect(() => interpret(tokens)).toThrow('mismatched number of enclosing symbols!');
  });
  it('should throw an error if paren direction is mismatched', () => {
    expect.assertions(1);
    const testExp = '2 * ) 1 (';
    const tokens = resolveVars(testExp, {});
    expect(() => interpret(tokens)).toThrow('mismatched paren direction');
  });
});

describe('function interpreter', () => {
  it('should interpret functions', async () => {
    expect.hasAssertions();
    const { functions } = await importPlugins();
    const funcTestEnvs = [
      {
        func: 'CompareDateTime',
        env: {
          arg1: {
            type: 'date',
            value: new Date('2020-08-25T12:00:00-07:00'),
          },
          arg2: {
            type: 'date',
            value: new Date('2020-08-25T12:00:00-07:00'),
          },
        },
        res: 0,
      },
      {
        func: 'IsNull',
        env: { arg1: null },
        res: 1,
      },
      {
        func: 'IsNull',
        env: { arg1: 423 },
        res: 0,
      },
      {

        func: 'ThreadTouched',
        env: {
          historyInstance: new History(),
          arg1: '1.0.0',
        },
        res: false,
      },
      {
        func: 'Not',
        env: { arg1: true },
        res: false,
      },
    ];
    expect.assertions(funcTestEnvs.length);
    funcTestEnvs.forEach(({ func, env, res }) => {
      // make sure only args are pulled out of environment
      const args = Object.keys(env).filter((i) => /arg[0-9]+/gm.test(i)).map((k) => `$${k}`);
      const testExp = `{ ${func} ${args.join(' ')} }`;
      const tokens = resolveVars(testExp, env);
      expect(interpret(tokens, env, functions)).toStrictEqual([res]);
    });
  });
  it('should throw err if brackets are mismatched', () => {
    expect.assertions(2);
    const testExps = ['} BadBrackets {', '{ { BadBrackets } }'];
    testExps.forEach((exp) => {
      const tokens = resolveVars(exp);
      expect(() => interpret(tokens)).toThrow('mismatched { } brackets!');
    });
  });
  it('shpuld throw err if function cannot be found', () => {
    expect.assertions(1);
    const testExp = '{ DoesNotExist }';
    const tokens = resolveVars(testExp);
    expect(() => interpret(tokens)).toThrow('can\'t find function DoesNotExist! did you pass in a functions object?');
  });
  it('should throw err if curly brackets are empty', () => {
    expect.assertions(1);
    const testExp = '{ }';
    const tokens = resolveVars(testExp);
    expect(() => interpret(tokens)).toThrow('empty { } brackets!');
  });
});

describe('object/array tokenizer + interperter', () => {
  it('should resolve combination .key and [key] syntax', () => {
    expect.assertions(2);
    const testEnv = {
      // TODO (CSB-439): auto-wrap objects in type + value keys
      complexObj: {
        type: 'object',
        value: { key1: { '1.0.0': { val: [1, 2, 3] } } },
      },
    };
    const tokens = resolveVars('$complexObj.key1["1.0.0"].val[2]', testEnv);
    expect(tokens).toStrictEqual([
      {
        type: 'object',
        value: { key1: { '1.0.0': { val: [1, 2, 3] } } },
      },
      {
        type: 'key',
        value: 'key1',
      },
      {
        type: 'array',
        ...['1.0.0'],
      },
      {
        type: 'key',
        value: 'val',
      },
      {
        type: 'array',
        ...[2],
      },
    ]);
    const out = interpret(tokens);
    expect(out).toStrictEqual([3]);
  });
  it('should not allow direct comparisons of objects', () => {
    expect.assertions(1);
    const testEnv = {
      obj1: {
        type: 'object',
        value: { key: true },
      },
      obj2: {
        type: 'object',
        value: { key: true },
      },
    };
    const tokens = resolveVars('$obj1.key == $obj2.key', testEnv);
    expect(() => interpret(tokens)).toThrow('direct comparison of objects is not permitted! use dot notation to resolve value or a comparison function');
  });
  it('array slice notation should work', () => {
    expect.assertions(2);
    const testEnv = {
      arr: {
        type: 'array',
        ...[1, 2, 3, 4],
      },
    };
    const tokens = resolveVars('$arr[2:3]', testEnv);
    expect(tokens).toStrictEqual([
      {
        type: 'array',
        ...[1, 2, 3, 4],
      },
      {
        type: 'slice',
        start: 2,
        end: 3,
      },
    ]);
    expect(interpret(tokens)).toStrictEqual([3]);
  });
  it('should run functions if objects contain them', () => {
    expect.assertions(1);
    const date = new Date(Date.now());
    const tokens = resolveVars('$now.toISOString', {
      now: {
        type: 'object',
        value: date,
      },
    });
    expect(interpret(tokens)).toStrictEqual([date.toISOString()]);
  });
  it('should throw an err on .arg with no modifying obj', () => {
    expect.assertions(1);
    expect(() => resolveVars('$now', {
      now: {
        type: 'object',
        value: new Date(Date.now()),
      },
    })).toThrow('objects cannot be referenced w/out a key reference');
  });
  it('should not allow direct comparison of objects, should suggest a function', () => {
    expect.assertions(1);
    const testEnv = {
      obj1: {
        type: 'object',
        value: { key: true },
      },
      obj2: {
        type: 'object',
        value: { key: true },
      },
    };
    const tokens = resolveVars('$obj1.key == $obj2.key', testEnv);
    expect(() => interpret(tokens, testEnv))
      .toThrow('direct comparison of objects is not permitted! use dot notation to resolve value or a comparison function');
  });
  it('should throw a SyntaxError when array brackets are mismatched', () => {
    expect.assertions(1);
    expect(() => resolveVars('[1, 2, 3[1]')).toThrow('mismatched number of enclosing symbols!');
  });
  it('full/empty arrays should resolve to true/false', () => {
    expect.assertions(3);
    expect(interpret(resolveVars('$arr', {
      arr: {
        type: 'array',
        ...[22],
      },
    }))).toStrictEqual([true]);
    expect(interpret(resolveVars('$arr', {
      arr: {
        type: 'array',
        ...[22, 23, 24],
      },
    }))).toStrictEqual([true]);
    expect(interpret(resolveVars('$arr', {
      arr: {
        type: 'array',
        ...[],
      },
    }))).toStrictEqual([false]);
  });
  it('multi dimensional arrays should work', () => {
    expect.assertions(1);
    const testEnv = { testArr: { type: 'array', ...[1, [2, 3], 4] } };
    const tokens = resolveVars('$testArr[1][0]', testEnv);
    const out = interpret(tokens);
    expect(out).toStrictEqual([2]);
  });
});

describe('$_ builtin var', () => {
  it('should not allow user to redefine _', () => {
    expect.assertions(1);
    expect(() => resolveVars('$_.debug', { _: true })).toThrow('$_ is a reserved name and is not assignable!');
  });
  it('dont allow user to just call $_, tell them to use dot notation', () => {
    expect.assertions(1);
    expect(() => resolveVars('$_')).toThrow('$_ cannot be called alone, refrence a child method using dot notation!');
  });
});
