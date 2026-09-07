import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadEnv,
  baseUrl,
  accessToken,
  authHeaders,
  EXPECTED_KEYS,
  FORBIDDEN_KEYS,
  assertUserShape,
} from './helpers.mjs';

loadEnv();

const token = accessToken();
const live = Boolean(token);
const usersUrl = `${baseUrl()}/v2/kyc/client/aktionariat/users`;
const zeroAddress = '0x0000000000000000000000000000000000000000';

describe('KYC-client status contract', () => {
  it('documents the expected user JSON keys', () => {
    assert.deepEqual(EXPECTED_KEYS, ['id', 'kycLevel', 'kycStatus', 'kycHash']);
    assert.ok(FORBIDDEN_KEYS.includes('mail'));
    assert.ok(FORBIDDEN_KEYS.includes('firstName'));
  });
});

describe('GET /v2/kyc/client/aktionariat/users', { skip: !live }, () => {
  it('returns 401 without Authorization', async () => {
    const res = await fetch(usersUrl, {
      headers: { Accept: 'application/json' },
    });
    assert.equal(res.status, 401);
  });

  it('lists users with the thin status shape', async () => {
    const res = await fetch(usersUrl, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      assert.fail(`auth rejected with ${res.status}`);
    }
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body), 'body must be an array');
    for (const user of body) {
      assertUserShape(user);
    }
  });

  it('returns 404 for the zero address', async () => {
    const res = await fetch(`${usersUrl}/${zeroAddress}`, {
      headers: authHeaders(),
    });
    assert.equal(res.status, 404);
  });
});

describe('GET /v2/kyc/client/aktionariat/users/:address', {
  skip: !live || !process.env.DFX_TEST_ADDRESS?.trim(),
}, () => {
  it('returns 200 with matching id or 404', async () => {
    const address = process.env.DFX_TEST_ADDRESS.trim();
    const res = await fetch(`${usersUrl}/${address}`, {
      headers: authHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      assert.fail(`auth rejected with ${res.status}`);
    }
    if (res.status === 404) {
      assert.equal(res.status, 404);
      return;
    }
    assert.equal(res.status, 200);
    const user = await res.json();
    assertUserShape(user);
    assert.equal(user.id, address);
  });
});
