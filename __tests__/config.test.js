import { jest } from '@jest/globals';

describe('config module', () => {
  let mockReadAllUpSync;
  let mockIniParse;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create shared mock instances
    mockReadAllUpSync = jest.fn();
    mockIniParse = jest.fn();

    await jest.unstable_mockModule('read-all-up', () => ({
      default: {
        sync: mockReadAllUpSync
      }
    }));

    await jest.unstable_mockModule('ini', () => ({
      default: {
        parse: mockIniParse
      }
    }));
  });

  describe('config loading', () => {
    it('should load config from .toggl-to-jirarc file', async () => {
      const mockConfigContent = `
[toggl]
apiToken = test-toggl-token

[jira]
credentials.username = testuser
credentials.password = testpass
      `;

      const mockParsedConfig = {
        toggl: {
          apiToken: 'test-toggl-token'
        },
        jira: {
          credentials: {
            username: 'testuser',
            password: 'testpass'
          }
        }
      };

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);
      mockIniParse.mockReturnValue(mockParsedConfig);

      const configModule = (await import('../lib/config.js')).default;

      expect(mockReadAllUpSync).toHaveBeenCalledWith('.toggl-to-jirarc', {
        encoding: 'utf8'
      });
      expect(mockIniParse).toHaveBeenCalledWith(mockConfigContent);
      expect(configModule).toEqual(mockParsedConfig);
    });

    it('should handle missing config file', async () => {
      const error = new Error('No .toggl-to-jirarc file found');
      mockReadAllUpSync.mockImplementation(() => {
        throw error;
      });

      // Mock console.log to avoid output during tests
      const originalLog = console.log;
      console.log = jest.fn();

      const configModule = (await import('../lib/config.js')).default;

      expect(console.log).toHaveBeenCalledWith(error);
      expect(configModule).toBeUndefined();

      // Restore console.log
      console.log = originalLog;
    });

    it('should handle malformed config file', async () => {
      const mockConfigContent = 'invalid ini content [section';

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);

      const parseError = new Error('Invalid INI format');
      mockIniParse.mockImplementation(() => {
        throw parseError;
      });

      // Mock console.log to avoid output during tests
      const originalLog = console.log;
      console.log = jest.fn();

      const configModule = (await import('../lib/config.js')).default;

      expect(console.log).toHaveBeenCalledWith(parseError);
      expect(configModule).toBeUndefined();

      // Restore console.log
      console.log = originalLog;
    });

    it('should handle empty config file', async () => {
      const mockConfigContent = '';
      const mockParsedConfig = {};

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);
      mockIniParse.mockReturnValue(mockParsedConfig);

      const configModule = (await import('../lib/config.js')).default;

      expect(configModule).toEqual(mockParsedConfig);
    });

    it('should handle config with only toggl section', async () => {
      const mockConfigContent = `
[toggl]
apiToken = test-toggl-token
      `;

      const mockParsedConfig = {
        toggl: {
          apiToken: 'test-toggl-token'
        }
      };

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);
      mockIniParse.mockReturnValue(mockParsedConfig);

      const configModule = (await import('../lib/config.js')).default;

      expect(configModule).toEqual(mockParsedConfig);
    });

    it('should handle config with only jira section', async () => {
      const mockConfigContent = `
[jira]
credentials.username = testuser
credentials.password = testpass
      `;

      const mockParsedConfig = {
        jira: {
          credentials: {
            username: 'testuser',
            password: 'testpass'
          }
        }
      };

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);
      mockIniParse.mockReturnValue(mockParsedConfig);

      const configModule = (await import('../lib/config.js')).default;

      expect(configModule).toEqual(mockParsedConfig);
    });

    it('should handle nested configuration sections', async () => {
      const mockConfigContent = `
[toggl]
apiToken = test-toggl-token

[jira.credentials]
username = testuser
password = testpass

[jira.settings]
timeout = 30
      `;

      const mockParsedConfig = {
        toggl: {
          apiToken: 'test-toggl-token'
        },
        jira: {
          credentials: {
            username: 'testuser',
            password: 'testpass'
          },
          settings: {
            timeout: '30'
          }
        }
      };

      mockReadAllUpSync.mockReturnValue([{
        fileContents: mockConfigContent
      }]);
      mockIniParse.mockReturnValue(mockParsedConfig);

      const configModule = (await import('../lib/config.js')).default;

      expect(configModule).toEqual(mockParsedConfig);
    });

    it('should handle read-all-up errors', async () => {
      const error = new Error('File system error');
      mockReadAllUpSync.mockImplementation(() => {
        throw error;
      });

      // Mock console.log to avoid output during tests
      const originalLog = console.log;
      console.log = jest.fn();

      const configModule = (await import('../lib/config.js')).default;

      expect(console.log).toHaveBeenCalledWith(error);
      expect(configModule).toBeUndefined();

      // Restore console.log
      console.log = originalLog;
    });
  });
}); 