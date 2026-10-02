import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadJson } from './downloadJson';

describe('downloadJson', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createdUrl: string;

  beforeEach(() => {
    createdUrl = 'blob:mock-url';
    clickSpy = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => createdUrl),
      revokeObjectURL: vi.fn(),
    });

    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates an object URL, clicks the anchor, and revokes the URL', () => {
    downloadJson({ a: 1 }, 'test.json');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdUrl);
  });

  it('serializes the data as pretty-printed JSON in the Blob', () => {
    const blobArg = { hello: 'world' };
    downloadJson(blobArg, 'x.json');

    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    return blob.text().then(text => {
      expect(text).toBe(JSON.stringify(blobArg, null, 2));
    });
  });
});
