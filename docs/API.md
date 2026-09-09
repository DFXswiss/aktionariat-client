# DFX API for Aktionariat

Partner guide for Aktionariat calling DFX. RealUnit is **one issuer** on Aktionariat, not the partner itself.

**Every DFX call from Aktionariat must name the issuer. For RealUnit that value is exactly `RealUnit`.**

| Call | Where `RealUnit` goes |
|------|------------------------|
| `POST /v1/auth/signUp` | JSON `"wallet": "RealUnit"` |
| `POST /v1/auth/signIn` | JSON `"wallet": "RealUnit"` |
| `GET /v2/kyc/client/aktionariat/users` | Query `wallet=RealUnit` |
| `GET /v2/kyc/client/aktionariat/users/:address` | Query `wallet=RealUnit` |

Do not omit it. Do not send `Aktionariat`, `DFX`, or an empty string.

The two status GETs ship with [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429). They are not on production `develop` until that merges.

Base URL: `https://api.dfx.swiss`  
Swagger: [https://api.dfx.swiss/swagger](https://api.dfx.swiss/swagger)

There is **no** partner endpoint that starts KYC or returns a Sumsub link. New investors complete KYC on the DFX-hosted flow. Aktionariat only **reads status** afterwards.

---

## 1. Login (User JWT)

Aktionariat’s backend logs in as a normal DFX **user** (wallet signature), not with Company JWT.

The login address must:

1. Already be a DFX user (`signUp` once, then `signIn`)
2. Be listed on the DFX API host as `AKTIONARIAT_KYC_READER_ADDRESSES` (comma-separated, case-insensitive; empty = nobody)
3. Have an active account

### 1.1 Message to sign

```http
GET /v1/auth/signMessage?address=0xYourOperatorWallet
```

```json
{
  "message": "By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_0xYourOperatorWallet",
  "blockchains": ["Ethereum", "..."]
}
```

On non-production the message is prefixed with `[dev]_` or `[loc]_`. Sign the `message` string (EIP-191 personal sign for an EOA).

**Do not** call `GET /v1/auth/challenge`. That is a different login (Company JWT) and is not used here.

### 1.2 First time: `signUp`

```http
POST /v1/auth/signUp
Content-Type: application/json
```

```json
{
  "address": "0xYourOperatorWallet",
  "signature": "0x...",
  "wallet": "RealUnit"
}
```

`"wallet": "RealUnit"` is **required** for this integration. It selects the issuer tenant (DFX wallet name `RealUnit`, id 47 in prod).

### 1.3 Later: `signIn`

```http
POST /v1/auth/signIn
Content-Type: application/json
```

```json
{
  "address": "0xYourOperatorWallet",
  "signature": "0x...",
  "wallet": "RealUnit"
}
```

Again `"wallet": "RealUnit"` is **required**.

```json
{ "accessToken": "<jwt>" }
```

Token role is `User`. Default lifetime **2 days**. Put it in `.env` as `DFX_ACCESS_TOKEN` for `npm test`.

| Status | Meaning |
|--------|---------|
| 404 `User not found` | Address has no DFX user yet → `signUp` |
| 401 `Invalid credentials` | Bad signature |
| 403 on later GETs | Address not on `AKTIONARIAT_KYC_READER_ADDRESSES`, or account inactive |

Send the token as:

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

---

## 2. KYC status (issuer = RealUnit)

Both routes require the User JWT from §1 **and** `wallet=RealUnit`.

They return users of the DFX wallet named in `wallet` (for RealUnit: that issuer’s investors). They do **not** return the caller’s own KYC. Fields are status only — no mail, name, street, phone, or trading limit.

### 2.1 List

```http
GET /v2/kyc/client/aktionariat/users?wallet=RealUnit
Authorization: Bearer <accessToken>
```

`200` — array of objects (§2.3).

### 2.2 One investor

```http
GET /v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit
Authorization: Bearer <accessToken>
```

`:address` is the investor’s wallet. Match is case-insensitive.

`200` — one object, `id` equals the path address.  
`404` — that address is not a user of the `RealUnit` wallet (no extra leak).

### 2.3 Item shape

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Investor wallet address |
| `kycLevel` | number | `0` nothing, `10` contact, `20` personal, `30` ident, `40` financial, `50` DFX staff approval |
| `kycStatus` | string | `NA` \| `Light` \| `Full` \| `Rejected` (legacy; prefer `kycLevel`) |
| `kycHash` | string | KYC hash |

### 2.4 Errors

| Status | When |
|--------|------|
| 400 | `wallet` query missing or empty |
| 401 | No `Authorization` |
| 403 | Wrong JWT kind, inactive account, or caller address not allowlisted (`Address is not allowlisted`) |
| 404 | Unknown issuer name, or investor not on that issuer wallet |

```bash
TOKEN=...   # user JWT from §1, allowlisted address
curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users?wallet=RealUnit'

curl -sS -H "Authorization: Bearer $TOKEN" \
  'https://api.dfx.swiss/v2/kyc/client/aktionariat/users/0xInvestor?wallet=RealUnit'
```

---

## 3. Tests in this repo

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN = user JWT from §1 (wallet: RealUnit)
# optional DFX_TEST_ADDRESS = one RealUnit investor address
npm test
```

Live calls use `?wallet=RealUnit`. Without `DFX_ACCESS_TOKEN`, tests skip.

`DFX_API_URL` defaults to `https://api.dfx.swiss`.
