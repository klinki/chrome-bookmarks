import { performance } from 'node:perf_hooks';
import { FaviconPipe } from '../src/app/pipes/favicon.pipe';

const WARMUP_ITERATIONS = 50_000;
const ITERATIONS_PER_SAMPLE = 200_000;
const SAMPLE_COUNT = 9;
const MAX_MEDIAN_NANOSECONDS = 1_000;

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      getURL: (path: string) => `chrome-extension://benchmark${path}`
    }
  }
});

const pipe = new FaviconPipe();
const urls = [
  'https://example.com/',
  'https://example.com/a path?q=one',
  'https://developer.chrome.com/docs/extensions/',
  'https://github.com/kl1nki/chrome-bookmarks'
];

function runSample(iterations: number): { nanosecondsPerOperation: number; checksum: number } {
  let checksum = 0;
  const startedAt = performance.now();

  for (let index = 0; index < iterations; index++) {
    checksum += pipe.transform(urls[index % urls.length]).length;
  }

  const elapsedMilliseconds = performance.now() - startedAt;
  return {
    nanosecondsPerOperation: elapsedMilliseconds * 1_000_000 / iterations,
    checksum
  };
}

runSample(WARMUP_ITERATIONS);

const samples = Array.from(
  { length: SAMPLE_COUNT },
  () => runSample(ITERATIONS_PER_SAMPLE)
);
const sortedDurations = samples
  .map(sample => sample.nanosecondsPerOperation)
  .sort((left, right) => left - right);
const medianNanoseconds = sortedDurations[Math.floor(sortedDurations.length / 2)];
const checksum = samples.reduce((total, sample) => total + sample.checksum, 0);

if (checksum === 0 || !Number.isFinite(medianNanoseconds)) {
  throw new Error('Favicon benchmark did not execute valid production work');
}

console.log(JSON.stringify({
  benchmark: 'FaviconPipe.transform',
  warmupIterations: WARMUP_ITERATIONS,
  iterationsPerSample: ITERATIONS_PER_SAMPLE,
  sampleCount: SAMPLE_COUNT,
  medianNanoseconds: Number(medianNanoseconds.toFixed(2)),
  maximumMedianNanoseconds: MAX_MEDIAN_NANOSECONDS
}, null, 2));

if (medianNanoseconds > MAX_MEDIAN_NANOSECONDS) {
  throw new Error(
    `FaviconPipe.transform median ${medianNanoseconds.toFixed(2)}ns exceeded ${MAX_MEDIAN_NANOSECONDS}ns budget`
  );
}
