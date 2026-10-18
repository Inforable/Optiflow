// Copies ../fixtures/*.json into public/fixtures/ so fixture mode and the
// landing preview can fetch them. Tolerates a missing source folder (for
// example inside a container build that only copies frontend/).
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', '..', 'fixtures');
const dest = resolve(here, '..', 'public', 'fixtures');

if (!existsSync(src)) {
  console.warn(`[copy-fixtures] ${src} not found; skipping (fixture mode will be unavailable).`);
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.json'));
for (const f of files) copyFileSync(join(src, f), join(dest, f));
console.log(`[copy-fixtures] copied ${files.length} files to public/fixtures/`);
