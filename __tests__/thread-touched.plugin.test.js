const { func: ThreadTouched } = require('../modules/plugins/thread-touched/index');
const History = require('../src/history');

describe('function: ThreadTouched', () => {
  it('should return bool value for whether thread has beentouched or not', () => {
    expect.assertions(3);
    const emptyHist = new History();
    expect(ThreadTouched({ historyInstance: emptyHist }, '1.0')).toStrictEqual(false);
    const histWithThread = new History();
    histWithThread.recordStep('1.0.1');
    expect(ThreadTouched({ historyInstance: histWithThread }, '1.0')).toStrictEqual(true);
    expect(ThreadTouched({ historyInstance: histWithThread }, '1.2')).toStrictEqual(false);
  });
  it('should catch error if env does not contain a HistoryInstance', () => {
    expect.assertions(2);
    expect(() => ThreadTouched({ niceBool: true }, '1.0.0')).toThrow('environment does not contain historyInstance!');
    expect(() => ThreadTouched({ historyInstance: {} }, '1.0.0')).toThrow('historyInstance in env is not an actual instance of the History class!');
  });
});
