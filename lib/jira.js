const _ = require('lodash');
const Promise = require('bluebird');
const readline = require('readline');
const request = require('request-promise');
const Writable = require('stream').Writable;
const moment = require('moment');
const config = require('./config');

const BASEURL = 'https://inindca.atlassian.net/rest';
const HTTP_METHODS = {
  DELETE: 'DELETE',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT'
};
const API_ENDPOINTS = {
  SEARCH: '/api/2/search',
  ISSUES: {
    issue(issueIdOrKey) {
      const path = `/api/2/issue/${issueIdOrKey}/worklog`;
      return {
        worklog(worklogId) {
          return `${path}/${worklogId}`;
        },
        WORKLOGS: path
      };
    }
  },
  SESSION: '/auth/1/session'
};

var credentialCache = {};

if (config.jira && config.jira.credentials) {
  credentialCache.username = config.jira.credentials.username;
  credentialCache.password = config.jira.credentials.password;
}

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

function formatDate(date) {
  return moment(date).format('YYYY-MM-DDTkk:mm:ss.000ZZ');
}

exports.search = body => makeRequest(HTTP_METHODS.POST, API_ENDPOINTS.SEARCH, wrapBody(body));
exports.getUsername = () => makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.SESSION).then(session => session.name);
exports.issue = function(issueIdOrKey) {
  return {
    addWorklog(worklog) {
      worklog.started = formatDate(worklog.started);
      return makeRequest(HTTP_METHODS.POST, API_ENDPOINTS.ISSUES.issue(issueIdOrKey).WORKLOGS, wrapBody(worklog));
    },
    deleteWorklog(worklogId) {
      return makeRequest(HTTP_METHODS.DELETE, API_ENDPOINTS.ISSUES.issue(issueIdOrKey).worklog(worklogId));
    },
    getWorklogs() {
      return makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.ISSUES.issue(issueIdOrKey).WORKLOGS);
    },
    updateWorklog(worklogId, worklog) {
      worklog.started = formatDate(worklog.started);
      return makeRequest(HTTP_METHODS.PUT, API_ENDPOINTS.ISSUES.issue(issueIdOrKey).worklog(worklogId), wrapBody(worklog));
    }
  };
};
