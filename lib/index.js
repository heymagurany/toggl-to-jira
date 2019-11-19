const moment = require('moment');

function printJSON(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

require('yargs')
  .command('epic', 'Output rolled-up work log per epic for a time range.', {
    'from-time': {
      describe: 'The date/time from which to search for work logs, inclusve.',
      alias: 'f',
      default: moment().startOf('month'),
      string: true,
      coerce: arg => moment(arg),
      check: argv => argv.startTime.isValid()
    },
    'to-time': {
      describe: 'The date/time to which to search for work logs, non-inclusve.',
      alias: 't',
      default: moment().endOf('month'),
      string: true,
      coerce: arg => moment(arg),
      check: argv => argv.endTime.isValid()
    },
    'last-month': {
      describe: 'Search last month\'s work logs.',
      boolean: true
    },
    'working-days': {
      describe: 'The number of days to include in the calculation.',
      alias: 'w',
      number: true
    }
  }, argv => {
    const epicRollUp = require('./epic-work-log');
    let fromTime, toTime;

    if (argv.lastMonth) {
      fromTime = moment().subtract(1, 'month').startOf('month');
      toTime = moment().startOf('month');
    } else {
      fromTime = argv.fromTime;
      toTime = argv.toTime;
    }
   
    var workingDays = argv.workingDays;

    if (isNaN(workingDays)) {
      var currentTime = moment(fromTime);
      workingDays = 0;
      while (currentTime.isBefore(toTime)) {
        if (currentTime.day() > 0 && currentTime.day() < 6) {
          workingDays++;
        }
        currentTime.add(1, 'day');
      }
    }

    const workingSeconds = workingDays * 28800;

    epicRollUp(fromTime, toTime, workingSeconds)
      .then(printJSON, printJSON);
  })
  .command('sync', 'Log time Toggl time log to Jira', {
    'from-time': {
      describe: 'The date/time from which to sync work logs, inclusve.',
      alias: 'f',
      default: moment().startOf('day'),
      string: true,
      coerce: arg => moment(arg),
      check: argv => argv.startTime.isValid()
    },
    'to-time': {
      describe: 'The date/time to which to sync work logs, exclusve.',
      alias: 't',
      default: moment(),
      string: true,
      coerce: arg => moment(arg),
      check: argv => argv.endTime.isValid()
    },
    'today': {
      describe: 'Sync today\'s entries.',
      boolean: true
    },
    'yesterday': {
      describe: 'Sync yesterday\'s entries.',
      boolean: true
    },
    'dry-run': {
      describe: 'Calculate the sync operations without making changes.',
      alias: 'd',
      boolean: true
    }
  }, argv => {
    const syncEntries = require('./sync-entries');
    let fromTime, toTime;

    if (argv.today) {
      fromTime = moment().startOf('day');
    } else if (argv.yesterday) {
      fromTime = moment().subtract(1, 'day').startOf('day');
      toTime = moment(fromTime).endOf('day');
    } else {
      fromTime = argv.fromTime;
      toTime = argv.toTime;
    }

    if (!argv.toTime) {
      toTime = moment();
    }

    syncEntries(fromTime, toTime, argv.dryRun)
      .then(printJSON, printJSON);
  })
  .demand(1)
  .help()
  .argv;
