# DFX API — Aktionariat

How Aktionariat calls DFX.

**Aktionariat** is the partner. **RealUnit** is one issuer on that platform (one DFX customer among others). Every DFX call that names an issuer must use the exact string `RealUnit`.

| Call | Field | Value |
|------|--------|--------|
| `POST /v1/auth/signUp` | JSON `wallet` | `"RealUnit"` |
| `POST /v1/auth/signIn` | JSON `wallet` | `"RealUnit"` |
| `GET /v2/kyc/client/aktionariat/users` | query `wallet` | `RealUnit` |
| `GET /v2/kyc/client/aktionariat/users/:address` | query `wallet` | `RealUnit` |

Never omit it. Never send `Aktionariat`, `DFX`, or an empty string.

The two status GETs are specified here and implemented in [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429). They are not on production until that change is merged.

There is no partner endpoint that starts KYC or returns a Sumsub link. Investors complete KYC on DFX. Aktionariat only reads status.

- Production: `https://api.dfx.swiss`
- Swagger: [https://api.dfx.swiss/swagger](https://api.dfx.swiss/swagger)
- JSON: `Content-Type: application/json`
- Auth header: `Authorization: Bearer <accessToken>`

---

## 1. Authenticate

Aktionariat’s server signs in as a normal DFX **user** (wallet signature).

The operator address must:

1. Exist as a DFX user (`signUp` once, then `signIn`)
2. Be listed on the DFX host in `AKTIONARIAT_KYC_READER_ADDRESSES` (comma-separated, case-insensitive; empty list means nobody)
3. Belong to an active account

Do not use `GET /v1/auth/challenge`. That login is not part of this integration.

### 1.1 Sign message

```http
GET /v1/auth/signMessage?address=0xOperator
```

```json
{
  "message": "By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_0xOperator",
  "blockchains": ["Ethereum"]
}
```

Sign `message` as EIP-191 personal_sign (EOA). Non-production prefixes the string with `[dev]_` or `[loc]_`.

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

`wallet` is required for this integration. It is the issuer name.

### 1.3 signIn (every session)

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

Always send `wallet`. Response:

```json
{ "accessToken": "<jwt>" }
```

Role `User`. Default lifetime two days. Store it as `DFX_ACCESS_TOKEN` for tests in this repo.

| HTTP | Meaning |
|------|---------|
| 404 | No DFX user for this address → `signUp` |
| 401 | Bad signature |

Use the token:

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

---

## 2. Read KYC status

Requires the JWT from §1 **and** `wallet=RealUnit`.

The list is the investors of that issuer (DFX wallet named `RealUnit`), not the operator’s own KYC. The body is status only: no mail, name, street, phone, or trading limit.

### 2.1 List

```http
GET /v2/kyc/client/aktionariat/users?wallet=RealUnit
Authorization: Bearer <accessToken>
```

`200` — JSON array of §2.3.

### 2.2 One investor

```http
GET /v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit
Authorization: Bearer <accessToken>
```

Path `:address` is the investor wallet (case-insensitive). Encode it in the URL.

`200` — one object; `id` equals the path address.  
`404` — that address is not an investor of issuer `RealUnit`.

### 2.3 Object

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Investor address |
| `kycLevel` | number | `0` none, `10` contact, `20` personal, `30` ident, `40` financial, `50` DFX staff approval |
| `kycStatus` | string | `NA` \| `Light` \| `Full` \| `Rejected` (legacy; prefer `kycLevel`) |
| `kycHash` | string | KYC hash |

### 2.4 Errors

| HTTP | When |
|------|------|
| 400 | `wallet` query missing or empty (`wallet is required`) |
| 401 | No `Authorization` |
| 403 | Not a user JWT, inactive account, or operator address not allowlisted (`Address is not allowlisted`) |
| 404 | Unknown issuer name, or investor not on that issuer |

```bash
TOKEN=…
curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users?wallet=RealUnit'

curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit'
```

---

## 3. Tests

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN = JWT from §1.3
# DFX_TEST_ADDRESS  = optional investor address
npm test
```

Requests use `wallet=RealUnit`. Without `DFX_ACCESS_TOKEN` the suite skips.

`DFX_API_URL` defaults to `https://api.dfx.swiss`.
