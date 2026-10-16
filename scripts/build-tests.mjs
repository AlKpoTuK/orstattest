// Собирает модули с логикой в ESM, чтобы их можно было проверить встроенным node:test.
import { build } from 'esbuild';

await build({
  entryPoints: { scoring: 'src/scoring.ts', content: 'src/content.ts' },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: 'dist-test',
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
