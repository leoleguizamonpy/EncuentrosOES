import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS);
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', 'generated', 'artifacts']);
const WEB_COMPONENTS_ROOT = 'apps/web/components';
const WORKSPACE_STANDARD_IMPORT = "composes: workspace from './workspace-standard.module.css'";

const errors = [];
const warnings = [];
const inventory = {
  console: [],
  doubleCasts: [],
  explicitAny: [],
  files: 0,
  over1000: [],
  over300: [],
  over500: [],
  todoFixme: [],
};
const contents = new Map();
const graph = new Map();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (SOURCE_EXTENSION_SET.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

async function walkCssModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkCssModules(absolute));
    else if (entry.name.endsWith('.module.css')) files.push(absolute);
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

function checkWorkspaceStyleContract(file, content) {
  const rel = relative(file);
  if (rel.endsWith('/workspace-standard.module.css')) return;

  if (/\.workspace\s*\{/.test(content) && !content.includes(WORKSPACE_STANDARD_IMPORT)) {
    errors.push(`${rel}: admin .workspace must compose workspace-standard.module.css instead of defining independent page geometry`);
  }

  if (rel.endsWith('/dashboard-client.module.css') && /\.page\s*\{/.test(content) && !content.includes(WORKSPACE_STANDARD_IMPORT)) {
    errors.push(`${rel}: dashboard outer .page must compose workspace-standard.module.css`);
  }
}

function importSpecifiers(content) {
  const specifiers = [];
  const pattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => contents.has(candidate)) ?? null;
}

function findCycles() {
  const state = new Map();
  const stack = [];
  const reported = new Set();

  function visit(node) {
    const status = state.get(node) ?? 0;
    if (status === 2) return;
    if (status === 1) {
      const index = stack.indexOf(node);
      const cycle = [...stack.slice(index), node].map(relative);
      const canonical = cycle.slice(0, -1).sort().join('|');
      if (!reported.has(canonical)) {
        reported.add(canonical);
        errors.push(`import cycle: ${cycle.join(' -> ')}`);
      }
      return;
    }
    state.set(node, 1);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    state.set(node, 2);
  }

  for (const node of graph.keys()) visit(node);
}

const files = [];
for (const root of ROOTS) {
  try {
    const info = await stat(root);
    if (info.isDirectory()) files.push(...await walk(root));
  } catch {
    // Optional root absent in partial package execution.
  }
}

for (const file of files) contents.set(path.resolve(file), await readFile(file, 'utf8'));

for (const file of files) {
  const absolute = path.resolve(file);
  const content = contents.get(absolute);
  const rel = relative(file);
  const lines = content.split(/\r?\n/).length;
  inventory.files += 1;
  if (lines > 300) inventory.over300.push([rel, lines]);
  if (lines > 500) inventory.over500.push([rel, lines]);
  if (lines > 1000) inventory.over1000.push([rel, lines]);
  if (/\b(?:TODO|FIXME)\b/.test(content)) inventory.todoFixme.push(rel);
  if (/\bconsole\.(?:log|debug|info|warn|error)\s*\(/.test(content)) inventory.console.push(rel);
  if (/(?:\bas\s+any\b|:\s*any\b|<any>)/.test(content)) inventory.explicitAny.push(rel);
  if (/\bas\s+unknown\s+as\b/.test(content)) inventory.doubleCasts.push(rel);
  checkBoundaries(file, content);
  graph.set(absolute, importSpecifiers(content)
    .map((specifier) => resolveRelativeImport(absolute, specifier))
    .filter((dependency) => dependency !== null));
}

try {
  const styleRootInfo = await stat(WEB_COMPONENTS_ROOT);
  if (styleRootInfo.isDirectory()) {
    for (const styleFile of await walkCssModules(WEB_COMPONENTS_ROOT)) {
      checkWorkspaceStyleContract(styleFile, await readFile(styleFile, 'utf8'));
    }
  }
} catch {
  // Web components are optional in partial package execution.
}

findCycles();

for (const [file, lines] of inventory.over1000) {
  errors.push(`${file}: ${lines} lines exceeds the 1000-line architecture ceiling`);
}
for (const [file, lines] of inventory.over500) {
  warnings.push(`${file}: ${lines} lines; refactor review required (>500)`);
}
for (const file of inventory.todoFixme) {
  errors.push(`${file}: TODO/FIXME is not allowed in committed source; track debt in ROADMAP instead`);
}
for (const file of inventory.console) warnings.push(`${file}: console.* found; verify intentional operational logging`);
for (const file of inventory.explicitAny) warnings.push(`${file}: explicit any found; verify boundary justification`);
for (const file of inventory.doubleCasts) warnings.push(`${file}: double cast found; verify adapter/test justification`);

const sortByLines = (items) => [...items].sort((a, b) => b[1] - a[1]);
console.log(`Architecture inventory: ${inventory.files} source files`);
console.log(`>300 lines: ${inventory.over300.length}; >500: ${inventory.over500.length}; >1000: ${inventory.over1000.length}`);
console.log(`explicit any files: ${inventory.explicitAny.length}; double-cast files: ${inventory.doubleCasts.length}; TODO/FIXME files: ${inventory.todoFixme.length}; console files: ${inventory.console.length}`);
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
