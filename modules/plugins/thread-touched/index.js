const History = require('../../../src/history');

const ThreadTouched = (env, threadKey) => {
  console.log(`Thread Touched env: ${JSON.stringify(env)}`);
  if (env.historyInstance === undefined) throw new Error('environment does not contain historyInstance!');
  if (env.historyInstance instanceof History === false) throw new TypeError('historyInstance in env is not an actual instance of the History class!');
  const threadIndex = env.historyInstance.threadOrder.indexOf(threadKey);
  const threadTouched = threadIndex > -1;
  return threadTouched;
};

module.exports = {
  name: 'ThreadTouched',
  func: ThreadTouched,
  type: 'function',
};
