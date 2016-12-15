const _ = require('lodash');
const jira = require('./jira');
const moment = require('moment');
const Promise = require('bluebird');

const epicIssueTypeId = '6';
const epicFieldName = 'customfield_10300';

function aggregateWorkLogs(issue, totalTime, fromTime, toTime, username) {
  var worklog = issue.fields.worklog;

  if (worklog) {
    if (worklog.total > worklog.maxResults) {
      console.warn('Worklog does not contain all results.');
    }

    return _(worklog.worklogs)
    .filter(worklog => worklog.author.name === username)
    .filter(worklog => moment(worklog.started).isBetween(fromTime, toTime))
    .map(worklog => worklog.timeSpentSeconds)
    .reduce(_.add, totalTime);
  }

  return totalTime;
}

function getWorkLog(issues, epicMap, fromTime, toTime, username, epicKey) {
  if (issues) {
    return Promise.each(issues, issue => {
      epicKey = issue.fields[epicFieldName] || epicKey;

      if (epicKey) {
          epicMap[epicKey] = aggregateWorkLogs(issue, epicMap[epicKey], fromTime, toTime, username);
      }
      else {
        console.log(`MISS! ${issue.key}`);
      }

      return getWorkLog(issue.fields.subtasks, epicMap, fromTime, toTime, username, epicKey);
    });
  }
}

module.exports = function (fromTime, toTime, workingSeconds) {
  return jira.search({
    jql: `worklogAuthor = currentUser() AND worklogDate >= ${fromTime.format('YYYY-MM-DD')} AND worklogDate < ${toTime.format('YYYY-MM-DD')}`,
    startAt: 0,
    maxResults: 1000,
    fields: [
      epicFieldName,
      'subtasks',
      'worklog',
      'issuetype',
      'parent'
    ]
  })
  .then(storiesAndBugs => {
    if (storiesAndBugs.total > storiesAndBugs.maxResults) {
      console.warn('Query result does not contain all results.');
    }

    var username;
    const epicMap = {};

    return jira.username()
    .then(result => username = result)
    .then(() =>_(storiesAndBugs.issues)
      .filter(issue => !issue.fields[epicFieldName] && issue.fields.parent)
      .map(issue => issue.fields.parent.key)
      .join(','))
    .then(issueKeys => jira.search({
      jql: `key in (${issueKeys})`,
      startAt: 0,
      maxResults: 1000,
      fields: [
        epicFieldName,
        'subtasks',
        'worklog',
        'issuetype'
      ]
    }))
    .then(result => _(storiesAndBugs.issues)
      .filter(issue => issue.fields[epicFieldName])
      .unionBy(result.issues, issue => issue.key))
    .then(issues => getWorkLog(issues, epicMap, fromTime, toTime, username))
    .then(() => _(storiesAndBugs.issues)
      .filter(issue => issue.fields.issuetype.id === epicIssueTypeId)
      .each(epic => aggregateWorkLogs(epic, epicMap[epic.key], fromTime, toTime, username)))
    .then(() => epicMap);
  })
  .then(epicMap => {
    console.log(epicMap);
    console.log();

    _.forIn(epicMap, (value, key) => {
      var secondsLogged = value;

      if (secondsLogged) {
        var percent = (secondsLogged / workingSeconds) * 100;

        console.log(`${key}: ${secondsLogged} ${percent.toFixed()}%`);
      }
    });

    return epicMap;
  });
};
