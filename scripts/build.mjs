// Dependency-light build: esbuild bundles the web UI and the server. Usage: node scripts/build.mjs [web|server|all]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const what = process.argv[2] || 'all';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = (...p) => path.join(root, ...p);

if (what === 'web' || what === 'all') {
  fs.rmSync(r('dist'), { recursive: true, force: true });
  const out = await build({
    entryPoints: [r('src/main.tsx')], bundle: true, outdir: r('dist/assets'), entryNames: 'app-[hash]', chunkNames: 'chunk-[hash]', assetNames: 'a-[hash]',
    splitting: true, format: 'esm', target: ['chrome90', 'es2020'], minify: true, jsx: 'automatic', metafile: true, legalComments: 'none', logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  fs.cpSync(r('public'), r('dist'), { recursive: true });
  const outputs = Object.keys(out.metafile.outputs).map(f => path.basename(f));
  const js = outputs.find(f => /^app-.*\.js$/.test(f)); const css = outputs.find(f => /^app-.*\.css$/.test(f));
  const tags = `${css ? `<link rel="stylesheet" href="/assets/${css}">` : ''}<script type="module" src="/assets/${js}"></script>`;
  fs.writeFileSync(r('dist/index.html'), fs.readFileSync(r('index.html'), 'utf8').replace('<!--ASSETS-->', tags));
  const total = Object.values(out.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
  console.log(`web: ${outputs.length} files, ${(total / 1024).toFixed(0)} KB JS/CSS → dist/`);
}
if (what === 'server' || what === 'all') {
  await build({ entryPoints: [r('server/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile: r('dist-server/server.mjs'), logLevel: 'warning', banner: { js: 'import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);' } });
  console.log('server: dist-server/server.mjs');
}
