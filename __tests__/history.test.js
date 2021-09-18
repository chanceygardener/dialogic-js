const History = require('../src/history');
const { resolveVars, interpret } = require('../src/condition_interpreter');

describe('class: History', () => {
  it('creating a new instance should create class w/ history object', () => {
    expect.assertions(8);
    const history = new History();
    expect(history.threadOrder).toStrictEqual([]);
    expect(history.threads).toStrictEqual({});
    expect(history.nodeOrder).toStrictEqual([]);
    expect(history.nodes).toStrictEqual({});
    // test w/ non hist obj just to check handling
    const historyTwo = new History({ potatoPronounciation: 'potato' });
    expect(historyTwo.threadOrder).toStrictEqual([]);
    expect(historyTwo.threads).toStrictEqual({});
    expect(historyTwo.nodeOrder).toStrictEqual([]);
    expect(historyTwo.nodes).toStrictEqual({});
  });
  it('verify regex contains required named capture groups', () => {
    expect.assertions(4);
    // default regex should be fine, no error expected
    expect(() => new History()).not.toThrow();
    // regex w/ misnamed capture groups should throw
    expect(() => new History({ nodeRegex: /((?<threadIdentifier>([0-9A-Z.]+)+)-)?(?<nodeNickName>\w+)(-(?<eq>CC|TM|ET|CM))?/gm }))
      .toThrow('regex pattern is missing required capture groups!');
    // regex that contains right text but isn't in capture groups should throw
    expect(() => new History({ nodeRegex: /(([0-9A-Z.]+)+)-(\S+)(-(\w+))?threadID-nodeName/gm }))
      .toThrow('regex pattern is missing required capture groups!');
    // if only eq param is missing, don't throw
    expect(() => new History(/((?<threadID>([0-9A-Z.]+)+)-)?(?<nodeName>\w+)/gm)).not.toThrow();
  });
  describe('method: recordStep', () => {
    it('recordStep() should populate history.thread and history.node', () => {
      expect.assertions(4);
      const history = new History();
      history.recordStep('1.0.0-quiz');

      expect(history.threadOrder).toStrictEqual(['root', '1.0']);
      expect(history.threads).toStrictEqual({
        root: {
          name: 'root',
          threadProgress: ['1.0'],
        },
        '1.0': {
          name: '1.0',
          threadProgress: ['1.0.0-quiz'],
          parent: 'root',
        },
      });

      expect(history.nodeOrder).toStrictEqual(['1.0.0-quiz']);
      expect(history.nodes).toStrictEqual({
        '1.0.0-quiz': {
          name: '1.0.0-quiz',
          nodeID: '1.0.0',
          threadID: '1.0',
          nodeNumber: 0,
        },
      });
    });
    it('recordStep() should modify history in each step', () => {
      expect.assertions(4);
      const history = new History();
      history.recordStep('1.0.0-quiz');
      history.recordStep('1.0.1-firstQuestion');
      expect(history.threadOrder).toStrictEqual(['root', '1.0']);
      expect(history.threads).toStrictEqual({
        root: {
          name: 'root',
          threadProgress: ['1.0'],
        },
        '1.0': {
          name: '1.0',
          threadProgress: ['1.0.0-quiz', '1.0.1-firstQuestion'],
          parent: 'root',
        },
      });
      expect(history.nodeOrder).toStrictEqual(['1.0.0-quiz', '1.0.1-firstQuestion']);
      expect(history.nodes).toStrictEqual({
        '1.0.0-quiz': {
          name: '1.0.0-quiz',
          nodeID: '1.0.0',
          threadID: '1.0',
          nodeNumber: 0,
        },
        '1.0.1-firstQuestion': {
          name: '1.0.1-firstQuestion',
          nodeID: '1.0.1',
          threadID: '1.0',
          nodeNumber: 1,
        },
      });
    });
    it('recordStep() check for eq, record in node obj if present', () => {
      expect.assertions(2);
      const history = new History();
      history.recordStep('1.0.0-quiz-CM');
      expect(history.nodes).toStrictEqual({
        '1.0.0-quiz': {
          name: '1.0.0-quiz',
          nodeID: '1.0.0',
          threadID: '1.0',
          nodeNumber: 0,
          eq: 'CM',
        },
      });
      // make sure that, if there is no eq param, that it is not included in output
      history.recordStep('1.0.1-firstQuestion');
      expect(history.nodes['1.0.1-firstQuestion']).toStrictEqual({
        name: '1.0.1-firstQuestion',
        nodeID: '1.0.1',
        threadID: '1.0',
        nodeNumber: 1,
      });
    });
    it('should automatically populate parents field', () => {
      expect.assertions(1);
      const history = new History();
      history.recordStep('1.0-firstLevel');
      history.recordStep('1.1.1-secondLevel');
      history.recordStep('1.1.1.1-thirdLevel');
      expect(history.threads).toStrictEqual({
        root: {
          name: 'root',
          threadProgress: ['1'],
        },
        1: {
          name: '1',
          threadProgress: ['1.0-firstLevel'],
          parent: 'root',
        },
        1.1: {
          name: '1.1',
          threadProgress: ['1.1.1-secondLevel'],
          parent: '1',
        },
        '1.1.1': {
          name: '1.1.1',
          threadProgress: ['1.1.1.1-thirdLevel'],
          parent: '1.1',
        },
      });
    });
  });
  describe('method: recallNodes', () => {
    const testHistory = new History();
    testHistory.recordStep('1.0-stepOne');
    testHistory.recordStep('1.1-stepTwo');
    testHistory.recordStep('1.2-stepThree');
    it('should retrieve n steps back', () => {
      expect.assertions(2);
      // running retrieve w/ no args should retrive what we just said
      const whatWasThat = testHistory.recallNodes();
      expect(whatWasThat).toStrictEqual('1.2-stepThree');
      // running w/ steps arg should retrieve that many steps back
      const twoTimesAgo = testHistory.recallNodes(2);
      expect(twoTimesAgo).toStrictEqual('1.1-stepTwo');
    });
  });
});

describe('history integration in condition langauge', () => {
  it('should accept history object as argument', () => {
    expect.assertions(2);
    const history = new History();
    history.recordStep('1.0.0-firstStep');
    const tokens = resolveVars('$history.nodeOrder[0]', { historyInstance: history });
    expect(tokens).toStrictEqual([
      {
        type: 'object',
        value: history,
      },
      {
        type: 'key',
        value: 'nodeOrder',
      },
      {
        type: 'array',
        ...[0],
      },
    ]);
    const out = interpret(tokens);
    expect(out).toStrictEqual([history.nodeOrder[0]]);
  });
  it('should throw err when history is refrenced but obj is not provided', () => {
    expect.assertions(1);
    expect(() => resolveVars('$history.nodeOrder[0]')).toThrow('history referenced but no history instance provided!');
  });
  it('should not allow referenceing historyInstannce', () => {
    expect.assertions(1);
    const history = new History();
    expect(() => resolveVars('$historyInstance.nodeOrder[0]', { historyInstance: history })).toThrow('history cannot be referenced using $historyInstance, use $history instead!');
  });
  it('should throw err when historyInstance is not an instance of History class', () => {
    expect.assertions(1);
    expect(() => resolveVars('$history.nodeOrder[0]', { historyInstance: { history: true } })).toThrow('value provided for historyInstance is not an instance of History class!');
  });
});
