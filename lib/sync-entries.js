import _ from 'lodash';
import moment from 'moment';
import Promise from 'bluebird';
import jira from './jira.js';
import toggl from './toggl.js';

const togglEntryRegex = /^\s*\[?(\w+-\d+)\]?.*$/i;

function entryComparator(entry1, entry2) {
  return entry1.key === entry2.key && moment(entry1.start).isSame(entry2.start, 'second');
}

export default function (startDate, endDate, dryRun) {
  return Promise.all([
    toggl.getTimeEntriesAsync(moment(startDate).toISOString(), moment(endDate).toISOString())
      .then(timeEntries => {
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

        return _.flatMap(togglEntries);
      }),
    jira.search({
      jql: `worklogAuthor = currentUser() AND worklogDate >= ${moment(startDate).format('YYYY-MM-DD')} AND worklogDate < ${moment(endDate).format('YYYY-MM-DD')}`,
      startAt: 0,
      maxResults: 1000,
      fields: [
        'worklog'
      ]
    })
      .then(result => _.flatMap(result.issues, issue => issue.fields.worklog.worklogs.map(worklog => {
        return {
          key: issue.key,
          id: worklog.id,
          start: moment(worklog.started),
          duration: worklog.timeSpentSeconds
        };
      }).filter(entry => entry.start.isBetween(startDate, endDate, 'seconds', '[)'))))
  ])
    .then(results => {
      const togglEntries = results[0];
      const jiraEntries = results[1];
      const add = _.differenceWith(togglEntries, jiraEntries, entryComparator);
      const update = [];
      const remove = _.differenceWith(jiraEntries, togglEntries, entryComparator);
      let promise;

      togglEntries.forEach(togglEntry => {
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

      if (dryRun) {
        promise = Promise.resolve();        
      } else {
        promise = Promise.all(add.map((entry, i) => jira.issue(entry.key).addWorklog({
          comment: '',
          started: entry.start,
          timeSpentSeconds: entry.duration
        })
          .catch(error => {
            console.error(`Error adding worklog for ${entry.key}: ${error}`);
            add.splice(i, 1);
          })))
          .then(() => Promise.all(update.map((entry, i) => jira.issue(entry.key).updateWorklog(entry.id, {
            started: entry.start,
            timeSpentSeconds: entry.duration
          })
            .catch(error => {
              console.error(`Error updating worklog for ${entry.key}: ${error}`);
              update.splice(i, 1);
            }))))
          .then(() => Promise.all(remove.map((entry, i) => jira.issue(entry.key).deleteWorklog(entry.id)
            .catch(error => {
              console.error(`Error updating worklog for ${entry.key}: ${error}`);
              remove.splice(i, 1);
            }))));
      }

      return promise.then(() => {
        return {
          added: add,
          updated: update,
          removed: remove
        };
      });
    });
}