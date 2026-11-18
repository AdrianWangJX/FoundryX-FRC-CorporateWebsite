import { build } from 'esbuild';
import { copyFile, cp, mkdir } from 'node:fs/promises';

await build({
  entryPoints: ['src/server/worker.mjs'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});

// The Tencent Node service reads migrations directly from the source tree.
// Only package Worker hosting metadata when that deployment is configured.
try {
  await mkdir('dist/.openai', { recursive: true });
  await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
