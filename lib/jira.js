import _ from 'lodash';
import moment from 'moment';
import config from './config.js';
import credentials from './credentials.js';

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

async function makeRequest(method, path, options = {}) {
  const auth = config.jira && config.jira.credentials 
    ? config.jira.credentials 
    : await credentials();
    
  const url = BASEURL + path;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add Basic Auth header
  const authString = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  headers['Authorization'] = `Basic ${authString}`;

  const fetchOptions = {
    method,
    headers
  };

  // Add body for POST/PUT requests
  if (options.body && (method === 'POST' || method === 'PUT')) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

function wrapBody(body) {
  return {
    body: body
  };
}

function formatDate(date) {
  return moment(date).format('YYYY-MM-DDTkk:mm:ss.000ZZ');
}

export const getMyself = () => makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.MYSELF);
export const search = body => makeRequest(HTTP_METHODS.POST, API_ENDPOINTS.SEARCH, wrapBody(body));
export const getUsername = async() => {
  const session = await makeRequest(HTTP_METHODS.GET, API_ENDPOINTS.SESSION);
  return session.name;
};

export const issue = function(issueIdOrKey) {
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

export default {
  getMyself,
  search,
  getUsername,
  issue
};
