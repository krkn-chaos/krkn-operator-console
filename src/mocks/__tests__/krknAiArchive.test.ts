import { describe, expect, it } from 'vitest';
import { buildKrknAiArchiveFiles, createKrknAiZipArchive } from '../krknAiArchive';
import { getPreviewAiRun, resetPreviewAiState } from '../krknAiState';

const decoder = new TextDecoder();

describe('Krkn-AI preview ZIP archive', () => {
  it('keeps UTF-8 names and contents intact across local and central records', () => {
    const files = [{ name: 'results/測定.json', content: '123456789', expectedCRC: 0xcbf43926 }, { name: 'logs/run.log', content: '', expectedCRC: 0 }];
    const archive = createKrknAiZipArchive(files);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const end = archive.byteLength - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    let centralOffset = view.getUint32(end + 16, true);
    for (const file of files) {
      expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
      const localOffset = view.getUint32(centralOffset + 42, true);
      const nameLength = view.getUint16(centralOffset + 28, true);
      const centralName = decoder.decode(archive.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
      expect(centralName).toBe(file.name);
      expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
      expect(view.getUint16(localOffset + 6, true) & 0x0800).toBe(0x0800);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const dataLength = view.getUint32(localOffset + 18, true);
      const dataOffset = localOffset + 30 + localNameLength;
      expect(decoder.decode(archive.subarray(dataOffset, dataOffset + dataLength))).toBe(file.content);
      expect(view.getUint32(localOffset + 14, true)).toBe(file.expectedCRC);
      expect(view.getUint32(centralOffset + 16, true)).toBe(file.expectedCRC);
      centralOffset += 46 + nameLength;
    }
    expect(centralOffset).toBe(end);
  });

  it('archives cancelled raw measurements, null normalized scores, complete index rows, and retained logs', () => {
    resetPreviewAiState();
    const snapshot = getPreviewAiRun('preview-ai-cancelled')!;
    const files = buildKrknAiArchiveFiles(snapshot);
    const file = (name: string) => files.find((entry) => entry.name === name)?.content;
    const progress = JSON.parse(file('results/progress.json')!);
    const index = JSON.parse(file('results/scenarios/index.json')!);
    const manifest = JSON.parse(file('results/scenarios/manifest.json')!);
    const interruptedDetail = files
      .filter((entry) => entry.name.startsWith('results/scenarios/generation-1/'))
      .map((entry) => JSON.parse(entry.content) as { scenarioId: string; fitnessState: string; fitnessResult: { fitnessScore: number | null; scores: Array<{ rawScore: number | null; normalizedScore: number | null }> } })
      .find((detail) => detail.scenarioId === '3')!;
    expect(progress).toMatchObject({ cancelledGeneration: 1, status: 'cancelled', completedGenerations: 1, resultsCompleteness: 'partial' });
    expect(index).toHaveLength(snapshot.scenarios.length);
    expect(index).toContainEqual(expect.objectContaining({ generation: 1, scenarioId: '2', fitnessState: 'cancelled' }));
    expect(manifest).toContainEqual(expect.objectContaining({ generation: 1, scenarioId: '2', logFile: expect.any(String) }));
    expect(manifest.find((entry: { scenarioId: string }) => entry.scenarioId === '2')).not.toHaveProperty('resultFile');
    expect(interruptedDetail.fitnessState).toBe('cancelled');
    expect(interruptedDetail.fitnessResult.fitnessScore).toBeNull();
    expect(interruptedDetail.fitnessResult.scores.some((score) => score.rawScore !== null)).toBe(true);
    expect(interruptedDetail.fitnessResult.scores.every((score) => score.normalizedScore === null)).toBe(true);
    expect(files.some((entry) => entry.name.includes('/generation-1/') && entry.name.endsWith('.log') && entry.content.includes('stopped by user request'))).toBe(true);
  });
});
