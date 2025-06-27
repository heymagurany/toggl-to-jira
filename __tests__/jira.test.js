import { jest } from '@jest/globals';
import moment from 'moment';

describe('jira module', () => {
  let jiraModule;
  let mockFetch;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create a shared mock fetch instance
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    await jest.unstable_mockModule('../lib/config.js', () => ({
      default: {
        jira: {
          credentials: {
            username: 'testuser',
            password: 'testpass'
          }
        }
      }
    }));

    await jest.unstable_mockModule('../lib/credentials.js', () => ({
      default: jest.fn().mockResolvedValue({
        username: 'testuser',
        password: 'testpass'
      })
    }));

    jiraModule = (await import('../lib/jira.js')).default;
  });

  describe('makeRequest', () => {
    it('should make a successful GET request', async () => {
      const mockResponse = { id: 1, name: 'Test User' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await jiraModule.getMyself();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/myself',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Basic /)
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should make a successful POST request with body', async () => {
      const mockResponse = { issues: [] };
      const searchBody = { jql: 'project = TEST' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await jiraModule.search(searchBody);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(searchBody),
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Basic /)
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(jiraModule.getMyself()).rejects.toThrow('HTTP error! status: 401');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(jiraModule.getMyself()).rejects.toThrow('Network error');
    });
  });

  describe('issue methods', () => {
    let issueMethods;

    beforeEach(() => {
      issueMethods = jiraModule.issue('TEST-123');
    });

    it('should add worklog correctly', async () => {
      const mockResponse = { id: 1 };
      const worklog = {
        comment: 'Test work',
        started: moment('2023-01-01T10:00:00Z'),
        timeSpentSeconds: 3600
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await issueMethods.addWorklog(worklog);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/issue/TEST-123/worklog',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"started":"2023-01-01T10:00:00.000Z"'),
          body: expect.stringContaining('"timeSpentSeconds":3600')
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delete worklog correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      });

      await issueMethods.deleteWorklog(123);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/issue/TEST-123/worklog/123',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should get worklogs correctly', async () => {
      const mockResponse = { worklogs: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await issueMethods.getWorklogs();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/issue/TEST-123/worklog',
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should update worklog correctly', async () => {
      const mockResponse = { id: 1 };
      const worklog = {
        comment: 'Updated work',
        started: moment('2023-01-01T11:00:00Z'),
        timeSpentSeconds: 1800
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await issueMethods.updateWorklog(123, worklog);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inindca.atlassian.net/rest/api/2/issue/TEST-123/worklog/123',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"started":"2023-01-01T11:00:00.000Z"'),
          body: expect.stringContaining('"timeSpentSeconds":1800')
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUsername', () => {
    it('should return username from session', async () => {
      const mockResponse = { name: 'testuser' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await jiraModule.getUsername();

      expect(result).toBe('testuser');
    });
  });
}); 