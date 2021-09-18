const translators = require('../src/translators');
const History = require('../src/history');
const dfReq = require('./data/dialogflow-req');
const dfReqHist = require('./data/dialogflow-req-history');

describe('dialogflow translator', () => {
  const { handleDialogflowReq, handleDialogflowRes } = translators;
  it('should process Dialogflow request', () => {
    expect.assertions(3);
    const out = handleDialogflowReq(dfReq);
    expect(out.intent).toStrictEqual('day.query');
    expect(out.parameters).toStrictEqual({
      // type is infered for non-context params
      weekday: {
        type: 'string',
        value: 'day',
      },
      'date-time': {
        type: 'object',
        value: {
          startDateTime: '2020-09-09T11:12:16-07:00',
          endDateTime: '2020-09-11T11:12:16-07:00',
        },
      },
      'time-relational': {
        type: 'string',
        value: 'how long until',
      },
      'test-bool': {
        type: 'boolean',
        value: true,
      },
      'test-arr': {
        type: 'array',
        ...[1, 2, 3],
      },
      contexts: {
        // type is not infered in context object because that would be messy
        'get-day-of-week': {
          contextName: 'get-day-of-week',
          name: 'projects/day-of-the-week-snwd/agent/sessions/1fbb040d-a028-2fd5-8aa8-fa76896b2ea2/contexts/get-day-of-week',
          lifespanCount: 5,
          parameters: {
            weekday: 'day',
            'weekday.original': 'day',
            'date-time': {
              startDateTime: '2020-09-09T11:12:16-07:00',
              endDateTime: '2020-09-11T11:12:16-07:00',
            },
            'date-time.original': 'two days',
            'time-relational': 'how long until',
            'time-relational.original': 'will',
          },
        },
      },
    });
    expect(out.session).toStrictEqual('projects/day-of-the-week-snwd/agent/sessions/1fbb040d-a028-2fd5-8aa8-fa76896b2ea2');
  });
  it('should create Dialogflow response', () => {
    expect.assertions(1);
    const resOut = handleDialogflowReq(dfReq);
    resOut.text = 'hello world!';
    const out = handleDialogflowRes(resOut);
    expect(out).toStrictEqual({
      fulfillmentMessages: [{ text: { text: ['hello world!'] } }],
      outputContexts: [
        {
          name: 'projects/day-of-the-week-snwd/agent/sessions/1fbb040d-a028-2fd5-8aa8-fa76896b2ea2/contexts/get-day-of-week',
          lifespanCount: 5,
          parameters: {
            weekday: 'day',
            'weekday.original': 'day',
            'date-time': {
              startDateTime: '2020-09-09T11:12:16-07:00',
              endDateTime: '2020-09-11T11:12:16-07:00',
            },
            'date-time.original': 'two days',
            'time-relational': 'how long until',
            'time-relational.original': 'will',
          },
        },
      ],
    });
  });
  it('should process history object when contained in contexts', () => {
    expect.assertions(2);
    const reqOut = handleDialogflowReq(dfReqHist);
    const histInput = dfReqHist.queryResult.outputContexts[1].parameters;
    const history = new History({ ...histInput });
    expect(reqOut.historyInstance).toStrictEqual(history);
    expect(reqOut.historyInstance instanceof History).toStrictEqual(true);
  });
  it('should replace old history object when creating response', () => {
    expect.assertions(3);
    const reqOut = handleDialogflowReq(dfReqHist);
    const resOut = handleDialogflowRes({ text: 'hi mom!', ...reqOut });
    const historyContextIndex = resOut.outputContexts.flatMap((c, i) => {
      if (c.name === 'projects/day-of-the-week-snwd/agent/sessions/1fbb040d-a028-2fd5-8aa8-fa76896b2ea2/contexts/historyInstance') return i;
      return [];
    });
    expect(historyContextIndex).toHaveLength(1);
    const historyInstance = resOut.outputContexts[historyContextIndex[0]].parameters;
    const emptyHistory = new History();
    // check to make sure history context gets all the right keys pulled out
    expect(Object.keys(historyInstance))
      .toStrictEqual(expect.arrayContaining(Object.keys(emptyHistory)));
    // make sure history isn't accidentally carried over outside of contexts
    expect('history' in resOut).toStrictEqual(false);
  });
});
