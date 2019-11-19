const _ = require('lodash');
const moment = require('moment');
const jira = require('./jira');
const toggl = require('./toggl');

const togglEntryRegex = /^\s*\[?(\w+-\d+)\]?.*$/i;

function entryComparator(entry1, entry2) {
  return entry1.key === entry2.key && moment(entry1.start).isSame(entry2.start, 'second');
}

module.exports = function (startDate, endDate, dryRun) {
  return toggl.getTimeEntriesAsync(moment(startDate).toISOString(), moment(endDate).toISOString())
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

      return togglEntries;
    })
    .then(togglEntries => {
      const keys = Object.keys(togglEntries);
      return Promise.all(keys.map(key => jira.issue(key).getWorklogs()
        .then(result => result.worklogs
          .map(worklog => {
            return {
              key: key,
              id: worklog.id,
              start: moment(worklog.started),
              duration: worklog.timeSpentSeconds
            };
          })
          .filter(entry => entry.start.isBetween(startDate, endDate, 'seconds', '[)')))))
        .then(results => {
          return {
            toggl: _.flatMap(togglEntries),
            jira: _.flatMap(results)
          };
        });
    })
    .then(entries => {
      const add = _.differenceWith(entries.toggl, entries.jira, entryComparator);
      const update = [];
      const remove = _.differenceWith(entries.jira, entries.toggl, entryComparator);
      let promise;

      entries.toggl.forEach(togglEntry => {
        entries.jira.forEach(jiraEntry => {
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
        promise = Promise.all(add.map(entry => jira.issue(entry.key).addWorklog({
          comment: '',
          started: entry.start,
          timeSpentSeconds: entry.duration
        })))
          .then(() => Promise.all(update.map(entry => jira.issue(entry.key).updateWorklog(entry.id, {
            started: entry.start,
            timeSpentSeconds: entry.duration
          }))))
          .then(() => Promise.all(remove.map(entry => jira.issue(entry.key).deleteWorklog(entry.id))));
      }

      return promise.then(() => {
        return {
          added: add,
          updated: update,
          removed: remove
        };
      });
    });
};