const _ = require('lodash');
const Promise = require('bluebird');
const readline = require('readline');
const request = require('request-promise');
const Writable = require('stream').Writable;

const BASEURL = 'https://inindca.atlassian.net/rest/api/2/';
const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST'
};
const API_ENDPOINTS = {
  SEARCH: 'search',
  ISSUES: {
    issue(issueIdOrKey) {
      return {
        WORKLOG: `issue/${issueIdOrKey}/worklog`
      }
    }
  }
};

var credentialCache = {};

function authenticate() {
  if (!credentialCache.username || !credentialCache.password) {
    var mute = false;
    const mutedStdout = new Writable({
      write: function(chunk, encoding, callback) {
        if (!mute) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });
    const interface = readline.createInterface({
      input: process.stdin,
      output: mutedStdout,
      terminal: true
    });

    return new Promise(resolve => {
      interface.question('Jira username: ', resolve);
    })
    .then(username => {
      credentialCache.username = username;
    })
    .then(() => new Promise(resolve => {
      interface.question('Jira password: ', resolve);
      mute = true;
    }))
    .then(password => {
      credentialCache.password = password;
      mute = false;
      interface.write('\n');
      return credentialCache;
    })
    .finally(() => {
      interface.close();
    });
  }
  
  return Promise.resolve(credentialCache);
}

function makeRequest(method, path, options) {
  return authenticate()
  .then(credentials => request(_.assign(options, {
    auth: credentials,
    method,
    url: BASEURL + path,
    json: true,
    headers: {
      'Accept': 'application/json'
    }
  })));
}

function wrapBody(body) {
  return {
    headers: {
      'Content-Type': 'application/json'
    },
    body: body
  };
}

exports.search = body => makeRequest(HTTP_METHODS.POST, API_ENDPOINTS.SEARCH, wrapBody(body));
exports.getUsername = () => authenticate().then(credentials => credentials.username);
exports.issue = {
  getWorklogs: issueIdOrKey => makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.ISSUES.issue(issueIdOrKey).WORKLOG)
};
