// Writes PACKAGE_MANIFEST.json: every shipped file with size and SHA-256 (so you can verify the ZIP).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const skip = new Set(['node_modules', 'data', '.git', 'PACKAGE_MANIFEST.json']);
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (skip.has(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const b = fs.readFileSync(p); files.push({ path: path.relative(root, p), bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }); } } })(root);
files.sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(root, 'PACKAGE_MANIFEST.json'), JSON.stringify({ name: 'OpenJarvis', version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, fileCount: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), files }, null, 1));
console.log(`manifest: ${files.length} files`);
