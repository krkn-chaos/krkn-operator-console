import type { KrknAIScenarioDetail, KrknAIScenarioIndexRow, KrknAIRunSummary } from '../services/krknAiApi';

export interface KrknAiArchiveFile {
  name: string;
  content: string;
}

const utf8 = new TextEncoder();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function textFile(name: string, value: string): KrknAiArchiveFile {
  return { name, content: value };
}

function jsonFile(name: string, value: unknown): KrknAiArchiveFile {
  return textFile(name, `${JSON.stringify(value, null, 2)}\n`);
}

/** Build a standards-compliant UTF-8 ZIP using the uncompressed (store) method. */
export function createKrknAiZipArchive(files: KrknAiArchiveFile[]): Uint8Array {
  const entries = files.map(({ name, content }) => ({ name: utf8.encode(name), content: utf8.encode(content) }));
  if (entries.length > 0xffff) throw new RangeError('Too many files for a standard ZIP archive.');
  for (const entry of entries) {
    if (entry.name.length > 0xffff || entry.content.length > 0xffffffff) {
      throw new RangeError('A ZIP archive entry exceeds the supported size.');
    }
  }

  const checksums = entries.map(({ content }) => crc32(content));
  const localSize = entries.reduce((size, entry) => size + 30 + entry.name.length + entry.content.length, 0);
  const centralSize = entries.reduce((size, entry) => size + 46 + entry.name.length, 0);
  const totalSize = localSize + centralSize + 22;
  if (localSize > 0xffffffff || centralSize > 0xffffffff || totalSize > 0xffffffff) {
    throw new RangeError('The ZIP archive exceeds the supported size.');
  }

  const archive = new Uint8Array(totalSize);
  const view = new DataView(archive.buffer);
  let offset = 0;
  const localOffsets: number[] = [];

  entries.forEach((entry, index) => {
    localOffsets.push(offset);
    write32(view, offset, 0x04034b50);
    write16(view, offset + 4, 20);
    write16(view, offset + 6, 0x0800);
    write16(view, offset + 8, 0);
    write16(view, offset + 10, 0);
    write16(view, offset + 12, 0x0021);
    write32(view, offset + 14, checksums[index]);
    write32(view, offset + 18, entry.content.length);
    write32(view, offset + 22, entry.content.length);
    write16(view, offset + 26, entry.name.length);
    write16(view, offset + 28, 0);
    archive.set(entry.name, offset + 30);
    archive.set(entry.content, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.content.length;
  });

  const centralOffset = offset;
  entries.forEach((entry, index) => {
    write32(view, offset, 0x02014b50);
    write16(view, offset + 4, 20);
    write16(view, offset + 6, 20);
    write16(view, offset + 8, 0x0800);
    write16(view, offset + 10, 0);
    write16(view, offset + 12, 0);
    write16(view, offset + 14, 0x0021);
    write32(view, offset + 16, checksums[index]);
    write32(view, offset + 20, entry.content.length);
    write32(view, offset + 24, entry.content.length);
    write16(view, offset + 28, entry.name.length);
    write16(view, offset + 30, 0);
    write16(view, offset + 32, 0);
    write16(view, offset + 34, 0);
    write16(view, offset + 36, 0);
    write32(view, offset + 38, 0);
    write32(view, offset + 42, localOffsets[index]);
    archive.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  write32(view, offset, 0x06054b50);
  write16(view, offset + 4, 0);
  write16(view, offset + 6, 0);
  write16(view, offset + 8, entries.length);
  write16(view, offset + 10, entries.length);
  write32(view, offset + 12, centralSize);
  write32(view, offset + 16, centralOffset);
  write16(view, offset + 20, 0);
  return archive;
}

function safeFileSegment(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]/g, '_');
  return safe && safe !== '.' && safe !== '..' ? safe : 'scenario';
}

export interface KrknAiArchiveSnapshot {
  configYaml: string;
  summary: KrknAIRunSummary;
  scenarios: KrknAIScenarioIndexRow[];
  details: Record<string, KrknAIScenarioDetail>;
  orchestratorLogs: string[];
  scenarioLogs: Record<string, string[]>;
}

/** Serialize the committed results currently exposed by the mock result API. */
export function buildKrknAiArchiveFiles(snapshot: KrknAiArchiveSnapshot): KrknAiArchiveFile[] {
  const committed = snapshot.scenarios.flatMap((row, index) => {
    const key = `${row.generation}:${row.scenarioId}`;
    const detail = snapshot.details[key];
    return detail
      ? [{ row, index, key, detail }]
      : [];
  });
  const indexRows = committed.map(({ row }) => row);
  const files = [
    textFile('config.yaml', snapshot.configYaml),
    jsonFile('results/summary.json', snapshot.summary),
    jsonFile('results/progress.json', {
      currentGeneration: snapshot.summary.currentGeneration,
      completedGenerations: snapshot.summary.completedGenerations,
      completedScenarios: snapshot.summary.completedScenarios,
      configuredGenerations: snapshot.summary.configuredGenerations,
      fitnessProgression: snapshot.summary.fitnessProgression,
    }),
    jsonFile('results/scenarios/index.json', indexRows),
    textFile('logs/orchestrator.log', snapshot.orchestratorLogs.join('\n') + (snapshot.orchestratorLogs.length ? '\n' : '')),
  ];
  const manifest: Array<{ generation: number; scenarioId: string; resultFile: string; logFile?: string }> = [];

  for (const { row, index, key, detail } of committed) {
    const segment = `${String(index + 1).padStart(3, '0')}-${safeFileSegment(row.scenarioId)}`;
    const directory = `results/scenarios/generation-${row.generation}`;
    const resultFile = `${directory}/${segment}.json`;
    const logLines = snapshot.scenarioLogs[key];
    const logFile = `logs/scenarios/generation-${row.generation}/${segment}.log`;
    files.push(jsonFile(resultFile, detail));
    if (logLines !== undefined) files.push(textFile(logFile, `${logLines.join('\n')}${logLines.length ? '\n' : ''}`));
    manifest.push({ generation: row.generation, scenarioId: row.scenarioId, resultFile, ...(logLines !== undefined ? { logFile } : {}) });
  }
  files.push(jsonFile('results/scenarios/manifest.json', manifest));
  return files;
}
