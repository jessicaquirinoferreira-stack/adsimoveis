import { build } from 'esbuild';

async function buildApi() {
  await build({
    entryPoints: ['server/vercel-entry.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    outfile: 'api/index.js',
  });
  console.log('Built api/index.js (ESM)');
}

await buildApi();
