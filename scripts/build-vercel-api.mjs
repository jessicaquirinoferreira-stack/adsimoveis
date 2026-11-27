import { build } from 'esbuild';
import fs from 'node:fs';

async function buildApi() {
  const result = await build({
    entryPoints: ['server/vercel-entry.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    packages: 'external',
    write: false,
  });

  let code = result.outputFiles[0].text;
  code = code.replace(
    /module\.exports\s*=\s*__toCommonJS\([^)]+\);/,
    'module.exports = handler;\nmodule.exports.default = handler;'
  );
  if (!code.includes('module.exports = handler;')) {
    code += '\nmodule.exports = handler;\nmodule.exports.default = handler;\n';
  }

  fs.mkdirSync('api', { recursive: true });
  fs.writeFileSync('api/index.js', code, 'utf-8');
  console.log(`Built api/index.js (${Buffer.byteLength(code)} bytes)`);
}

await buildApi();
