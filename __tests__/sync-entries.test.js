import { jest } from '@jest/globals';
import moment from 'moment';

describe('sync-entries module', () => {
  let syncEntriesModule;
  let mockToggl;
  let mockJira;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create shared mock instances
    mockToggl = {
      getTimeEntriesAsync: jest.fn()
    };

    mockJira = {
      search: jest.fn(),
      issue: jest.fn()
    };

    await jest.unstable_mockModule('../lib/toggl.js', () => ({
      default: mockToggl
    }));

    await jest.unstable_mockModule('../lib/jira.js', () => ({
      default: mockJira
    }));

    syncEntriesModule = (await import('../lib/sync-entries.js')).default;
  });

  describe('syncEntries', () => {
    const startDate = moment('2023-01-01T00:00:00Z');
    const endDate = moment('2023-01-02T00:00:00Z');

    it('should process toggl entries and find matching jira entries', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: '[TEST-123] Test work',
          start: '2023-01-01T10:00:00Z',
          duration: 3600
        },
        {
          id: 2,
          description: '[TEST-456] Another task',
          start: '2023-01-01T14:00:00Z',
          duration: 1800
        }
      ];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: [
                {
                  id: 1,
                  started: '2023-01-01T10:00:00.000Z',
                  timeSpentSeconds: 3600
                }
              ]
            }
          }
        },
        {
          key: 'TEST-456',
          fields: {
            worklog: {
              worklogs: [
                {
                  id: 2,
                  started: '2023-01-01T14:00:00.000Z',
                  timeSpentSeconds: 1800
                }
              ]
            }
          }
        }
      ];

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });

      const result = await syncEntriesModule(startDate, endDate, true); // dry run

      expect(mockToggl.getTimeEntriesAsync).toHaveBeenCalledWith(
        '2023-01-01T00:00:00.000Z',
        '2023-01-02T00:00:00.000Z'
      );
      expect(mockJira.search).toHaveBeenCalledWith({
        jql: 'worklogAuthor = currentUser() AND worklogDate >= 2022-12-31 AND worklogDate < 2023-01-01',
        startAt: 0,
        maxResults: 1000,
        fields: ['worklog']
      });

      expect(result).toEqual({
        added: [],
        updated: [],
        removed: []
      });
    });

    it('should identify entries to add when toggl entries exist but no matching jira entries', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: '[TEST-123] New work',
          start: '2023-01-01T10:00:00Z',
          duration: 3600
        }
      ];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: []
            }
          }
        }
      ];

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });

      const result = await syncEntriesModule(startDate, endDate, true); // dry run

      expect(result.added).toHaveLength(1);
      expect(result.added[0]).toEqual({
        key: 'TEST-123',
        start: expect.any(Object), // moment object
        duration: 3600
      });
    });

    it('should identify entries to update when durations differ', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: '[TEST-123] Updated work',
          start: '2023-01-01T10:00:00Z',
          duration: 7200 // 2 hours
        }
      ];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: [
                {
                  id: 1,
                  started: '2023-01-01T10:00:00.000Z',
                  timeSpentSeconds: 3600 // 1 hour
                }
              ]
            }
          }
        }
      ];

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });

      const result = await syncEntriesModule(startDate, endDate, true); // dry run

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toEqual({
        key: 'TEST-123',
        id: 1,
        start: expect.any(Object), // moment object
        duration: 7200
      });
    });

    it('should identify entries to remove when jira entries exist but no matching toggl entries', async () => {
      const mockTogglEntries = [];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: [
                {
                  id: 1,
                  started: '2023-01-01T10:00:00.000Z',
                  timeSpentSeconds: 3600
                }
              ]
            }
          }
        }
      ];

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });

      const result = await syncEntriesModule(startDate, endDate, true); // dry run

      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toEqual({
        key: 'TEST-123',
        id: 1,
        start: expect.any(Object), // moment object
        duration: 3600
      });
    });

    it('should handle entries without jira keys in description', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: 'Work without jira key',
          start: '2023-01-01T10:00:00Z',
          duration: 3600
        }
      ];

      const mockJiraIssues = [];

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });

      const result = await syncEntriesModule(startDate, endDate, true); // dry run

      expect(result.added).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should perform actual sync operations when not in dry run mode', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: '[TEST-123] New work',
          start: '2023-01-01T10:00:00Z',
          duration: 3600
        }
      ];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: []
            }
          }
        }
      ];

      const mockIssueMethods = {
        addWorklog: jest.fn().mockResolvedValue({ id: 1 })
      };

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });
      mockJira.issue.mockReturnValue(mockIssueMethods);

      const result = await syncEntriesModule(startDate, endDate, false); // not dry run

      expect(mockJira.issue).toHaveBeenCalledWith('TEST-123');
      expect(mockIssueMethods.addWorklog).toHaveBeenCalledWith({
        comment: '',
        started: expect.any(Object), // moment object
        timeSpentSeconds: 3600
      });

      expect(result.added).toHaveLength(1);
    });

    it('should handle errors during sync operations', async () => {
      const mockTogglEntries = [
        {
          id: 1,
          description: '[TEST-123] New work',
          start: '2023-01-01T10:00:00Z',
          duration: 3600
        }
      ];

      const mockJiraIssues = [
        {
          key: 'TEST-123',
          fields: {
            worklog: {
              worklogs: []
            }
          }
        }
      ];

      const mockIssueMethods = {
        addWorklog: jest.fn().mockRejectedValue(new Error('API Error'))
      };

      mockToggl.getTimeEntriesAsync.mockResolvedValue(mockTogglEntries);
      mockJira.search.mockResolvedValue({ issues: mockJiraIssues });
      mockJira.issue.mockReturnValue(mockIssueMethods);

      // Mock console.error to avoid output during tests
      const originalError = console.error;
      console.error = jest.fn();

      const result = await syncEntriesModule(startDate, endDate, false);

      expect(console.error).toHaveBeenCalledWith(
        'Error adding worklog for TEST-123: Error: API Error'
      );
      expect(result.added).toHaveLength(0); // Entry should be removed due to error

      // Restore console.error
      console.error = originalError;
    });
  });
}); 