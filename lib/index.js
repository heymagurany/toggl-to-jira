import moment from 'moment';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

function printJSON(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const argv = yargs(hideBin(process.argv))
  .command('epic', 'Output rolled-up work log per epic for a time range.', (yargs) => {
    return yargs
      .option('from-time', {
        describe: 'The date/time from which to search for work logs, inclusive.',
        alias: 'f',
        default: moment().startOf('month'),
        type: 'string',
        coerce: arg => moment(arg)
      })
      .option('to-time', {
        describe: 'The date/time to which to search for work logs, non-inclusive.',
        alias: 't',
        default: moment().endOf('month'),
        type: 'string',
        coerce: arg => moment(arg)
      })
      .option('last-month', {
        describe: 'Search last month\'s work logs.',
        type: 'boolean'
      })
      .option('working-days', {
        describe: 'The number of days to include in the calculation.',
        alias: 'w',
        type: 'number'
      })
      .check((argv) => {
        if (argv.fromTime && !argv.fromTime.isValid()) {
          throw new Error('Invalid from-time');
        }
        if (argv.toTime && !argv.toTime.isValid()) {
          throw new Error('Invalid to-time');
        }
        return true;
      });
  }, async(argv) => {
    const epicRollUp = (await import('./epic-work-log.js')).default;
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

    try {
      const result = await epicRollUp(fromTime, toTime, workingSeconds);
      printJSON(result);
    } catch (error) {
      printJSON(error);
    }
  })
  .command('sync', 'Log time Toggl time log to Jira', (yargs) => {
    return yargs
      .option('from-time', {
        describe: 'The date/time from which to sync work logs, inclusive.',
        alias: 'f',
        default: moment().startOf('day'),
        type: 'string',
        coerce: arg => moment(arg)
      })
      .option('to-time', {
        describe: 'The date/time to which to sync work logs, exclusive.',
        alias: 't',
        default: moment(),
        type: 'string',
        coerce: arg => moment(arg)
      })
      .option('today', {
        describe: 'Sync today\'s entries.',
        type: 'boolean'
      })
      .option('yesterday', {
        describe: 'Sync yesterday\'s entries.',
        type: 'boolean'
      })
      .option('dry-run', {
        describe: 'Calculate the sync operations without making changes.',
        alias: 'd',
        type: 'boolean'
      })
      .check((argv) => {
        if (argv.fromTime && !argv.fromTime.isValid()) {
          throw new Error('Invalid from-time');
        }
        if (argv.toTime && !argv.toTime.isValid()) {
          throw new Error('Invalid to-time');
        }
        return true;
      });
  }, async(argv) => {
    const syncEntries = (await import('./sync-entries.js')).default;
    let fromTime, toTime;

    if (argv.today) {
      fromTime = moment().startOf('day');
      toTime = moment().add(1, 'day').startOf('day');
    } else if (argv.yesterday) {
      fromTime = moment().subtract(1, 'day').startOf('day');
      toTime = moment(fromTime).endOf('day');
    } else {
      fromTime = argv.fromTime;
      toTime = argv.toTime;
    }

    try {
      const result = await syncEntries(fromTime, toTime, argv.dryRun);
      printJSON(result);
    } catch (error) {
      printJSON(error);
    }
  })
  .demandCommand(1)
  .help()
  .parse();
