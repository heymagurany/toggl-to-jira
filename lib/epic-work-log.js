const _ = require('lodash');
const jira = require('./jira');
const moment = require('moment');
const Promise = require('bluebird');

const epicIssueTypeId = '6';
const epicFieldName = 'customfield_10300';
const epicKeyNone = "(none)";

function aggregateWorkLogs(issue, totalTime, fromTime, toTime, username) {
  return jira.issue.getWorklogs(issue.id)
  .then(worklog => {
    if (isNaN(totalTime)) {
      totalTime = 0;
    }

    for (let i = 0; i < worklog.worklogs.length; i++) {
      let entry = worklog.worklogs[i];

      if (entry.author.name === username && moment(entry.started).isBetween(fromTime, toTime)) {
        totalTime += entry.timeSpentSeconds;
      }
    }

    return totalTime;
  });
}

function getWorkLog(issues, epicMap, fromTime, toTime, username, epicKey) {
  if (issues && issues.length) {
    return Promise.each(issues, issue => {
      epicKey = issue.fields[epicFieldName] || epicKey || epicKeyNone;

      return aggregateWorkLogs(issue, epicMap[epicKey], fromTime, toTime, username)
      .then(totalTime => {
        epicMap[epicKey] = totalTime;

        return getWorkLog(issue.fields.subtasks, epicMap, fromTime, toTime, username, epicKey);
      });
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

    return jira.getUsername()
    .then(result => {
      username = result;
    })
    // Get the details of the parent stories for sub-tasks.
    .then(() => _(storiesAndBugs.issues)
      // .filter(issue => !issue.fields[epicFieldName] && issue.fields.parent)
      .filter(issue => issue.fields.parent)
      .map(issue => issue.fields.parent.key)
      .join(','))
    .then(issueKeys => {
      if (issueKeys && issueKeys.length) {
        return jira.search({
          jql: `key in (${issueKeys})`,
          startAt: 0,
          maxResults: 1000,
          fields: [
            epicFieldName,
            'subtasks'
          ]
        });
      }

      return {
        issues: []
      };
    })
    // Union the parents of sub-tasks with the list of stories we already have
    .then(result => _(storiesAndBugs.issues)
      // .filter(issue => issue.fields[epicFieldName])
      .unionBy(result.issues, issue => issue.key)
      .value())
    // Aggregate the worklog for the stories
    .then(issues => getWorkLog(issues, epicMap, fromTime, toTime, username))
    // Aggregate the worklog for the epics
    .then(() => _(storiesAndBugs.issues)
      .filter(issue => issue.fields.issuetype.id === epicIssueTypeId)
      .each(epic => aggregateWorkLogs(epic, epicMap[epic.key], fromTime, toTime, username)))
    .then(() => epicMap);
  })
  .then(epicMap => _.reduce(epicMap, (result, value, key) => {
      result[key] = {
        timeSpentSeconds: value,
        timeSpentPercent: Math.ceil((value / workingSeconds) * 100)
      };
      return result;
    }, {}));
};
