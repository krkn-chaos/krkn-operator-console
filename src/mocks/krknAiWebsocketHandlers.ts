import { ws } from 'msw';
import { getPreviewAiRun, listPreviewAiChildren } from './krknAiState';

const orchestratorLogsWs = ws.link('*/api/v2/ws/krkn-ai/runs/:runName/logs*');
const childLogsWs = ws.link('*/api/v2/ws/scenarios/run/:scenarioRunName/jobs/:jobId/logs*');

function readTailLines(url: URL): number | undefined {
  const value = url.searchParams.get('tailLines');
  if (value === null) return undefined;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

function initialLines(lines: string[], follow: boolean, tailLines: number | undefined): string[] {
  const count = tailLines ?? (follow ? 200 : lines.length);
  return count === 0 ? [] : lines.slice(-count);
}

interface LogSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'close', listener: () => void): void;
}

function sendError(client: LogSocket, message: string): void {
  client.send(`ERROR: ${message}`);
  setTimeout(() => client.close(1008, message), 0);
}

function registerLogStream(
  client: LogSocket,
  getLines: () => string[] | undefined,
  follow: boolean,
  tailLines: number | undefined,
): void {
  let closed = false;
  let closeTimer: number | NodeJS.Timeout | undefined;
  let interval: number | NodeJS.Timeout | undefined;
  const cleanup = () => {
    closed = true;
    clearTimeout(initialTimer);
    clearInterval(interval);
    clearTimeout(closeTimer);
  };
  client.addEventListener('close', cleanup);

  // Allow open events and viewer handlers to settle before a finite snapshot.
  const initialTimer = setTimeout(() => {
    if (closed) return;
    const snapshot = getLines();
    if (snapshot === undefined) {
      sendError(client, 'The requested Krkn-AI log stream does not exist.');
      return;
    }
    for (const line of initialLines(snapshot, follow, tailLines)) client.send(line);
    if (!follow) {
      closeTimer = setTimeout(() => client.close(1000, 'Log snapshot complete'), 0);
      return;
    }
    let previous = snapshot;
    interval = setInterval(() => {
      if (closed) return;
      const next = getLines();
      if (next === undefined) {
        sendError(client, 'The requested Krkn-AI log stream is no longer available.');
        cleanup();
        return;
      }
      const sharedPrefix = Math.min(previous.length, next.length);
      let commonLength = 0;
      while (commonLength < sharedPrefix && previous[commonLength] === next[commonLength]) commonLength++;
      for (const line of next.slice(commonLength)) client.send(line);
      previous = next;
    }, 750);
  }, 100);
}

const orchestratorLogsHandler = orchestratorLogsWs.addEventListener('connection', ({ client, params }) => {
  const runName = String(params.runName ?? '');
  const url = client.url;
  const follow = url.searchParams.get('follow') === 'true';
  const tailLines = readTailLines(url);
  registerLogStream(
    client,
    () => getPreviewAiRun(runName)?.orchestratorLogs,
    follow,
    tailLines,
  );
});

const childLogsHandler = childLogsWs.addEventListener('connection', ({ client, params }) => {
  const scenarioRunName = String(params.scenarioRunName ?? '');
  if (!scenarioRunName.startsWith('preview-ai-child-')) return;
  const jobId = String(params.jobId ?? '');
  const child = listPreviewAiChildren().find(({ run }) => run.scenarioRunName === scenarioRunName);
  if (!child) {
    sendError(client, `No Krkn-AI scenario run was found for ${scenarioRunName}.`);
    return;
  }

  const run = getPreviewAiRun(child.parentRunName);
  const row = run?.scenarios.find((scenario) => (
    scenario.childRunName === scenarioRunName && scenario.jobId === jobId
  ));
  if (!run || !row) {
    sendError(client, `No Krkn-AI scenario job was found for ${scenarioRunName}/${jobId}.`);
    return;
  }

  const key = `${row.generation}:${row.scenarioId}`;
  const url = client.url;
  registerLogStream(
    client,
    () => {
      const latest = getPreviewAiRun(child.parentRunName);
      if (!latest || !latest.scenarios.some((scenario) => scenario.childRunName === scenarioRunName)) return undefined;
      return latest.scenarioLogs[key] ?? [];
    },
    url.searchParams.get('follow') === 'true',
    readTailLines(url),
  );
});

export const krknAiWebsocketHandlers = [orchestratorLogsHandler, childLogsHandler];
