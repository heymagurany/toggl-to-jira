const moment = require('moment');
const argv = require('yargs')
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
    'working-days': {
      describe: 'The number of days to include in the calculation.',
      alias: 'w',
      number: true
    }
  }, argv => {
    const epicRollUp = require('./epic-work-log');
    const fromTime = argv.fromTime;
    const toTime = argv.toTime;
    
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

    console.log('WORKING DAYS: ' + workingDays);

    epicRollUp(fromTime, toTime, workingSeconds);
  })
  .demand(1)
  .help()
  .argv;
