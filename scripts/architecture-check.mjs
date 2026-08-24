import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', 'generated', 'artifacts']);

const errors = [];
const warnings = [];
const inventory = { over300: [], over500: [], over1000: [], files: 0, todoFixme: [], console: [] };

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function relative(file) {
  return file.split(path.sep).join('/');
}

function checkBoundaries(file, content) {
  const rel = relative(file);
  if (rel.startsWith('packages/domain/')) {
    const forbidden = [/@oes\/database/, /@nestjs\//, /from ['"]next(?:\/|['"])/, /from ['"]react(?:\/|['"])/, /apps\/(?:api|web)\//];
    if (forbidden.some((pattern) => pattern.test(content))) {
      errors.push(`${rel}: domain package depends on infrastructure/framework code`);
    }
  }

  if (rel.startsWith('apps/web/') && /(?:apps\/api\/|@oes\/api)/.test(content)) {
    errors.push(`${rel}: web must consume API contracts over HTTP, not import API implementation`);
  }

  if (rel.startsWith('packages/') && !rel.startsWith('packages/database/') && /@prisma\/client/.test(content)) {
    errors.push(`${rel}: Prisma client is restricted to the database package or application adapters`);
  }
}

for (const root of ROOTS) {
  try {
    const info = await stat(root);
    if (!info.isDirectory()) continue;
  } catch {
    continue;
  }

  for (const file of await walk(root)) {
    const content = await readFile(file, 'utf8');
    const rel = relative(file);
    const lines = content.split(/\r?\n/).length;
    inventory.files += 1;
    if (lines > 300) inventory.over300.push([rel, lines]);
    if (lines > 500) inventory.over500.push([rel, lines]);
    if (lines > 1000) inventory.over1000.push([rel, lines]);
    if (/\b(?:TODO|FIXME)\b/.test(content)) inventory.todoFixme.push(rel);
    if (/\bconsole\.(?:log|debug|info|warn|error)\s*\(/.test(content)) inventory.console.push(rel);
    checkBoundaries(file, content);
  }
}

for (const [file, lines] of inventory.over1000) {
  errors.push(`${file}: ${lines} lines exceeds the 1000-line architecture ceiling`);
}
for (const [file, lines] of inventory.over500) {
  warnings.push(`${file}: ${lines} lines; refactor review required (>500)`);
}
for (const file of inventory.todoFixme) errors.push(`${file}: TODO/FIXME is not allowed in committed source; track debt in ROADMAP instead`);
for (const file of inventory.console) warnings.push(`${file}: console.* found; verify intentional operational logging`);

const sortByLines = (items) => [...items].sort((a, b) => b[1] - a[1]);
console.log(`Architecture inventory: ${inventory.files} source files`);
console.log(`>300 lines: ${inventory.over300.length}; >500: ${inventory.over500.length}; >1000: ${inventory.over1000.length}`);
for (const [file, lines] of sortByLines(inventory.over300)) console.log(`  ${String(lines).padStart(4)}  ${file}`);
if (warnings.length > 0) {
  console.warn('\nArchitecture warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}
if (errors.length > 0) {
  console.error('\nArchitecture gate failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('\nArchitecture gate passed.');
