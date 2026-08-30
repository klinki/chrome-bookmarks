import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = join(repositoryRoot, 'dist', 'bookmarks', 'browser');
const manifestPath = join(extensionRoot, 'manifest.json');

if (!existsSync(manifestPath)) {
  throw new Error(`Packaged extension manifest is missing: ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  throw new Error(`Packaged extension manifest is not valid JSON: ${manifestPath}`, { cause: error });
}

const backgroundScript = manifest.background?.service_worker;
const optionsPage = manifest.options_page;
if (!backgroundScript || !optionsPage) {
  throw new Error('Packaged extension manifest must declare a background service worker and options page');
}

const requiredFiles = [
  backgroundScript,
  optionsPage,
  ...Object.values(manifest.icons ?? {})
].filter(Boolean);

const missingFiles = requiredFiles.filter(file => !existsSync(join(extensionRoot, file)));
if (missingFiles.length > 0) {
  throw new Error(`Packaged extension is missing files: ${missingFiles.join(', ')}`);
}

console.log(`Extension package verified: ${extensionRoot}`);
