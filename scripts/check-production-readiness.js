const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envFileIndex = process.argv.indexOf('--env-file');
const envFile = envFileIndex >= 0 ? process.argv[envFileIndex + 1] : undefined;
const allowMailDisabled = process.argv.includes('--allow-mail-disabled');
const env = envFile ? { ...process.env, ...readEnvFile(envFile) } : process.env;
const errors = [];

requireEqual('APP_ENV', 'production');
requireEqual('AUTH_MODE', 'google');
requireHttpsOrigin('APP_BASE_URL');
requireValue('DATABASE_URL');
requireSecret('SESSION_SECRETS', 32, true);
requireSecret('CSRF_SECRET', 32);
requireSecret('TRACKING_HASH_SECRET', 32);
requireValue('GOOGLE_AUTH_CLIENT_ID');
requireValue('GOOGLE_AUTH_CLIENT_SECRET');
requireHttpsUrl('GOOGLE_AUTH_REDIRECT_URI');
requireValue('LEGAL_OPERATOR_NAME');
requireValue('LEGAL_POSTAL_ADDRESS');
requireEmail('LEGAL_CONTACT_EMAIL');
requireValue('LEGAL_EFFECTIVE_DATE');
requireValue('RELEASE_REVISION');

const mailEnabled = normalized('MAIL_SEND_ENABLED') === 'true';
if (!mailEnabled && !allowMailDisabled) {
  errors.push('MAIL_SEND_ENABLED must be true for a general commercial release.');
}
if (mailEnabled) {
  requireEqual('MAIL_SENDER_PROVIDER', 'gmail');
  requireValue('GMAIL_CLIENT_ID');
  requireValue('GMAIL_CLIENT_SECRET');
  requireValue('GMAIL_REFRESH_TOKEN');
  requireEmail('GMAIL_FROM_EMAIL');
  requireUuid('MAIL_SENDER_ORGANIZATION_ID');
  requireValueFromEither('MAIL_LEGAL_SENDER_NAME', 'LEGAL_OPERATOR_NAME');
  requireValueFromEither('MAIL_LEGAL_POSTAL_ADDRESS', 'LEGAL_POSTAL_ADDRESS');
  requireEmailFromEither('MAIL_LEGAL_CONTACT_EMAIL', 'LEGAL_CONTACT_EMAIL');
}

for (const file of [
  'docs/41_COMMERCIAL_RELEASE_GATE.md',
  'docs/42_DATA_GOVERNANCE.md',
  'docs/43_GMAIL_OAUTH_CHECKLIST.md',
  'docs/44_PILOT_ORDER_FORM_TEMPLATE.md'
]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Required release document is missing: ${file}`);
}

if (errors.length) {
  console.error('Production readiness configuration failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Production readiness configuration: OK${allowMailDisabled ? ' (mail-disabled pilot)' : ''}`);

function readEnvFile(file) {
  if (!file) throw new Error('--env-file requires a path.');
  const resolved = path.resolve(file);
  return Object.fromEntries(
    fs.readFileSync(resolved, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = stripMatchingQuotes(line.slice(separator + 1).trim());
        return [key, value];
      })
  );
}

function stripMatchingQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalized(name) {
  return String(env[name] || '').trim();
}

function requireValue(name) {
  if (!normalized(name)) errors.push(`${name} is required.`);
}

function requireEqual(name, expected) {
  if (normalized(name).toLowerCase() !== expected) errors.push(`${name} must be ${expected}.`);
}

function requireSecret(name, minimum, commaSeparated = false) {
  const values = commaSeparated
    ? normalized(name).split(',').map((value) => value.trim()).filter(Boolean)
    : [normalized(name)];
  if (!values.length || values.some((value) => value.length < minimum)) {
    errors.push(`${name} must contain ${commaSeparated ? 'only ' : 'a '}${minimum}+ character secret${commaSeparated ? 's' : ''}.`);
  }
}

function requireHttpsOrigin(name) {
  requireHttpsUrl(name);
  try {
    const url = new URL(normalized(name));
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      errors.push(`${name} must be an HTTPS origin without path, query, credentials, or fragment.`);
    }
  } catch {
    // requireHttpsUrl already recorded the error.
  }
}

function requireHttpsUrl(name) {
  try {
    if (new URL(normalized(name)).protocol !== 'https:') errors.push(`${name} must use HTTPS.`);
  } catch {
    errors.push(`${name} must be a valid HTTPS URL.`);
  }
}

function requireEmail(name) {
  const value = normalized(name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${name} must be a valid email address.`);
}

function requireUuid(name) {
  const value = normalized(name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push(`${name} must be a valid UUID.`);
  }
}

function requireValueFromEither(primary, fallback) {
  if (!normalized(primary) && !normalized(fallback)) errors.push(`${primary} or ${fallback} is required.`);
}

function requireEmailFromEither(primary, fallback) {
  const value = normalized(primary) || normalized(fallback);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${primary} or ${fallback} must contain a valid email address.`);
  }
}
