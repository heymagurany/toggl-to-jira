import { jest } from '@jest/globals';
import moment from 'moment';

describe('epic-work-log module', () => {
  let epicWorkLogModule;
  let mockJira;
  let mockIssue;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create shared mock instances
    mockIssue = {
      getWorklogs: jest.fn()
    };

    mockJira = {
      search: jest.fn(),
      issue: jest.fn(() => mockIssue),
      getMyself: jest.fn()
    };

    await jest.unstable_mockModule('../lib/jira.js', () => ({
      default: mockJira
    }));

    epicWorkLogModule = (await import('../lib/epic-work-log.js')).default;
  });

  describe('getEpicWorkLog', () => {
    const startDate = moment('2023-01-01T00:00:00Z');
    const endDate = moment('2023-01-02T00:00:00Z');
    const workingSeconds = 28800; // 8 hours

    it('should search for stories and aggregate worklog data by epic', async () => {
      const mockStories = [
        {
          id: '12345',
          key: 'STORY-123',
          fields: {
            customfield_10300: 'EPIC-1', // epic field
            subtasks: [],
            issuetype: { id: '1' }, // story type
            parent: null
          }
        },
        {
          id: '12346',
          key: 'STORY-456',
          fields: {
            customfield_10300: 'EPIC-2', // epic field
            subtasks: [],
            issuetype: { id: '1' }, // story type
            parent: null
          }
        }
      ];

      const mockWorklogs = {
        worklogs: [
          {
            id: 1,
            started: '2023-01-01T10:00:00.000Z',
            timeSpentSeconds: 3600,
            author: { accountId: 'test-account-id' },
            comment: 'Work on story'
          }
        ]
      };

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: mockStories,
        total: 2,
        maxResults: 1000
      });
      mockIssue.getWorklogs.mockResolvedValue(mockWorklogs);

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(mockJira.getMyself).toHaveBeenCalled();
      expect(mockJira.search).toHaveBeenCalledWith({
        jql: 'worklogAuthor = currentUser() AND worklogDate >= 2022-12-31 AND worklogDate < 2023-01-01',
        startAt: 0,
        maxResults: 1000,
        fields: [
          'customfield_10300',
          'subtasks',
          'issuetype',
          'parent'
        ]
      });

      expect(result).toEqual({
        'EPIC-1': {
          timeSpentSeconds: 3600,
          timeSpentPercent: 13
        },
        'EPIC-2': {
          timeSpentSeconds: 3600,
          timeSpentPercent: 13
        }
      });
    });

    it('should handle stories with no worklogs', async () => {
      const mockStories = [
        {
          id: '12345',
          key: 'STORY-123',
          fields: {
            customfield_10300: 'EPIC-1',
            subtasks: [],
            issuetype: { id: '1' },
            parent: null
          }
        }
      ];

      const mockWorklogs = {
        worklogs: []
      };

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: mockStories,
        total: 1,
        maxResults: 1000
      });
      mockIssue.getWorklogs.mockResolvedValue(mockWorklogs);

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(result).toEqual({
        'EPIC-1': {
          timeSpentSeconds: 0,
          timeSpentPercent: 0
        }
      });
    });

    it('should handle empty search results', async () => {
      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: [],
        total: 0,
        maxResults: 1000
      });

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(result).toEqual({});
    });

    it('should handle search errors', async () => {
      const error = new Error('Search failed');
      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockRejectedValue(error);

      await expect(epicWorkLogModule(startDate, endDate, workingSeconds)).rejects.toThrow('Search failed');
    });

    it('should handle stories with missing epic field', async () => {
      const mockStories = [
        {
          id: '12345',
          key: 'STORY-123',
          fields: {
            // No customfield_10300 (epic field)
            subtasks: [],
            issuetype: { id: '1' },
            parent: null
          }
        }
      ];

      const mockWorklogs = {
        worklogs: [
          {
            id: 1,
            started: '2023-01-01T10:00:00.000Z',
            timeSpentSeconds: 3600,
            author: { accountId: 'test-account-id' },
            comment: 'Work on story'
          }
        ]
      };

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: mockStories,
        total: 1,
        maxResults: 1000
      });
      mockIssue.getWorklogs.mockResolvedValue(mockWorklogs);

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(result).toEqual({
        '(none)': {
          timeSpentSeconds: 3600,
          timeSpentPercent: 13
        }
      });
    });

    it('should handle epics with worklogs', async () => {
      const mockStories = [
        {
          id: '12345',
          key: 'EPIC-123',
          fields: {
            customfield_10300: null, // Epic doesn't have epic field
            subtasks: [],
            issuetype: { id: '6' }, // Epic type
            parent: null
          }
        }
      ];

      const mockWorklogs = {
        worklogs: [
          {
            id: 1,
            started: '2023-01-01T10:00:00.000Z',
            timeSpentSeconds: 3600,
            author: { accountId: 'test-account-id' },
            comment: 'Work on epic'
          }
        ]
      };

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: mockStories,
        total: 1,
        maxResults: 1000
      });
      mockIssue.getWorklogs.mockResolvedValue(mockWorklogs);

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(result).toEqual({
        '(none)': {
          timeSpentSeconds: 3600,
          timeSpentPercent: 13
        }
      });
    });

    it('should handle different date formats', async () => {
      const startDate = moment('2023-12-25T00:00:00Z');
      const endDate = moment('2023-12-26T00:00:00Z');

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: [],
        total: 0,
        maxResults: 1000
      });

      await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(mockJira.search).toHaveBeenCalledWith({
        jql: 'worklogAuthor = currentUser() AND worklogDate >= 2023-12-24 AND worklogDate < 2023-12-25',
        startAt: 0,
        maxResults: 1000,
        fields: [
          'customfield_10300',
          'subtasks',
          'issuetype',
          'parent'
        ]
      });
    });

    it('should handle stories with subtasks', async () => {
      const mockStories = [
        {
          id: '12345',
          key: 'STORY-123',
          fields: {
            customfield_10300: 'EPIC-1',
            subtasks: [
              {
                id: '12346',
                key: 'SUBTASK-456',
                fields: {
                  customfield_10300: 'EPIC-1',
                  subtasks: [],
                  issuetype: { id: '3' }, // subtask type
                  parent: { key: 'STORY-123' }
                }
              }
            ],
            issuetype: { id: '1' },
            parent: null
          }
        }
      ];

      const mockWorklogs = {
        worklogs: [
          {
            id: 1,
            started: '2023-01-01T10:00:00.000Z',
            timeSpentSeconds: 3600,
            author: { accountId: 'test-account-id' },
            comment: 'Work on story'
          }
        ]
      };

      mockJira.getMyself.mockResolvedValue({ accountId: 'test-account-id' });
      mockJira.search.mockResolvedValue({ 
        issues: mockStories,
        total: 1,
        maxResults: 1000
      });
      mockIssue.getWorklogs.mockResolvedValue(mockWorklogs);

      const result = await epicWorkLogModule(startDate, endDate, workingSeconds);

      expect(result).toEqual({
        'EPIC-1': {
          timeSpentSeconds: 7200, // 3600 from story + 3600 from subtask
          timeSpentPercent: 25
        }
      });
    });
  });
}); 