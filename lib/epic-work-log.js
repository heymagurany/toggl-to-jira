const _ = require('lodash');
const Promise = require('bluebird');
const jira = require('./jira');

const epicIssueTypeId = '6';
const epicFieldName = 'customfield_10300';

function aggregateWorkLogs(worklogs, totalTime) {
  return _(worklogs)
        .map(worklog => worklog.timeSpentSeconds)
        .reduce(_.add, totalTime);
}

function getWorkLog(issues, epicMap, epicKey) {
  if (issues) {
    return Promise.each(issues, issue => {
      epicKey = issue.fields[epicFieldName] || epicKey;

      if (epicKey) {
        var worklog = issue.fields.worklog;

        if (worklog) {
          if (worklog.total > worklog.maxResults) {
            console.warn('Worklog does not contain all results.');
          }

          epicMap[epicKey] = aggregateWorkLogs(worklog.worklogs, epicMap[epicKey]);
        }
      }
      else {
        console.log(`MISS! ${issue.key}`);
      }

      return getWorkLog(issue.fields.subtasks, epicMap, epicKey);
    });
  }
}

var epicMap = {};

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
    ],
    expand: [
      'parent.' + epicFieldName
    ]
  })
  .then(storiesAndBugs => {
    console.log(storiesAndBugs.issues[0]);
    if (storiesAndBugs.total > storiesAndBugs.maxResults) {
      console.warn('Query result does not contain all results.');
    }

    var issuesWithEpic = _.filter(storiesAndBugs.issues, issue => issue.fields[epicFieldName]);
    var issuesWithoutEpic = _.filter(storiesAndBugs.issues, issue => !issue.fields[epicFieldName]);
    var epics = _.filter(issuesWithoutEpic, issue => issue.fields.issuetype.id === epicIssueTypeId);

    return getWorkLog(storiesAndBugs.issues, epicMap);

    // TODO: get work log for epics
    // TODO: get epic for sub-tasks
  })
  .then(() => {
    _.forIn(epicMap, (value, key) => {
      var secondsLogged = value;

      if (secondsLogged) {
        var percent = (secondsLogged / workingSeconds) * 100;

        console.log(`${key}: ${secondsLogged} ${percent.toFixed()}%`);
      }
    });
  });
};
