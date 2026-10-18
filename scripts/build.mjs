// Собирает опросник в один автономный файл dist/orsat.html:
// его можно открыть без интернета, переслать или выложить на любой хостинг.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const js = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: ['chrome90', 'edge90', 'firefox90', 'safari14', 'ios14'],
  minify: true,
  write: false,
  charset: 'utf8',
  logLevel: 'warning',
});

const css = await build({
  entryPoints: ['src/styles.css'],
  bundle: true,
  target: ['chrome90', 'edge90', 'firefox90', 'safari14', 'ios14'],
  minify: true,
  write: false,
  charset: 'utf8',
  logLevel: 'warning',
});

const template = await readFile('src/index.html', 'utf8');
const jsText = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const cssText = css.outputFiles[0].text;

const html = template
  .replace('/*__CSS__*/', () => cssText)
  .replace('/*__JS__*/', () => jsText);

await mkdir('dist', { recursive: true });
// index.html — для хостинга (открывается по адресу сайта), orsat.html — для пересылки файлом
await writeFile('dist/index.html', html);
await writeFile('dist/orsat.html', html);
console.log(`dist/index.html, dist/orsat.html — ${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ`);
