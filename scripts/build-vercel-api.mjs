import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

async function compileCjsFunction(entryPoint, outfile) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    packages: 'external',
    write: false,
  });

  let code = result.outputFiles[0].text;
  // Ensure direct function export as module.exports AND module.exports.default
  code = code.replace(
    /module\.exports\s*=\s*__toCommonJS\([^)]+\);/,
    'module.exports = handler;\nmodule.exports.default = handler;'
  );
  if (!code.includes('module.exports = handler;')) {
    code += '\nmodule.exports = handler;\nmodule.exports.default = handler;\n';
  }

  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, code, 'utf-8');
  console.log(`Built ${outfile} (${Buffer.byteLength(code)} bytes)`);
}

await compileCjsFunction('server/vercel-core-entry.ts', 'api/index.cjs');
await compileCjsFunction('server/vercel-ai-entry.ts', 'api/ai.cjs');
