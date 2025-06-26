import TogglClient from 'toggl-client';
import config from './config.js';

const client = TogglClient({
  apiToken: config.toggl.apiToken
});

export default {
  getTimeEntriesAsync(startDate, endDate) {
    return client.timeEntries.list({
      'start_date': startDate,
      'end_date': endDate
    });
  }
}
