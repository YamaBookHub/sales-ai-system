import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const sourceRoot = join(process.cwd(), 'apps/api/src');
const forbiddenDomainDependencies = [
  'prisma.service',
  'openai-client',
  '/infrastructure/',
  '../infrastructure/',
  '/application/',
  '../application/'
];

describe('architecture dependency rules', () => {
  it('keeps domain files free from DB services, external clients, and outer layers', () => {
    const violations = domainFiles()
      .flatMap((file) => forbiddenDomainImports(file).map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`));

    expect(violations).toEqual([]);
  });
});

function domainFiles() {
  return allTypeScriptFiles(sourceRoot).filter((file) => file.includes('/domain/') && !file.endsWith('.spec.ts'));
}

function allTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return allTypeScriptFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function forbiddenDomainImports(file: string) {
  const source = readFileSync(file, 'utf8');
  const imports = Array.from(source.matchAll(/import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)).map((match) => match[1]);
  return imports.filter((dependency) => forbiddenDomainDependencies.some((forbidden) => dependency.includes(forbidden)));
}
