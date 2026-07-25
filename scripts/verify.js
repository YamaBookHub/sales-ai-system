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

function validateProductionArtifacts() {
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const dockerIgnore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/verify.yml'), 'utf8');
  const migrationLock = fs.readFileSync(
    path.join(root, 'prisma/migrations/migration_lock.toml'),
    'utf8'
  );
  const lockfile = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const playwrightVersion = lockfile.packages?.['node_modules/playwright']?.version;

  const requiredDockerPatterns = [
    [/^FROM .+ AS builder$/m, 'builder stage'],
    [/^FROM .+ AS migration$/m, 'migration stage'],
    [/^FROM mcr\.microsoft\.com\/playwright:v([0-9.]+)-noble AS runtime$/m, 'Playwright runtime stage'],
    [/apt-get install -y --no-install-recommends ca-certificates openssl/, 'Prisma OpenSSL runtime'],
    [/^RUN npm prune --omit=dev$/m, 'production dependency pruning'],
    [/^USER pwuser$/m, 'non-root runtime user'],
    [/^HEALTHCHECK /m, 'runtime healthcheck'],
    [/^CMD \["node", "dist\/apps\/api\/main\.js"\]$/m, 'runtime command']
  ];
  for (const [pattern, label] of requiredDockerPatterns) {
    if (!pattern.test(dockerfile)) throw new Error(`Dockerfile is missing ${label}.`);
  }

  const runtimeVersion = dockerfile.match(
    /^FROM mcr\.microsoft\.com\/playwright:v([0-9.]+)-noble AS runtime$/m
  )?.[1];
  if (!playwrightVersion || runtimeVersion !== playwrightVersion) {
    throw new Error(
      `Docker Playwright ${runtimeVersion || '(missing)'} does not match package-lock ${playwrightVersion || '(missing)'}.`
    );
  }
  if (/^COPY\s+\.\s+\.$/m.test(dockerfile)) {
    throw new Error('Dockerfile must use an explicit copy allowlist instead of COPY . .');
  }
  if (/^(?:ARG|ENV)\s+.*(?:SECRET|TOKEN|PASSWORD|API_KEY)/im.test(dockerfile)) {
    throw new Error('Dockerfile must not accept or define secret-bearing build arguments.');
  }

  for (const entry of ['.env', '.env.*', 'node_modules', 'dist', '.git']) {
    if (!dockerIgnore.split(/\r?\n/).includes(entry)) {
      throw new Error(`.dockerignore is missing ${entry}.`);
    }
  }

  const requiredWorkflowPatterns = [
    [/permissions:\s*\n\s+contents: read/, 'read-only repository permission'],
    [/services:\s*\n\s+postgres:/, 'PostgreSQL migration service'],
    [/MAIL_SEND_ENABLED: 'false'/, 'disabled real mail delivery'],
    [/npm run verify/, 'source verification'],
    [/docker run --rm --network host/, 'migration artifact execution'],
    [/npm run prisma:migrate:status/, 'migration status check'],
    [/prisma migrate diff/, 'schema drift check'],
    [/docker build --target migration/, 'migration artifact build'],
    [/docker build --target runtime/, 'runtime artifact build']
  ];
  for (const [pattern, label] of requiredWorkflowPatterns) {
    if (!pattern.test(workflow)) throw new Error(`CI workflow is missing ${label}.`);
  }
  if (/(?:docker\s+push|kubectl|terraform\s+apply|deploy-pages|vercel\s+deploy)/i.test(workflow)) {
    throw new Error('CI verification workflow must not deploy or push production artifacts.');
  }
  if (!/^provider = "postgresql"$/m.test(migrationLock)) {
    throw new Error('Prisma migration provider lock must be PostgreSQL.');
  }

  console.log(
    `Production artifacts: Playwright ${playwrightVersion}, migration/runtime targets, migration drift, CI checks OK`
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
  console.log('\n== Production artifacts ==');
  validateProductionArtifacts();

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
