const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');
const moment = require('moment');
const config = require('./config');
const credentials = require('./credentials');

const BASEURL = 'https://inindca.atlassian.net/rest';
const HTTP_METHODS = {
  DELETE: 'DELETE',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT'
};
const API_ENDPOINTS = {
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
  MYSELF: '/api/2/myself',
  SEARCH: '/api/2/search',
  SESSION: '/auth/1/session'
};

function makeRequest(method, path, options) {
  return Promise.try(() => {
    if (config.jira && config.jira.credentials) {
      return config.jira.credentials;
    }

    return credentials();
  })
    .then(auth => request(_.assign(options, {
      auth,
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

exports.getMyself = () => makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.MYSELF);
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
