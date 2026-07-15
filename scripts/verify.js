const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');

const root = path.resolve(__dirname, '..');
const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

function normalizePath(value) {
  return value.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function collectImplementationRoutes() {
  const sourceRoot = path.join(root, 'apps/api/src');
  const controllerFiles = listFiles(sourceRoot).filter((file) => file.endsWith('.controller.ts'));
  const mainSource = fs.readFileSync(path.join(sourceRoot, 'main.ts'), 'utf8');
  const excludeBlock = mainSource.match(/setGlobalPrefix\('api',[\s\S]*?exclude:\s*\[([\s\S]*?)\]/);
  const excluded = new Set(
    [...(excludeBlock?.[1] || '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
  );
  const routes = new Set();

  for (const file of controllerFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const controller = source.match(/@Controller\((?:['"]([^'"]*)['"])?\)/);
    if (!controller) continue;

    const basePath = controller[1] || '';
    for (const route of source.matchAll(/@(Get|Post|Put|Patch|Delete)\((?:['"]([^'"]*)['"])?\)/g)) {
      const method = route[1].toUpperCase();
      const childPath = route[2] || '';
      const rawPath = `/${[basePath, childPath].filter(Boolean).join('/')}`;
      const publicPath = excluded.has(rawPath) ? rawPath : `/api${rawPath}`;
      routes.add(`${method} ${normalizePath(publicPath)}`);
    }
  }

  for (const route of mainSource.matchAll(/getInstance\(\)\.get\(\s*['"]([^'"]+)['"]/g)) {
    routes.add(`GET ${normalizePath(route[1])}`);
  }

  return routes;
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function resolveLocalReferences(document) {
  const references = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref') {
        if (typeof child !== 'string' || !child.startsWith('#/')) {
          throw new Error(`External or invalid OpenAPI reference: ${String(child)}`);
        }
        const resolved = child
          .slice(2)
          .split('/')
          .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
          .reduce((current, part) => current?.[part], document);
        if (resolved === undefined) throw new Error(`Missing OpenAPI reference: ${child}`);
        references.add(child);
      }
      visit(child);
    }
  }

  visit(document);
  return references.size;
}

function validateOpenApi() {
  const openApiPath = path.join(root, 'openapi/openapi.yaml');
  const document = parse(fs.readFileSync(openApiPath, 'utf8'));
  if (document?.openapi !== '3.0.3' || !document.paths) {
    throw new Error('openapi/openapi.yaml is not a valid OpenAPI 3.0.3 document.');
  }

  const declaredRoutes = new Set();
  for (const [routePath, pathItem] of Object.entries(document.paths)) {
    for (const method of httpMethods) {
      if (pathItem?.[method]) declaredRoutes.add(`${method.toUpperCase()} ${routePath}`);
    }
  }

  const implementationRoutes = collectImplementationRoutes();
  const missing = [...implementationRoutes].filter((route) => !declaredRoutes.has(route)).sort();
  const extra = [...declaredRoutes].filter((route) => !implementationRoutes.has(route)).sort();
  if (missing.length || extra.length) {
    throw new Error(
      `OpenAPI route mismatch.\nMissing: ${missing.join(', ') || '-'}\nExtra: ${extra.join(', ') || '-'}`
    );
  }

  const referenceCount = resolveLocalReferences(document);
  console.log(
    `OpenAPI: ${Object.keys(document.paths).length} paths / ${declaredRoutes.size} operations / ${referenceCount} refs OK`
  );
}

function run(label, command, args, env = {}) {
  console.log(`\n== ${label} ==`);
  execFileSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
}

function main() {
  console.log('== OpenAPI ==');
  validateOpenApi();

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const validationDatabaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/sales_ai_system_verify';
  run('Prisma schema', npm, ['run', 'prisma:validate'], { DATABASE_URL: validationDatabaseUrl });
  run('Unit tests', npm, ['test', '--', '--runInBand']);
  run('Build', npm, ['run', 'build']);
  console.log('\nVerification completed successfully.');
}

try {
  main();
} catch (error) {
  console.error(`\nVerification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
