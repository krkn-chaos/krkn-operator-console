import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { ws } from 'msw';
import { LogViewer } from '../LogViewer';

vi.mock('../../services/authService', () => ({
  authService: { getToken: () => 'mock-token' },
}));

// Like the operator, every log connection streams the pod log from its first
// line, as soon as it opens. A one-shot read (no follow) and a reconnect after
// a dropped connection see a longer log that ends in 'line-final'.
const podLog = ['line-A', 'line-B', 'line-C'];
const logStream = ws.link('*/api/v2/ws/scenarios/run/:scenarioRunName/jobs/:jobId/logs');
const connectionUrls: string[] = [];
let latestClient: { close: (code?: number, reason?: string) => void } | undefined;
let dropped = false;
let podGone = false;
// A pod that has not written any log line yet.
let quiet = false;

const server = setupServer(
  logStream.addEventListener('connection', ({ client }) => {
    const url = client.url.toString();
    connectionUrls.push(url);
    latestClient = client;
    if (podGone) {
      client.send('ERROR: Pod no longer exists');
      return;
    }
    if (quiet) {
      return;
    }
    podLog.forEach((line) => client.send(line));
    if (!url.includes('follow=true') || dropped) {
      client.send('line-final');
    }
  }),
);

const props = {
  scenarioRunName: 'test-run',
  clusterName: 'test-cluster',
  podName: 'test-pod',
};

// The app renders in StrictMode, which runs effects and state updaters twice
// in development.
const renderStrict = (ui: React.ReactElement) => render(ui, { wrapper: StrictMode });

function expectEachLineOnce(lines: string[]) {
  for (const line of lines) {
    expect(screen.getAllByText(line)).toHaveLength(1);
  }
}

// Let the stream deliver its messages inside act, so React applies them the
// way it does in the browser and the test does not warn.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('LogViewer log stream', () => {
  afterEach(() => {
    vi.useRealTimers();
    connectionUrls.length = 0;
    latestClient = undefined;
    dropped = false;
    podGone = false;
    quiet = false;
    server.resetHandlers();
  });

  it('replaces the connecting message with the first log line', async () => {
    renderStrict(<LogViewer {...props} jobId="job-running" status="Running" />);
    await settle();

    expect(screen.queryByText('Connecting to log stream...')).not.toBeInTheDocument();
    expectEachLineOnce(podLog);
  });

  it('shows the full log once when the job finishes and the stream reconnects', async () => {
    const { rerender } = renderStrict(<LogViewer {...props} jobId="job-finish" status="Running" />);
    await settle();
    expect(connectionUrls.every((url) => url.includes('follow=true'))).toBe(true);

    rerender(<LogViewer {...props} jobId="job-finish" status="Succeeded" />);
    await settle();

    expect(connectionUrls[connectionUrls.length - 1]).not.toContain('follow=true');
    expectEachLineOnce([...podLog, 'line-final']);
  });

  it('shows the full log once after a dropped connection reconnects', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderStrict(<LogViewer {...props} jobId="job-drop" status="Running" />);
    await settle();

    dropped = true;
    await act(async () => {
      latestClient?.close(4000, 'Connection lost');
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('Reconnecting to log stream...')).toBeInTheDocument();
    // The service waits 2 s before reconnecting.
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();

    expect(screen.queryByText('Reconnecting to log stream...')).not.toBeInTheDocument();
    expectEachLineOnce([...podLog, 'line-final']);
  });

  it('shows the full log once when the stream reconnects before React renders', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderStrict(<LogViewer {...props} jobId="job-fast-drop" status="Running" />);
    await settle();

    // One act: React renders only after the connection has closed and
    // reopened, so it never renders the 'reconnecting' state.
    dropped = true;
    await act(async () => {
      latestClient?.close(4000, 'Connection lost');
      await vi.advanceTimersByTimeAsync(2000);
    });
    await settle();

    expectEachLineOnce([...podLog, 'line-final']);
  });

  it('says it is connected while a pod has no log lines yet', async () => {
    quiet = true;
    renderStrict(<LogViewer {...props} jobId="job-quiet" status="Running" />);
    await settle();

    expect(screen.queryByText('Connecting to log stream...')).not.toBeInTheDocument();
    expect(screen.getByText('Connected. Waiting for log output...')).toBeInTheDocument();
  });

  it('stops saying it is reconnecting when a quiet stream reconnects', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    quiet = true;
    renderStrict(<LogViewer {...props} jobId="job-quiet-drop" status="Running" />);
    await settle();

    await act(async () => {
      latestClient?.close(4000, 'Connection lost');
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('Reconnecting to log stream...')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await settle();

    expect(screen.queryByText('Reconnecting to log stream...')).not.toBeInTheDocument();
    expect(screen.getByText('Connected. Waiting for log output...')).toBeInTheDocument();
  });

  it('keeps the log and shows the error when the finished job has no pod left', async () => {
    const { rerender } = renderStrict(<LogViewer {...props} jobId="job-gone" status="Running" />);
    await settle();

    podGone = true;
    rerender(<LogViewer {...props} jobId="job-gone" status="Succeeded" />);
    await settle();

    expect(screen.getByText(/ERROR: Pod no longer exists/)).toBeInTheDocument();
    expectEachLineOnce(podLog);
  });
});

describe('LogViewer log stream with browser scheduling', () => {
  // Outside act, React renders on its own schedule, as in the browser. The
  // stream sends the log as soon as the connection opens, before React has
  // rendered the new connection state.
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let actEnvironment: boolean | undefined;
  beforeAll(() => {
    actEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
    globals.IS_REACT_ACT_ENVIRONMENT = false;
  });
  afterAll(() => {
    globals.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  });

  // Poll with plain timers: Testing Library's waitFor changes how React
  // flushes updates, which hides the ordering this test is about.
  async function waitForText(container: HTMLElement, text: string) {
    for (let elapsed = 0; elapsed < 1000; elapsed += 20) {
      if (within(container).queryByText(text)) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`"${text}" not shown; log panel: ${JSON.stringify(container.querySelector('.log-terminal')?.textContent)}`);
  }

  it('keeps log lines that arrive before React renders the finished job connection', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      root.render(<LogViewer {...props} jobId="job-browser" status="Running" />);
      await waitForText(container, 'line-C');

      root.render(<LogViewer {...props} jobId="job-browser" status="Succeeded" />);
      await waitForText(container, 'line-final');

      for (const line of podLog) {
        expect(within(container).getAllByText(line)).toHaveLength(1);
      }
    } finally {
      root.unmount();
      container.remove();
    }
  });
});
