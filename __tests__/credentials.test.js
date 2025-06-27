import { jest } from '@jest/globals';

describe('credentials module', () => {
  let credentialsModule;
  let mockReadline;
  let mockWritable;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Create shared mock instances
    mockReadline = {
      createInterface: jest.fn()
    };

    mockWritable = jest.fn();

    await jest.unstable_mockModule('readline', () => ({
      default: mockReadline
    }));

    await jest.unstable_mockModule('stream', () => ({
      Writable: mockWritable
    }));

    credentialsModule = (await import('../lib/credentials.js')).default;
  });

  describe('credentials loading', () => {
    it('should prompt for username and password on first call', async () => {
      const mockInterface = {
        question: jest.fn(),
        write: jest.fn(),
        close: jest.fn()
      };

      mockReadline.createInterface.mockReturnValue(mockInterface);

      // Mock the question responses
      mockInterface.question
        .mockImplementationOnce((prompt, callback) => {
          expect(prompt).toBe('username: ');
          callback('testuser');
        })
        .mockImplementationOnce((prompt, callback) => {
          expect(prompt).toBe('password: ');
          callback('testpass');
        });

      const result = await credentialsModule();

      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: expect.any(Object),
        terminal: true
      });
      expect(result).toEqual({
        username: 'testuser',
        password: 'testpass'
      });
      expect(mockInterface.close).toHaveBeenCalled();
    });

    it('should return cached credentials on subsequent calls', async () => {
      const mockInterface = {
        question: jest.fn(),
        write: jest.fn(),
        close: jest.fn()
      };

      mockReadline.createInterface.mockReturnValue(mockInterface);

      // Mock the question responses for first call
      mockInterface.question
        .mockImplementationOnce((prompt, callback) => {
          callback('testuser');
        })
        .mockImplementationOnce((prompt, callback) => {
          callback('testpass');
        });

      // First call - should prompt
      const result1 = await credentialsModule();
      expect(result1).toEqual({
        username: 'testuser',
        password: 'testpass'
      });

      // Second call - should return cached credentials without prompting
      const result2 = await credentialsModule();
      expect(result2).toEqual({
        username: 'testuser',
        password: 'testpass'
      });

      // Should only have prompted once
      expect(mockInterface.question).toHaveBeenCalledTimes(2);
    });

    it('should handle interface errors gracefully', async () => {
      const mockInterface = {
        question: jest.fn(),
        write: jest.fn(),
        close: jest.fn()
      };

      mockReadline.createInterface.mockReturnValue(mockInterface);

      // Mock an error during the question
      mockInterface.question.mockImplementationOnce((prompt, callback) => {
        throw new Error('Interface error');
      });

      await expect(credentialsModule()).rejects.toThrow('Interface error');
      expect(mockInterface.close).toHaveBeenCalled();
    });
  });
}); 