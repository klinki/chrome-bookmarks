import { performance } from 'node:perf_hooks';
import { OrderByPipe } from '../src/app/pipes/order-by.pipe';
import { createBookmarkFixture } from './bookmark-fixtures';
import { analyzeCleanup } from '../src/app/services/cleanup-analysis';
import { CleanupNodeSnapshot } from '../src/app/services/cleanup.types';

const MAXIMUM_MILLISECONDS = 2_000;
const sizes = [10_000, 50_000];
const pipe = new OrderByPipe();

const results = sizes.map(size => {
  const fixture = createBookmarkFixture(size);
  const startedAt = performance.now();
  const sorted = pipe.transform(fixture, { column: 'title', asc: true });
  const sortMilliseconds = performance.now() - startedAt;

  const analysisStartedAt = performance.now();
  const analysis = analyzeCleanup({
    nodes: [
      { id: '0', title: 'root', isFolder: true, childCount: 1 },
      { id: '1', parentId: '0', title: 'Bookmarks Bar', isFolder: true, childCount: size },
      ...fixture.map((bookmark): CleanupNodeSnapshot => ({
        id: bookmark.id,
        parentId: '1',
        title: bookmark.title,
        url: bookmark.url,
        dateAdded: bookmark.dateAdded,
        isFolder: false,
        childCount: 0
      }))
    ],
    tags: {},
    usefulness: {},
    settings: { staleDays: 730 },
    now: 1_800_000_000_000
  });
  const analysisMilliseconds = performance.now() - analysisStartedAt;

  if (sorted.length !== size || sorted[0].title > sorted[sorted.length - 1].title) {
    throw new Error(`Large-library fixture ${size} produced an invalid sort result`);
  }
  if (sortMilliseconds > MAXIMUM_MILLISECONDS) {
    throw new Error(
      `Sorting ${size} bookmarks took ${sortMilliseconds.toFixed(2)}ms, exceeding ${MAXIMUM_MILLISECONDS}ms`
    );
  }
  if (analysis.findings.length !== size || analysisMilliseconds > MAXIMUM_MILLISECONDS) {
    throw new Error(
      `Analyzing ${size} bookmarks took ${analysisMilliseconds.toFixed(2)}ms or returned incomplete results`
    );
  }

  return {
    bookmarks: size,
    sortMilliseconds: Number(sortMilliseconds.toFixed(2)),
    analysisMilliseconds: Number(analysisMilliseconds.toFixed(2)),
    maximumMilliseconds: MAXIMUM_MILLISECONDS
  };
});

console.log(JSON.stringify({ benchmark: 'large-library-foundation', results }, null, 2));
