import _ from 'lodash';
import jira from './jira.js';
import moment from 'moment';
import Promise from 'bluebird';

const epicIssueTypeId = '6';
const epicFieldName = 'customfield_10300';
const epicKeyNone = '(none)';

function aggregateWorkLogs(issue, totalTime, fromTime, toTime, accountId) {
  return jira.issue(issue.id).getWorklogs()
    .then(worklog => {
      if (isNaN(totalTime)) {
        totalTime = 0;
      }

      for (let i = 0; i < worklog.worklogs.length; i++) {
        let entry = worklog.worklogs[i];
        if (entry.author.accountId === accountId && moment(entry.started).isBetween(fromTime, toTime)) {
          totalTime += entry.timeSpentSeconds;
        }
      }

      return totalTime;
    });
}

function getWorkLog(issues, epicMap, fromTime, toTime, accountId, epicKey) {
  if (issues && issues.length) {
    return Promise.each(issues, issue => {
      epicKey = issue.fields[epicFieldName] || epicKey || epicKeyNone;

      return aggregateWorkLogs(issue, epicMap[epicKey], fromTime, toTime, accountId)
        .then(totalTime => {
          epicMap[epicKey] = totalTime;

          return getWorkLog(issue.fields.subtasks, epicMap, fromTime, toTime, accountId, epicKey);
        });
    });
  }
}

export default function (fromTime, toTime, workingSeconds) {
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

      var accountId;
      const epicMap = {};

      return jira.getMyself()
        .then(result => {
          accountId = result.accountId;
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
        .then(issues => getWorkLog(issues, epicMap, fromTime, toTime, accountId))
        // Aggregate the worklog for the epics
        .then(() => _(storiesAndBugs.issues)
          .filter(issue => issue.fields.issuetype.id === epicIssueTypeId)
          .each(epic => aggregateWorkLogs(epic, epicMap[epic.key], fromTime, toTime, accountId)))
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
