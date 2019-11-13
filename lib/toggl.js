const TogglClient = require('toggl-api');
const Promise = require('bluebird');
const config = require('./config');

Promise.promisifyAll(TogglClient.prototype);

module.exports = new TogglClient({
  apiToken: config.toggl.apiToken
});
