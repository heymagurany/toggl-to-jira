import _ from 'lodash';
import moment from 'moment';
import Promise from 'bluebird';
import jira from './jira.js';
import toggl from './toggl.js';

const togglEntryRegex = /^\s*\[?(\w+-\d+)\]?.*$/i;

function entryComparator(entry1, entry2) {
  return entry1.key === entry2.key && moment(entry1.start).isSame(entry2.start, 'second');
}

export default async function (startDate, endDate, dryRun) {
  const [timeEntries, jiraResult] = await Promise.all([
    toggl.getTimeEntriesAsync(moment(startDate).toISOString(), moment(endDate).toISOString()),
    jira.search({
      jql: `worklogAuthor = currentUser() AND worklogDate >= ${moment(startDate).format('YYYY-MM-DD')} AND worklogDate < ${moment(endDate).format('YYYY-MM-DD')}`,
      startAt: 0,
      maxResults: 1000,
      fields: [
        'worklog'
      ]
    })
  ]);

  const togglEntries = {};
  timeEntries.forEach(entry => {
    let matches = togglEntryRegex.exec(entry.description);

    if (matches && matches.length > 1) {
      let key = matches[1];
      
      if (!togglEntries[key]) {
        togglEntries[key] = [];
      }

      togglEntries[key].push({
        key,
        start: moment(entry.start),
        duration: Math.ceil(entry.duration / 60) * 60
      });
    }        
  });

  const togglEntriesFlat = _.flatMap(togglEntries);
  const jiraEntries = _.flatMap(jiraResult.issues, issue => 
    issue.fields.worklog.worklogs.map(worklog => ({
      key: issue.key,
      id: worklog.id,
      start: moment(worklog.started),
      duration: worklog.timeSpentSeconds
    })).filter(entry => entry.start.isBetween(startDate, endDate, 'seconds', '[)'))
  );

  const add = _.differenceWith(togglEntriesFlat, jiraEntries, entryComparator);
  const update = [];
  const remove = _.differenceWith(jiraEntries, togglEntriesFlat, entryComparator);

  togglEntriesFlat.forEach(togglEntry => {
    jiraEntries.forEach(jiraEntry => {
      if (entryComparator(togglEntry, jiraEntry) && togglEntry.duration !== jiraEntry.duration) {
        update.push({
          key: jiraEntry.key,
          id: jiraEntry.id,
          start: togglEntry.start,
          duration: togglEntry.duration
        });
      }
    });
  });

  if (!dryRun) {
    // Add worklogs
    await Promise.all(add.map(async (entry, i) => {
      try {
        await jira.issue(entry.key).addWorklog({
          comment: '',
          started: entry.start,
          timeSpentSeconds: entry.duration
        });
      } catch (error) {
        console.error(`Error adding worklog for ${entry.key}: ${error}`);
        add.splice(i, 1);
      }
    }));

    // Update worklogs
    await Promise.all(update.map(async (entry, i) => {
      try {
        await jira.issue(entry.key).updateWorklog(entry.id, {
          started: entry.start,
          timeSpentSeconds: entry.duration
        });
      } catch (error) {
        console.error(`Error updating worklog for ${entry.key}: ${error}`);
        update.splice(i, 1);
      }
    }));

    // Remove worklogs
    await Promise.all(remove.map(async (entry, i) => {
      try {
        await jira.issue(entry.key).deleteWorklog(entry.id);
      } catch (error) {
        console.error(`Error deleting worklog for ${entry.key}: ${error}`);
        remove.splice(i, 1);
      }
    }));
  }

  return {
    added: add,
    updated: update,
    removed: remove
  };
}