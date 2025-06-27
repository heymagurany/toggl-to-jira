import { jest } from '@jest/globals';
import moment from 'moment';

describe('toggl module', () => {
  let togglModule;
  let TogglClient;
  let mockTogglClient;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create a shared mock client instance
    mockTogglClient = {
      timeEntries: {
        list: jest.fn()
      }
    };

    await jest.unstable_mockModule('toggl-client', () => ({
      default: jest.fn(() => mockTogglClient)
    }));

    await jest.unstable_mockModule('../lib/config.js', () => ({
      default: {
        toggl: {
          apiToken: 'test-api-token'
        }
      }
    }));

    togglModule = (await import('../lib/toggl.js')).default;
    TogglClient = (await import('toggl-client')).default;
  });

  describe('getTimeEntriesAsync', () => {
    it('should call toggl client with correct parameters', async () => {
      const startDate = '2023-01-01T00:00:00.000Z';
      const endDate = '2023-01-31T23:59:59.999Z';
      const mockTimeEntries = [
        { id: 1, description: 'Test entry 1', start: '2023-01-01T10:00:00Z', duration: 3600 },
        { id: 2, description: 'Test entry 2', start: '2023-01-02T11:00:00Z', duration: 1800 }
      ];

      mockTogglClient.timeEntries.list.mockResolvedValue(mockTimeEntries);

      const result = await togglModule.getTimeEntriesAsync(startDate, endDate);

      expect(mockTogglClient.timeEntries.list).toHaveBeenCalledWith({
        'start_date': startDate,
        'end_date': endDate
      });
      expect(result).toEqual(mockTimeEntries);
    });

    it('should handle errors from toggl client', async () => {
      const startDate = '2023-01-01T00:00:00.000Z';
      const endDate = '2023-01-31T23:59:59.999Z';
      const error = new Error('API Error');

      mockTogglClient.timeEntries.list.mockRejectedValue(error);

      await expect(togglModule.getTimeEntriesAsync(startDate, endDate))
        .rejects.toThrow('API Error');
    });

    it('should initialize toggl client with correct api token', async () => {
      expect(TogglClient).toHaveBeenCalledWith({
        apiToken: 'test-api-token'
      });
    });
  });
}); 