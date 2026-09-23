import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { LogViewer } from './LogViewer';
import { websocketService } from '../services/websocketService';

vi.mock('../hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));

vi.mock('../services/authService', () => ({
  authService: {
    getToken: vi.fn(() => 'mock-token'),
  },
}));

// Use Pending status so the component sets a known log line without needing WebSocket
const defaultProps = {
  scenarioRunName: 'test-run',
  jobId: `job-${Date.now()}`,
  clusterName: 'test-cluster',
  podName: 'test-pod-abc',
  status: 'Pending',
};

beforeEach(() => {
  vi.restoreAllMocks();
  defaultProps.jobId = `job-${Date.now()}-${Math.random()}`;
});

async function clickDropdownItem(user: ReturnType<typeof userEvent.setup>, option: string) {
  const menuToggle = screen.getAllByRole('button').find(btn => btn.classList.contains('pf-v5-c-menu-toggle'));
  expect(menuToggle).toBeDefined();
  await user.click(menuToggle!);
  await user.click(screen.getByText(option));
}

describe('LogViewer download', () => {
  it('does not follow logs after retries are exhausted', () => {
    const buildUrl = vi.spyOn(websocketService, 'buildJobLogsUrl');
    render(<LogViewer {...defaultProps} status="MaxRetriesExceeded" />);

    expect(buildUrl).toHaveBeenCalledWith(defaultProps.scenarioRunName, defaultProps.jobId, false);
  });

  describe('dropdown UI', () => {
    it('renders the download menu toggle', () => {
      render(<LogViewer {...defaultProps} />);
      const menuToggle = screen.getAllByRole('button').find(btn => btn.classList.contains('pf-v5-c-menu-toggle'));
      expect(menuToggle).toBeDefined();
    });

    it('shows Text, HTML, JSON options when opened', async () => {
      const user = userEvent.setup();
      render(<LogViewer {...defaultProps} />);

      const menuToggle = screen.getAllByRole('button').find(btn => btn.classList.contains('pf-v5-c-menu-toggle'));
      await user.click(menuToggle!);

      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('HTML')).toBeInTheDocument();
      expect(screen.getByText('JSON')).toBeInTheDocument();
    });

    it('closes dropdown after selecting an option', async () => {
      const user = userEvent.setup();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      render(<LogViewer {...defaultProps} />);
      await clickDropdownItem(user, 'HTML');

      expect(screen.queryByText('JSON')).not.toBeInTheDocument();
    });
  });

  describe('HTML download', () => {
    it('creates a blob with valid HTML containing podName title and monospace styling', async () => {
      const user = userEvent.setup();
      let capturedBlob: Blob | null = null;

      vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
        capturedBlob = obj as Blob;
        return 'blob:mock-url';
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      render(<LogViewer {...defaultProps} />);
      await clickDropdownItem(user, 'HTML');

      expect(capturedBlob).not.toBeNull();
      const html = await capturedBlob!.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Logs - test-pod-abc</title>');
      expect(html).toContain('font-family: monospace');
      expect(html).toContain('background-color: #000000');
      expect(html).not.toContain('background-color: #ffffff !important');
    });

    it('revokes the blob URL after triggering download', async () => {
      const user = userEvent.setup();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:html-url');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      render(<LogViewer {...defaultProps} />);
      await clickDropdownItem(user, 'HTML');

      expect(revokeSpy).toHaveBeenCalledWith('blob:html-url');
    });
  });

  describe('Text download', () => {
    it('creates a plain text blob with ANSI codes stripped', async () => {
      const user = userEvent.setup();
      let capturedBlob: Blob | null = null;

      vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
        capturedBlob = obj as Blob;
        return 'blob:mock-url';
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      render(<LogViewer {...defaultProps} />);
      await clickDropdownItem(user, 'Text');

      expect(capturedBlob).not.toBeNull();
      const text = await capturedBlob!.text();
      expect(capturedBlob!.type).toBe('text/plain');
      expect(text).not.toContain('<');
      expect(text).not.toContain('');
    });
  });

  describe('JSON download', () => {
    it('produces JSON with podName, logs array, totalLines, and exportedAt', async () => {
      const user = userEvent.setup();
      let capturedBlob: Blob | null = null;

      vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
        capturedBlob = obj as Blob;
        return 'blob:mock-url';
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      render(<LogViewer {...defaultProps} />);
      await clickDropdownItem(user, 'JSON');

      expect(capturedBlob).not.toBeNull();
      const parsed = JSON.parse(await capturedBlob!.text());

      expect(parsed.podName).toBe('test-pod-abc');
      expect(Array.isArray(parsed.logs)).toBe(true);
      expect(parsed.totalLines).toBe(parsed.logs.length);
      expect(parsed.exportedAt).toBeDefined();
      expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
    });
  });
});
