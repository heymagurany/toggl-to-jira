const TogglClient = require('toggl-api');
const Promise = require('bluebird');
const config = require('./config');
const credentials = require('./credentials');

Promise.promisifyAll(TogglClient.prototype);

let options;

if (config.toggl && config.toggl.apiToken) {
  options = {
    apiToken: config.toggl.apiToken
  };
} else {
  options = {
    username: true,
    password: true
  };

  let superApiRequest = TogglClient.prototype.apiRequest;
  let credentialCache;

  TogglClient.prototype.apiRequest = function apiRequest(path, opts, callback) {
    const client = this;

    if (credentialCache) {
      const options = Object.assign({}, opts, {
        auth: credentialCache,
        noauth: true
      });
      
      return superApiRequest.call(client, path, options, callback);
    }

    credentials().then(auth => {
      credentialCache = auth;

      client.apiRequest.call(client, path, opts, callback);
    });
  };
}

module.exports = new TogglClient(options);
