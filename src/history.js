/**
 * @module history
 */
class History {
  /**
   * creates history object to keep track of where the conversation has been
   * keep track of the threads we have started, as well as all of the nodes w/in those threads
   *
   * @param {object} history - initalization obj that contains a previously defined history object,
   * e.g. one included in the contexts from an NLP
   * @param {object} history.threads - all threads touched so far, including their name,
   * the progress w/in the thread, and its parent thread (if applicable)
   * @param {Array} history.threadOrder - ordered array of all opened threads
   * @param {object} history.nodes - object of all opened nodes from all threads
   * @param {Array} history.nodeOrder - ordered array of all opened nodes
   * @param {RegExp} history.nodeRegex - regex pattern for parsing thread ID's, node names,
   * and EQ tags (optional). Must contain "threadID" and "nodeName" named capture groups,
   * w/ optional "eq" named capture group.
   */
  constructor(
    // can accept predefined history object, mostly for debugging but if you need to save
    // the conversation state between refreshes or something, you could use this for that too
    history = {},
  ) {
    // create an object *and* an array so that it's easy for us to iterate through
    // the data while being able to quickly access the object.
    this.threads = { ...history.threads || {} };
    this.threadOrder = [...history.threadOrder || []];
    this.nodes = { ...history.nodes || {} };
    this.nodeOrder = [...history.nodeOrder || []];

    // verifiy regex pattern has threadID and nodeName capture groups
    const nodeRegex = history.nodeRegex || /((?<threadID>([0-9A-Z.]+)+))?-?(?<nodeName>\w+)?(-(?<eq>CC|TM|ET|CM))?/gm;
    const verifyRegex = /(\?<threadID>|\?<nodeName>)/gm;
    const verifyOut = verifyRegex.exec(`${nodeRegex}`);
    if (verifyOut === null || verifyOut.length !== 2) throw new SyntaxError('regex pattern is missing required capture groups!');
    // save regex pattern to class instance
    this.nodeRegex = nodeRegex;
  }

  // record a conversation step, takes a node name and automatically
  // parses out thread and node ID's, records to class instance
  recordStep(nodeString) {
    // for some reason, running the regex multiple times would cause the output
    // to truncate at the length of the previous input,
    // so we create a new instance of the regex each time
    const regexPat = new RegExp(this.nodeRegex);
    const regexOutput = regexPat.exec(nodeString);
    // console.log(regexOutput);
    if (regexOutput === null || regexOutput.groups.threadID === undefined) {
      console.log(`Node: ${nodeString} does not match thread ID pattern, recording only node order history`);
      this.nodeOrder.push(nodeString);
      return;
    }
    const { threadID: threadIDContents, nodeName: nodeUniqueName } = regexOutput.groups;
    // array of integers + letters comprising the thread ID with the nodeID at the end
    const threadIDComponents = threadIDContents.split('.');
    // node number is the last number in the sequence
    const nodeNumber = threadIDComponents.slice(-1)[0];
    const threadID = threadIDComponents.slice(0, threadIDComponents.length - 1).join('.');
    const nodeName = `${threadID}.${nodeNumber}-${nodeUniqueName}`;
    // if root has not been recorded, create that
    if ('root' in this.threads === false) {
      this.threadOrder.push('root');
      this.threads.root = {
        name: 'root',
        threadProgress: [threadID],
      };
    }
    // if thread has not been recorded, create that
    if (threadID in this.threads === false) {
      // check if parent besides root exists
      const possibleParent = threadIDComponents.slice(0, threadIDComponents.length - 2).join('.');
      let parent = 'root';
      // populate parent key w/ thread ID if parent exists
      if (possibleParent in this.threads) parent = possibleParent;
      // push thread ID to threadOrder array
      this.threadOrder.push(threadID);
      // crete thread object, store in threads object
      this.threads[threadID] = {
        name: threadID,
        threadProgress: [nodeName],
        parent,
      };
    } else {
      this.threads[threadID].threadProgress.push(nodeName);
    }
    // record node
    this.nodeOrder.push(nodeName);
    if (nodeName in this.nodes === false) {
      this.nodes[nodeName] = {
        name: nodeName,
        nodeID: `${threadID}.${nodeNumber}`,
        threadID,
        nodeNumber: parseInt(nodeNumber, 10),
      };
      // if regex pulls out eq dashboard param from input and there is a value, include in output
      if ('eq' in regexOutput.groups && regexOutput.groups.eq !== undefined) {
        this.nodes[nodeName] = {
          ...this.nodes[nodeName],
          eq: regexOutput.groups.eq,
        };
      }
    }
  }

  // retrieve n number of nodes back in the conversation
  // for stuff like "what was that?" or "what did you say before that?"
  recallNodes(steps = 1) {
    const recalledNode = this.nodeOrder.slice(-1 * steps);
    return recalledNode[0];
  }

  export() {
    const {
      threads,
      threadOrder,
      nodes,
      nodeOrder,
      nodeRegex,
    } = this;
    return {
      threads,
      threadOrder,
      nodes,
      nodeOrder,
      nodeRegex,
    };
  }
}

module.exports = History;
