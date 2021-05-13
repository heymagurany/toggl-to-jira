const TogglClient = require('toggl-client');
const config = require('./config');

const client = TogglClient({
  apiToken: config.toggl.apiToken
});

module.exports = {
  getTimeEntriesAsync(startDate, endDate) {
    return client.timeEntries.list({
      'start_date': startDate,
      'end_date': endDate
    });
  }
}
