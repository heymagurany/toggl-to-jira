const _ = require('lodash');
const Promise = require('bluebird');
const readline = require('readline');
const request = require('request-promise');

const BASEURL = 'https://inindca.atlassian.net/rest/api/2/';
const HTTP_METHODS = {
  POST: 'POST'
};
const API_ENDPOINTS = {
  SEARCH: 'search'
};

var credentialCache = {};

function authenticate() {
  if (!credentialCache.username || !credentialCache.password) {
    var interface = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      interface.question('Jira username: ', resolve);
    })
    .then(username => {
      credentialCache.username = username;
    })
    .then(() => new Promise(resolve => {
      interface.question('Jira password: ', resolve);
    }))
    .then(password => {
      credentialCache.password = password;
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

exports.search = body => makeRequest(HTTP_METHODS.POST, API_ENDPOINTS.SEARCH, {
  headers: {
    'Content-Type': 'application/json'
  },
  body: body
});