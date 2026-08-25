import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve('apps/web');
const findings = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.next' || entry.name === 'node_modules') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (/\.(?:css|ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function add(file, rule, detail) {
  findings.push(`${path.relative(process.cwd(), file)} · ${rule} · ${detail}`);
}

for (const file of await walk(root)) {
  const source = await fs.readFile(file, 'utf8');
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    if (/\bstyle\s*=\s*\{\{/.test(source)) add(file, 'NO_INLINE_LAYOUT_STYLE', 'style={{ ... }} must move to a shared primitive or CSS module');
    if (/institutions\.module\.css/.test(source)) add(file, 'NO_SHARED_FEATURE_CSS', 'features must not depend on another feature CSS module');
  }
  if (file.endsWith('.css')) {
    if (/!important\b/.test(source)) add(file, 'NO_IMPORTANT', '!important is forbidden in product UI');
    if (/@import\s+url\(/.test(source)) add(file, 'NO_REMOTE_FONT_IMPORT', 'fonts must use next/font');
  }
}

const globalsPath = path.join(root, 'app', 'globals.css');
const globals = await fs.readFile(globalsPath, 'utf8');
for (const legacyToken of ['--ink:', '--ink-soft:', '--paper:', '--white:']) {
  if (globals.includes(legacyToken)) add(globalsPath, 'NO_LEGACY_TOKENS', `legacy token ${legacyToken} must not exist`);
}

if (findings.length > 0) {
  console.error(`UI Architecture Gate failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('UI Architecture Gate passed: no inline layout styles, !important, remote font imports, cross-feature CSS imports, or legacy root tokens.');
