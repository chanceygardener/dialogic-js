const fs = require('fs');
const { promisify } = require('util');

// promisify readFile
const readFile = promisify(fs.readFile);

module.exports = {
  readFile,
};
