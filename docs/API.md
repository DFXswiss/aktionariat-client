# DFX API — Aktionariat

How Aktionariat’s investor page talks to DFX for **RealUnit**.

| Who | Role |
|-----|------|
| Aktionariat | Unregulated partner. Hosts the investor page. **Must not perform KYC for RealUnit/DFX.** Reads **status only**. Does not receive or store the KYC dossier. |
| RealUnit / DFX | Regulated. Own the KYC. Data flows **from DFX to Aktionariat**, never the other way. |
| RealUnit | One issuer on Aktionariat (one DFX customer among others). |

**Every DFX call that names an issuer must send the exact string `RealUnit`.**

| Call | Where |
|------|--------|
| `POST /v1/auth/signUp` | JSON `"wallet": "RealUnit"` |
| `POST /v1/auth/signIn` | JSON `"wallet": "RealUnit"` |
| `GET /v2/kyc/client/aktionariat/users` | Query `wallet=RealUnit` |
| `GET /v2/kyc/client/aktionariat/users/:address` | Query `wallet=RealUnit` |

Do not omit it. Do not send `Aktionariat` or `DFX`.

Status routes ship with [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429) and are not on production until that merges.

- Production: `https://api.dfx.swiss`
- Swagger: [https://api.dfx.swiss/swagger](https://api.dfx.swiss/swagger)

---

## What Aktionariat implements

1. **Check status** by investor address (§3).
2. **Branch on `state`** (§3.3):
   - `NotStarted` — no RealUnit ident yet. Show DFX legal consent, then the **Sumsub widget**. There is **no** DFX endpoint that returns a start URL.
   - `NoConsent` — RealUnit ident was rejected. Not other issuers’ KYC.
   - `Ok` — RealUnit ident completed.
3. **Never write KYC into Aktionariat.** The JSON below is status only.

No `<dfx-services>` widget on the investor page. Identification is Sumsub. PEP/sanctions stay on DFX.

---

## 1. Authenticate (Aktionariat server)

The partner server signs in as a normal DFX **user**.

The operator address must exist as a DFX user, be **active**, and be listed on the DFX host in `AKTIONARIAT_KYC_READER_ADDRESSES` (comma-separated, case-insensitive; empty = nobody).

Do not call `GET /v1/auth/challenge`.

### 1.1 Message

```http
GET /v1/auth/signMessage?address=0xOperator
```

Sign the returned `message` (EIP-191 personal_sign). Non-production prefixes `[dev]_` or `[loc]_`.

### 1.2 signUp (once)

```http
POST /v1/auth/signUp
```

```json
{
  "address": "0xOperator",
  "signature": "0x…",
  "wallet": "RealUnit"
}
```

### 1.3 signIn (each session)

```http
POST /v1/auth/signIn
```

```json
{
  "address": "0xOperator",
  "signature": "0x…",
  "wallet": "RealUnit"
}
```

```json
{ "accessToken": "<jwt>" }
```

Role `User`, default lifetime two days. Tests: `DFX_ACCESS_TOKEN`.

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

| HTTP | Meaning |
|------|---------|
| 404 | No user yet → `signUp` |
| 401 | Bad signature |

---

## 2. List RealUnit investors

```http
GET /v2/kyc/client/aktionariat/users?wallet=RealUnit
Authorization: Bearer <accessToken>
```

`200` — array of §3.3 objects for users on the RealUnit issuer wallet.

---

## 3. Status by investor address

This is the check Murat needs.

```http
GET /v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit
Authorization: Bearer <accessToken>
```

Always `200` when auth succeeds (unknown address is `NotStarted`, not `404`). Path `:address` is case-insensitive; URL-encode it.

### 3.3 Object

| Field | Type | When set |
|-------|------|----------|
| `id` | string | Always (investor address) |
| `state` | string | Always: `NotStarted` \| `NoConsent` \| `Ok` |

No `kycLevel`. That is a DFX-internal scale and is not part of this contract.

| `state` | Meaning for the investor page |
|---------|-------------------------------|
| `NotStarted` | Not a RealUnit user, or RealUnit user without ident. Legal consent, then Sumsub. |
| `NoConsent` | RealUnit ident was rejected. |
| `Ok` | RealUnit ident completed. |

No mail, name, street, phone, or trading limit.

### 3.4 Errors (auth / query)

| HTTP | When |
|------|------|
| 400 | `wallet` missing or empty (`Wallet is required`) |
| 401 | No `Authorization` |
| 403 | Wrong JWT, inactive account, or operator not allowlisted (`Address is not allowlisted`) |
| 404 | Only if `wallet` is not a known issuer name |

```bash
TOKEN=…
curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users?wallet=RealUnit'

curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit'
```

---

## 4. Tests

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN = JWT from §1.3
# DFX_TEST_ADDRESS  = optional investor address
npm test
```

All status URLs include `wallet=RealUnit`. Without a token, tests skip.

`DFX_API_URL` defaults to `https://api.dfx.swiss`.
