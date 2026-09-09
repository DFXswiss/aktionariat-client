import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadEnv,
  baseUrl,
  accessToken,
  authHeaders,
  usersUrl,
  assertUserShape,
} from './helpers.mjs';

loadEnv();

const token = accessToken();
const live = Boolean(token);
const zeroAddress = '0x0000000000000000000000000000000000000000';

describe('GET /v2/kyc/client/aktionariat/users?wallet=RealUnit', { skip: !live }, () => {
  it('returns 401 without Authorization', async () => {
    const res = await fetch(usersUrl(), { headers: { Accept: 'application/json' } });
    assert.equal(res.status, 401);
  });

  it('returns 400 when wallet is omitted', async () => {
    const res = await fetch(`${baseUrl()}/v2/kyc/client/aktionariat/users`, {
      headers: authHeaders(),
    });
    assert.equal(res.status, 400);
  });

  it('lists users with the status shape', async () => {
    const res = await fetch(usersUrl(), { headers: authHeaders() });
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
});

describe('GET /v2/kyc/client/aktionariat/users/:address?wallet=RealUnit', { skip: !live }, () => {
  it('returns 200 notStarted for an unused address', async () => {
    const res = await fetch(usersUrl(zeroAddress), { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      assert.fail(`auth rejected with ${res.status}`);
    }
    assert.equal(res.status, 200);
    const user = await res.json();
    assertUserShape(user);
    assert.equal(user.state, 'notStarted');
  });
});

describe('GET /v2/kyc/client/aktionariat/users/:address?wallet=RealUnit (known investor)', {
  skip: !live || !process.env.DFX_TEST_ADDRESS?.trim(),
}, () => {
  it('returns 200 with matching id', async () => {
    const address = process.env.DFX_TEST_ADDRESS.trim();
    const res = await fetch(usersUrl(address), { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      assert.fail(`auth rejected with ${res.status}`);
    }
    assert.equal(res.status, 200);
    const user = await res.json();
    assertUserShape(user);
    assert.equal(user.id.toLowerCase(), address.toLowerCase());
  });
});
