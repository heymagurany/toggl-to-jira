var timeCard = require('../lib/timecard.js');
var toggl = require('../lib/toggl.js');
var async = require('async');

var getTimeEntries = function (togglClient, startDate, endDate, callback) {
  async.waterfall([
    //toggl.getWorkspaceID
    function (callback) {
      var question = 'From which workspace do you want to export?';

      toggl.getWorkspaceID(togglClient, question, function(err, togglWorkspaceID) {
        callback(err, togglWorkspaceID);
      });
    },
    //togglClient.getWorkspaceProjects
    function (togglWorkspaceID, callback) {
      var options = {
        active: 'both'
      };

      togglClient.getWorkspaceProjects(togglWorkspaceID, options, function (err, togglProjects) {
        if (err) {
          callback(err);
          return;
        }

        var togglProjectsLookup = {};

        togglProjects.forEach(function (togglProject) {
          togglProjectsLookup[togglProject.id] = {
            name: togglProject.name,
            tasksLookup: {}
          };
        });

        callback(null, togglWorkspaceID, togglProjectsLookup);
      });
    },
    //togglClient.getWorkspaceTasks
    function (togglWorkspaceID, togglProjectsLookup, callback) {
      var options = {
        active: 'both'
      };

      togglClient.getWorkspaceTasks(togglWorkspaceID, options, function (err, togglTasks) {
        if (err) {
          callback(err);
          return;
        }

        togglTasks.forEach(function (togglTask) {
          var togglProject = togglProjectsLookup[togglTask.pid];

          togglProject.tasksLookup[togglTask.id] = togglTask.name;
        });

        callback(null, togglProjectsLookup);
      });
    },
    //togglClient.getTimeEntries
    function (togglProjectsLookup, callback) {
      var togglTimeEntries = [];

      togglClient.getTimeEntries(startDate.toISOString(), endDate.toISOString(), function (err, timeEntries) {
        if (err) {
          callback(err);
          return;
        }

        var days = {};

        timeEntries.forEach(function (togglTimeEntry) {
          var date = new Date(togglTimeEntry.start);
          date.setHours(0, 0, 0, 0);

          var dateKey = date.toDateString();

          var day = days[dateKey];

          if (!day) {
            day = {};
            days[dateKey] = day;
          }

          var dayEntry = day[togglTimeEntry.description];

          if (!dayEntry) {
            var togglProject = togglProjectsLookup[togglTimeEntry.pid];

            if (!togglProject) {
              callback('No project found for entry "' + togglTimeEntry.description + '" on ' + date.toDateString() + '.');
              return;
            }

            var togglTask = togglProject.tasksLookup[togglTimeEntry.tid];
            var togglTag;

            if (!togglTask) {
              callback('No task found for entry "' + togglTimeEntry.description + '" on ' + date.toDateString() + '.');
              return;
            }

            if (togglTimeEntry.tags && (togglTimeEntry.tags.length > 0)) {
              togglTag = togglTimeEntry.tags[0];
            }
            else {
              callback('No tags found for entry "' + togglTimeEntry.description + '" on ' + date.toDateString() + '.');
              return;
            }

            day[togglTimeEntry.description] = {
              date: date,
              duration: togglTimeEntry.duration,
              project: togglProject.name,
              task: togglTask,
              description: togglTimeEntry.description,
              activity: togglTag,
              billable: togglTimeEntry.billable
            };
          }
          else {
            dayEntry.duration += togglTimeEntry.duration;
          }
        });

        for (var dateKey in days) {
          var day = days[dateKey];

          for (var description in day) {
            var entry = day[description];
            var minutes = Math.ceil(Math.floor(entry.duration / 450) / 2) * 15;

            togglTimeEntries.push({
              project: entry.project,
              task: entry.task,
              activity: entry.activity,
              date: entry.date,
              minutes: minutes,
              description: description,
              billable: entry.billable
            });
          }
        }

        callback(null, togglTimeEntries);
      });
    }
  ],
  function (err, togglTimeEntries) {
    callback (err, togglTimeEntries);
  });
};

exports.togglToTimeCard = function () {
  toggl.createClient(function (err, togglClient) {
    if (err) {
      console.log(err);
      return;
    }

    timeCard.authenticate(function (err, auth) {
      if (err) {
        console.log(err);
        return;
      }

      var start;
      var end;

      if (process.argv.length > 2) {
        start = new Date(Date.parse(process.argv[2]));

        if (process.argv.length > 3) {
          end = new Date(Date.parse(process.argv[3]));
        }
        else {
          end = new Date();
        }
      }
      else {
        start = new Date();
        start.setHours(-24, 0, 0, 0);

        end = new Date();
        end.setHours(0, 0, 0, 0);
      }
      console.log('toggl-to-timecarding from ' + start + ' to ' + end + '...');

      getTimeEntries(togglClient, start, end, function (err, timeEntries) {
        if (err) {
          console.log(err);
          return;
        }

        console.log('Imported:');
        console.log('----------------------------------');

        timeEntries.forEach(function (timeEntry) {
          timeCard.addTimeEntry(auth, timeEntry, function(err, timeEntry) {
            if (err) {
              console.log(err);
              return;
            }

            console.log(timeEntry);
            console.log('----------------------------------');
          });
        });
      });
    });
  });
};
