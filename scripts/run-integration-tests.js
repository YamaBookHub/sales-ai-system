const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const defaultTestDatabaseUrl =
  'postgresql://postgres:postgres@127.0.0.1:5432/sales_ai_system_test';

function databaseName(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!name || !/(^|[_-])test($|[_-])/i.test(name)) {
    throw new Error(`Refusing integration test against non-test database: ${name || '(empty)'}`);
  }
  return name;
}

function run(command, args, env = {}, capture = false) {
  return execFileSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
  });
}

function ensureDefaultDockerDatabase(name) {
  try {
    const exists = run(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-tAc',
        `SELECT 1 FROM pg_database WHERE datname='${name}'`
      ],
      {},
      true
    ).trim();
    if (exists !== '1') {
      run('docker', ['compose', 'exec', '-T', 'postgres', 'createdb', '-U', 'postgres', name]);
    }
  } catch (error) {
    throw new Error(
      `Could not prepare Docker test database. Run "docker compose up -d postgres" first. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function main() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || defaultTestDatabaseUrl;
  const name = databaseName(testDatabaseUrl);
  const usingDefault = !process.env.TEST_DATABASE_URL;

  console.log(`Integration database: ${name}`);
  if (usingDefault) ensureDefaultDockerDatabase(name);

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('\n== Apply migrations ==');
  run(
    npx,
    ['--no-install', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    { DATABASE_URL: testDatabaseUrl }
  );

  console.log('\n== Integration tests ==');
  run(npm, ['run', 'test:integration:jest'], { TEST_DATABASE_URL: testDatabaseUrl });
}

try {
  main();
} catch (error) {
  console.error(`\nIntegration test setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
