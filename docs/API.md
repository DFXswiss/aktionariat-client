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

The status routes are on production.

- Production: `https://api.dfx.swiss`
- Swagger: [https://api.dfx.swiss/swagger](https://api.dfx.swiss/swagger)

---

## What Aktionariat implements

1. **Check status** by investor address (§3).
2. **Branch on `state`** (§3.3):
   - `NotStarted` — ident is neither completed nor rejected, the address is unknown, or the address is on another DFX wallet that has not consented to Aktionariat as a KYC client. That other wallet stays `NotStarted` until consent, even when its ident was rejected or completed. Includes `url`; send the browser there. No Sumsub widget and no consent of your own.
   - `NoConsent` — ident was rejected on the RealUnit wallet, or on another DFX wallet after that account has consented to Aktionariat. No `url`. Block the investor and send nobody to a URL. Without that consent the address stays `NotStarted`.
   - `Ok` — ident completed. No `url`.
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

Always `200` when auth succeeds (unknown address is `NotStarted`, not `404`, and includes `url`). Path `:address` is case-insensitive; URL-encode it.

### 3.3 Object

| Field | Type | When set |
|-------|------|----------|
| `id` | string | Always (investor address) |
| `state` | string | Always: `NotStarted` \| `NoConsent` \| `Ok` |
| `url` | string | Only when `state` is `NotStarted`. Absent for `Ok` and `NoConsent` (not `null`, not an empty string). |

No `kycLevel`. That is a DFX-internal scale and is not part of this contract.

`url` is the DFX KYC page. The API chooses the host by environment; Aktionariat does not. Production: `https://app.dfx.swiss/kyc`. Development: `https://dev.app.dfx.swiss/kyc`. Query, in this order: `wallet=RealUnit`, `client=Aktionariat`, `address=<investor address>`. The address is the same value as `id`. The `url` from the API does not contain `kyc-redirect`. Aktionariat appends `kyc-redirect` itself, and only when the redirect target is `https` and the host is exactly `shares.realunit.ch`. DFX rejects any other host. Do not add any other query parameter.

| `state` | Meaning for the investor page |
|---------|-------------------------------|
| `NotStarted` | Ident is neither completed nor rejected, the address is unknown, or the address is on another DFX wallet and has not consented to Aktionariat as a KYC client. That other wallet stays `NotStarted` until consent, even when its ident was rejected or completed. Open `url`: that page takes the wallet signature, the consent, and Sumsub. Do not show a Sumsub widget or your own consent. An unknown address stays `NotStarted` (not 404) and therefore has `url`. |
| `NoConsent` | Ident was rejected on the RealUnit wallet, or on another DFX wallet after that account has consented to Aktionariat. Block the investor and send nobody to `url`. There is no `url`. Without that consent the address stays `NotStarted`. |
| `Ok` | Ident completed. No `url`. A RealUnit account with completed ident is `Ok` even without a separate consent step. An account on another wallet is `Ok` only after it has consented to Aktionariat and ident is completed. |

`NotStarted`:

```json
{
  "id": "0xInvestor",
  "state": "NotStarted",
  "url": "https://app.dfx.swiss/kyc?wallet=RealUnit&client=Aktionariat&address=0xInvestor"
}
```

`NoConsent`:

```json
{
  "id": "0xInvestor",
  "state": "NoConsent"
}
```

`Ok`:

```json
{
  "id": "0xInvestor",
  "state": "Ok"
}
```

No mail, name, street, phone, or trading limit.

### 3.4 Errors (auth / query)

| HTTP | When |
|------|------|
| 400 | `wallet` missing/empty (`Wallet is required`) or not `RealUnit` (`Wallet must be RealUnit`) |
| 401 | No `Authorization` |
| 403 | Wrong JWT, inactive account, or operator not allowlisted (`Address is not allowlisted`) |
| 404 | The RealUnit wallet record is missing (`Wallet not found`) |

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
