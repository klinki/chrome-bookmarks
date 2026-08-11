import { performance } from 'node:perf_hooks';
import { OrderByPipe } from '../src/app/pipes/order-by.pipe';
import { createBookmarkFixture } from './bookmark-fixtures';

const MAXIMUM_MILLISECONDS = 2_000;
const sizes = [10_000, 50_000];
const pipe = new OrderByPipe();

const results = sizes.map(size => {
  const fixture = createBookmarkFixture(size);
  const startedAt = performance.now();
  const sorted = pipe.transform(fixture, { column: 'title', asc: true });
  const elapsedMilliseconds = performance.now() - startedAt;

  if (sorted.length !== size || sorted[0].title > sorted[sorted.length - 1].title) {
    throw new Error(`Large-library fixture ${size} produced an invalid sort result`);
  }
  if (elapsedMilliseconds > MAXIMUM_MILLISECONDS) {
    throw new Error(
      `Sorting ${size} bookmarks took ${elapsedMilliseconds.toFixed(2)}ms, exceeding ${MAXIMUM_MILLISECONDS}ms`
    );
  }

  return {
    bookmarks: size,
    elapsedMilliseconds: Number(elapsedMilliseconds.toFixed(2)),
    maximumMilliseconds: MAXIMUM_MILLISECONDS
  };
});

console.log(JSON.stringify({ benchmark: 'large-library-sort', results }, null, 2));
