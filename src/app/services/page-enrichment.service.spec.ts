import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageEnrichmentService } from './page-enrichment.service';

describe('PageEnrichmentService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches without credentials and caps extracted readable text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      `<html><head><title>Title</title></head><body><h1>Heading</h1><script>secret()</script>${'x'.repeat(7000)}</body></html>`,
      { headers: { 'content-type': 'text/html' } }
    ));
    const text = await new PageEnrichmentService().extract('https://example.com');
    expect(text?.length).toBeLessThanOrEqual(6000);
    expect(text).not.toContain('secret()');
    expect(fetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ credentials: 'omit' }));
  });

  it('skips unsupported and oversized pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('pdf', {
      headers: { 'content-type': 'application/pdf' }
    }));
    await expect(new PageEnrichmentService().extract('https://example.com/file')).resolves.toBeNull();
  });
});
