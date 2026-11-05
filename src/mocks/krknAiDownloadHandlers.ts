import { http, HttpResponse } from 'msw';
import { config } from '../config';
import { getPreviewAiRun } from './krknAiState';
import { buildKrknAiArchiveFiles, createKrknAiZipArchive } from './krknAiArchive';

const BASE = config.apiBaseUrl;

export const krknAiDownloadHandlers = [
  http.get(`${BASE}/krkn-ai/runs/:name/results/download`, ({ params }) => {
    const name = String(params.name ?? '');
    const run = getPreviewAiRun(name);
    if (!run) {
      return HttpResponse.json({ message: `Krkn-AI run "${name}" was not found.` }, { status: 404 });
    }
    if (run.summary.artifactStatus === 'not_available') {
      return HttpResponse.json(
        { message: `Results are not available for Krkn-AI run "${name}".` },
        { status: 409 },
      );
    }

    const archiveFiles = buildKrknAiArchiveFiles(run);
    const archive = createKrknAiZipArchive(archiveFiles);
    const safeName = name.replace(/[^A-Za-z0-9._-]/g, '_') || 'krkn-ai-run';
    const body = archive.buffer as ArrayBuffer;
    return new HttpResponse(body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}-results.zip"`,
      },
    });
  }),
];
