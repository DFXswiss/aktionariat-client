import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const ISSUER = 'RealUnit';

export const STATES = ['notStarted', 'noConsent', 'ok'];

export function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function baseUrl() {
  return (process.env.DFX_API_URL || 'https://api.dfx.swiss').replace(/\/$/, '');
}

export function accessToken() {
  return process.env.DFX_ACCESS_TOKEN?.trim() || '';
}

export function authHeaders(token = accessToken()) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

export function usersUrl(address) {
  const rootPath = `${baseUrl()}/v2/kyc/client/aktionariat/users`;
  const path = address ? `${rootPath}/${encodeURIComponent(address)}` : rootPath;
  return `${path}?wallet=${encodeURIComponent(ISSUER)}`;
}

export const EXPECTED_KEYS = ['id', 'state', 'kycLevel', 'kycStatus', 'kycHash'];

export const FORBIDDEN_KEYS = [
  'mail',
  'firstName',
  'lastName',
  'street',
  'phone',
  'birthday',
  'tradingLimit',
];

export function assertUserShape(user) {
  for (const key of EXPECTED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(user, key)) {
      throw new Error(`missing key: ${key}`);
    }
  }
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      throw new Error(`forbidden key present: ${key}`);
    }
  }
  if (!STATES.includes(user.state)) {
    throw new Error(`invalid state: ${user.state}`);
  }
  if (user.state === 'ok') {
    if (user.kycLevel == null || user.kycStatus == null || user.kycHash == null) {
      throw new Error('ok status missing kyc fields');
    }
  } else if (user.kycLevel != null || user.kycStatus != null || user.kycHash != null) {
    throw new Error(`${user.state} must not include kyc payload`);
  }
}
