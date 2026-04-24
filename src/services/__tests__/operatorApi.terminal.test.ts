import { describe, it, expect, vi, beforeEach } from 'vitest';
import { operatorApi } from '../operatorApi';
import type { AvailableCommandsResponse, TerminalResponse } from '../../types/api';

// Mock the fetch function
globalThis.fetch = vi.fn();

describe('operatorApi - Terminal Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableTerminalCommands', () => {
    it('should fetch available commands successfully', async () => {
      const mockResponse: AvailableCommandsResponse = {
        commands: [
          {
            name: 'kubectl',
            description: 'Kubernetes command-line tool',
            subcommands: [
              { name: 'get', description: 'Display resources' },
              { name: 'describe', description: 'Show resource details' },
            ],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await operatorApi.getAvailableTerminalCommands();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/terminal/available-commands'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(operatorApi.getAvailableTerminalCommands()).rejects.toThrow();
    });
  });

  describe('executeTerminalCommand', () => {
    it('should execute command successfully with status 200', async () => {
      const mockResponse: TerminalResponse = {
        stdout_base64: btoa('pod1\npod2\n'),
        stderr_base64: '',
        exit_code: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await operatorApi.executeTerminalCommand({
        cluster_id: 'test-cluster',
        uuid: 'test-uuid',
        command: 'kubectl get pods',
      });

      expect(result.stdout).toBe('pod1\npod2\n');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command failure with status 400', async () => {
      const mockResponse: TerminalResponse = {
        stdout_base64: '',
        stderr_base64: btoa('Error: pod not found'),
        exit_code: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      } as Response);

      const result = await operatorApi.executeTerminalCommand({
        cluster_id: 'test-cluster',
        uuid: 'test-uuid',
        command: 'kubectl get pod nonexistent',
      });

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Error: pod not found');
      expect(result.exitCode).toBe(1);
    });

    it('should throw TERMINAL_ERROR:404 for command not found', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(
        operatorApi.executeTerminalCommand({
          cluster_id: 'test-cluster',
          uuid: 'test-uuid',
          command: 'invalidcommand',
        })
      ).rejects.toThrow('TERMINAL_ERROR:404:invalidcommand');
    });

    it('should throw TERMINAL_ERROR:403 for permission denied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      await expect(
        operatorApi.executeTerminalCommand({
          cluster_id: 'test-cluster',
          uuid: 'test-uuid',
          command: 'kubectl delete pod',
        })
      ).rejects.toThrow('TERMINAL_ERROR:403:kubectl delete pod');
    });

    it('should throw TERMINAL_ERROR:500 for server error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        operatorApi.executeTerminalCommand({
          cluster_id: 'test-cluster',
          uuid: 'test-uuid',
          command: 'kubectl get pods',
        })
      ).rejects.toThrow('TERMINAL_ERROR:500:test-cluster:kubectl get pods');
    });

    it('should decode base64 stdout and stderr correctly', async () => {
      const stdoutText = 'Hello World\nLine 2';
      const stderrText = 'Warning: deprecated';

      const mockResponse: TerminalResponse = {
        stdout_base64: btoa(stdoutText),
        stderr_base64: btoa(stderrText),
        exit_code: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await operatorApi.executeTerminalCommand({
        cluster_id: 'test-cluster',
        uuid: 'test-uuid',
        command: 'kubectl version',
      });

      expect(result.stdout).toBe(stdoutText);
      expect(result.stderr).toBe(stderrText);
    });
  });
});
