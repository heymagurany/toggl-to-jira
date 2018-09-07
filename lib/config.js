const readAllUp = require('read-all-up');
const ini = require('ini');

try {
  var [ result ] = readAllUp.sync('.toggl-to-jirarc', {
    encoding: 'utf8'
  });
  var config = ini.parse(result.fileContents)
}
catch(error) {
  console.log(error);
}

module.exports = config;
