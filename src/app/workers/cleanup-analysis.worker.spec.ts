import { analyzeCleanup, chooseDuplicateKeeper, normalizeProbableDuplicateUrl } from '../services/cleanup-analysis';
import { CleanupAnalysisInput, CleanupNodeSnapshot } from '../services/cleanup.types';

describe('cleanup analysis worker', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 0, 1);

  it('normalizes only HTTP(S) probable duplicate URLs at the required boundaries', () => {
    expect(normalizeProbableDuplicateUrl(
      'HTTPS://Example.COM:443/Path/?b=2&utm_source=news&a=hello+world&FBCLID=x#section'
    )).toBe('https://example.com/Path/?a=hello%20world&b=2');
    expect(normalizeProbableDuplicateUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeProbableDuplicateUrl('http://example.com/')).toBe('http://example.com/');
    expect(normalizeProbableDuplicateUrl('https://example.com/Path')).toBe('https://example.com/Path');
    expect(normalizeProbableDuplicateUrl('http://example.com/Path')).toBe('http://example.com/Path');
    expect(normalizeProbableDuplicateUrl('chrome://bookmarks')).toBeNull();
    expect(normalizeProbableDuplicateUrl('not a url')).toBeNull();
  });

  it('finds exact and probable duplicates without treating identical originals as probable', () => {
    const input = createInput([
      bookmark('a', 'https://example.com/page?utm_source=one&x=1'),
      bookmark('b', 'https://EXAMPLE.com/page?x=1#fragment'),
      bookmark('c', 'https://same.example/value'),
      bookmark('d', 'https://same.example/value')
    ]);

    const result = analyzeCleanup(input, 7);

    expect(result.requestId).toBe(7);
    expect(result.exactDuplicateGroups).toEqual([
      expect.objectContaining({ bookmarkIds: ['c', 'd'], keeperId: 'c' })
    ]);
    expect(result.probableDuplicateGroups).toEqual([
      expect.objectContaining({ bookmarkIds: ['a', 'b'] })
    ]);
    expect(result.counts['exact-duplicate']).toBe(2);
    expect(result.counts['probable-duplicate']).toBe(2);
  });

  it('selects a keeper by use, usefulness, tags, age, then stable id', () => {
    const nodes = [
      bookmark('recent', 'https://duplicate', { dateLastUsed: now - day }),
      bookmark('useful', 'https://duplicate', { dateLastUsed: now - 2 * day }),
      bookmark('tagged', 'https://duplicate', { dateLastUsed: now - 2 * day }),
      bookmark('older', 'https://duplicate', { dateLastUsed: now - 2 * day, dateAdded: now - 20 * day }),
      bookmark('a-stable', 'https://duplicate', { dateLastUsed: now - 2 * day, dateAdded: now - 20 * day })
    ];
    const input = createInput(nodes, {
      useful: ['one'],
      tagged: ['one', 'two'],
      older: ['one', 'two'],
      'a-stable': ['one', 'two']
    }, {
      recent: { score: 1, source: 'ai' },
      useful: { score: 5, source: 'manual' },
      tagged: { score: 5, source: 'manual' },
      older: { score: 5, source: 'manual' },
      'a-stable': { score: 5, source: 'manual' }
    });

    expect(chooseDuplicateKeeper(nodes.map(node => node.id), input)).toBe('recent');
    expect(chooseDuplicateKeeper(nodes.slice(1).map(node => node.id), input)).toBe('a-stable');
  });

  it('separates stale, unknown usage, and undated bookmarks and preserves overlaps', () => {
    const input = createInput([
      bookmark('stale', 'https://stale', { dateLastUsed: now - 731 * day }),
      bookmark('used-recently', 'https://recent', { dateLastUsed: now - day, dateAdded: now - 900 * day }),
      bookmark('unknown-old', 'https://unknown', { dateAdded: now - 731 * day }),
      bookmark('unknown-new', 'https://new', { dateAdded: now - day }),
      bookmark('undated', 'https://undated')
    ], {
      stale: [],
      'used-recently': ['tag'],
      'unknown-old': ['tag'],
      'unknown-new': ['tag'],
      undated: ['tag']
    }, {
      'used-recently': { score: 3, source: 'ai' },
      'unknown-old': { score: 3, source: 'ai' },
      'unknown-new': { score: 3, source: 'ai' },
      undated: { score: 1, source: 'manual' }
    });

    const result = analyzeCleanup(input);
    const byId = Object.fromEntries(result.findings.map(finding => [finding.nodeId, finding]));

    expect(byId['stale'].matchedReasons).toEqual(['stale', 'untagged', 'unrated']);
    expect(byId['used-recently']).toBeUndefined();
    expect(byId['unknown-old'].matchedReasons).toContain('unknown-usage');
    expect(byId['unknown-new']).toBeUndefined();
    expect(byId['undated']).toEqual(expect.objectContaining({
      matchedReasons: ['unknown-usage', 'low-usefulness'],
      undated: true
    }));
  });

  it('excludes roots, managed descendants, and Cleanup trash while listing quarantined top-level items', () => {
    const nodes: CleanupNodeSnapshot[] = [
      folder('0', undefined, 2, 'root'),
      folder('1', '0', 2, 'Bookmarks Bar'),
      folder('2', '0', 1, 'Other Bookmarks'),
      folder('managed', '1', 1, 'Managed', 'managed'),
      bookmark('managed-child', 'https://managed', { parentId: 'managed' }),
      folder('empty', '1', 0, 'Empty'),
      folder('trash', '2', 1, 'Trash'),
      folder('cleanup', 'trash', 1, 'Cleanup'),
      folder('stale-reason', 'cleanup', 1, 'Stale'),
      bookmark('quarantined', 'https://quarantined', { parentId: 'stale-reason' })
    ];

    const result = analyzeCleanup(createInput(nodes));

    expect(result.findings).toEqual([
      expect.objectContaining({ nodeId: 'empty', matchedReasons: ['empty-folder'], actionable: true }),
      expect.objectContaining({ nodeId: 'quarantined', matchedReasons: ['quarantined'], actionable: false })
    ]);
    expect(result.findings.some(finding => finding.nodeId === 'managed-child')).toBe(false);
  });

  function createInput(
    extraNodes: CleanupNodeSnapshot[],
    tags: Record<string, string[]> = {},
    usefulness: CleanupAnalysisInput['usefulness'] = {}
  ): CleanupAnalysisInput {
    const hasRoot = extraNodes.some(node => node.id === '0');
    return {
      nodes: hasRoot ? extraNodes : [
        folder('0', undefined, 1, 'root'),
        folder('1', '0', extraNodes.length, 'Bookmarks Bar'),
        ...extraNodes.map(node => ({ ...node, parentId: node.parentId ?? '1' }))
      ],
      tags,
      usefulness,
      settings: { staleDays: 730 },
      now
    };
  }

  function bookmark(
    id: string,
    url: string,
    overrides: Partial<CleanupNodeSnapshot> = {}
  ): CleanupNodeSnapshot {
    return {
      id,
      title: id,
      url,
      parentId: '1',
      isFolder: false,
      childCount: 0,
      ...overrides
    };
  }

  function folder(
    id: string,
    parentId: string | undefined,
    childCount: number,
    title: string,
    unmodifiable?: string
  ): CleanupNodeSnapshot {
    return {
      id,
      title,
      ...(parentId === undefined ? {} : { parentId }),
      isFolder: true,
      childCount,
      ...(unmodifiable === undefined ? {} : { unmodifiable })
    };
  }
});
