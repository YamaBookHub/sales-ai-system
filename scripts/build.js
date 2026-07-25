const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distRoot = path.join(root, 'dist');
const output = path.join(distRoot, 'apps', 'api');
const expectedPrefix = `${distRoot}${path.sep}`;

if (!output.startsWith(expectedPrefix) || output === distRoot) {
  throw new Error('Refusing to clean an unexpected build output path.');
}

fs.rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [
  require.resolve('typescript/bin/tsc'),
  '-p',
  path.join(root, 'apps/api/tsconfig.app.json'),
  '--incremental',
  'false'
], {
  cwd: root,
  stdio: 'inherit'
});

for (const file of ['main.js', 'mail-worker.js']) {
  if (!fs.existsSync(path.join(output, file))) {
    throw new Error(`Build output is missing ${file}.`);
  }
}
