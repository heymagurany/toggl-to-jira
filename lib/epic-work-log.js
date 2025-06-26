import _ from 'lodash';
import jira from './jira.js';
import moment from 'moment';
import Promise from 'bluebird';

const epicIssueTypeId = '6';
const epicFieldName = 'customfield_10300';
const epicKeyNone = '(none)';

async function aggregateWorkLogs(issue, totalTime, fromTime, toTime, accountId) {
  const worklog = await jira.issue(issue.id).getWorklogs();
  
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
}

async function getWorkLog(issues, epicMap, fromTime, toTime, accountId, epicKey) {
  if (issues && issues.length) {
    await Promise.each(issues, async issue => {
      epicKey = issue.fields[epicFieldName] || epicKey || epicKeyNone;

      const totalTime = await aggregateWorkLogs(issue, epicMap[epicKey], fromTime, toTime, accountId);
      epicMap[epicKey] = totalTime;

      await getWorkLog(issue.fields.subtasks, epicMap, fromTime, toTime, accountId, epicKey);
    });
  }
}

export default async function(fromTime, toTime, workingSeconds) {
  const storiesAndBugs = await jira.search({
    jql: `worklogAuthor = currentUser() AND worklogDate >= ${fromTime.format('YYYY-MM-DD')} AND worklogDate < ${toTime.format('YYYY-MM-DD')}`,
    startAt: 0,
    maxResults: 1000,
    fields: [
      epicFieldName,
      'subtasks',
      'issuetype',
      'parent'
    ]
  });

  if (storiesAndBugs.total > storiesAndBugs.maxResults) {
    console.warn('Query result does not contain all results.');
  }

  const epicMap = {};

  const myself = await jira.getMyself();
  const accountId = myself.accountId;

  // Get the details of the parent stories for sub-tasks.
  const issueKeys = _(storiesAndBugs.issues)
    .filter(issue => issue.fields.parent)
    .map(issue => issue.fields.parent.key)
    .join(',');

  let result;
  if (issueKeys && issueKeys.length) {
    result = await jira.search({
      jql: `key in (${issueKeys})`,
      startAt: 0,
      maxResults: 1000,
      fields: [
        epicFieldName,
        'subtasks'
      ]
    });
  } else {
    result = {
      issues: []
    };
  }

  // Union the parents of sub-tasks with the list of stories we already have
  const issues = _(storiesAndBugs.issues)
    .unionBy(result.issues, issue => issue.key)
    .value();

  // Aggregate the worklog for the stories
  await getWorkLog(issues, epicMap, fromTime, toTime, accountId);

  // Aggregate the worklog for the epics
  await Promise.each(
    _(storiesAndBugs.issues)
      .filter(issue => issue.fields.issuetype.id === epicIssueTypeId)
      .value(),
    async epic => {
      await aggregateWorkLogs(epic, epicMap[epic.key], fromTime, toTime, accountId);
    }
  );

  return _.reduce(epicMap, (result, value, key) => {
    result[key] = {
      timeSpentSeconds: value,
      timeSpentPercent: Math.ceil((value / workingSeconds) * 100)
    };
    return result;
  }, {});
}
