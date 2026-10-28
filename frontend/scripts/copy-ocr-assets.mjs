// Copies the tesseract.js worker, WASM core and English model into public/ so OCR runs without any CDN.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');
const target = join(root, 'public', 'tesseract');

const copy = (from, to) => {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}. Run npm install.`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
};

copy(join(modules, 'tesseract.js', 'dist', 'worker.min.js'), join(target, 'worker.min.js'));
const coreDir = join(modules, 'tesseract.js-core');
for (const file of readdirSync(coreDir).filter(name => name.endsWith('-lstm.wasm.js'))) {
  copy(join(coreDir, file), join(target, 'core', file));
}
copy(join(modules, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), join(target, 'lang', 'eng.traineddata.gz'));
console.log(`OCR assets copied to ${target}`);
