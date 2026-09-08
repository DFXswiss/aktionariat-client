# DFX API — JWT and RealUnit endpoints

This is the partner-facing guide for calling the DFX API from Aktionariat / RealUnit.

Interactive schema: [https://api.dfx.swiss/swagger](https://api.dfx.swiss/swagger)

Production base URL: `https://api.dfx.swiss`

All amounts in JSON are human-readable display units (for example `1.5`, not satoshis).

URI versioning:

| Area | Prefix |
|------|--------|
| Auth, RealUnit | `/v1` (default) |
| KYC client | `/v2` |

Send JSON as `Content-Type: application/json`. Authenticated calls use:

```http
Authorization: Bearer <accessToken>
```

---

## 1. Get a JWT

There are two login kinds. They use the same `POST /v1/auth/signIn`, but **different messages to sign**. Mixing them fails with `401 Invalid credentials` or a wrong role.

| Kind | When | How the server decides | JWT `role` | Default lifetime |
|------|------|------------------------|------------|------------------|
| **Company** | Partner backend (this repo, KYC-client GETs) | A challenge was fetched for this address and is still valid | `KycClientCompany` if the wallet is a KYC client, otherwise `ClientCompany` | **10 minutes** (`JWT_EXPIRES_IN_COMPANY`) |
| **User** | End-customer RealUnit flows (buy, sell, register, PDFs, referral) | No live challenge for this address | `User` (or the user’s stored role) | **2 days** (`JWT_EXPIRES_IN`) |

The company wallet must already exist in DFX (it is provisioned, not created by `signIn`). `GET /v1/auth/challenge` returns `400 Wallet not found/invalid` if the address is unknown.

### 1.1 Company JWT (KYC client)

Use this for every `/v2/kyc/client/...` call.

**Step A — challenge** (must be an existing company wallet address):

```http
GET /v1/auth/challenge?address=0xYourCompanyWallet
```

```json
{ "challenge": "<uuid>" }
```

The challenge is stored in memory and is valid for **10 seconds** (`CHALLENGE_EXPIRES_IN`). After that, `signIn` returns `401 Challenge invalid`. Fetch a new challenge immediately before signing.

**Step B — sign the challenge string itself** (the UUID), not the user sign-in sentence. For a normal EOA, sign the UTF-8 challenge with the company wallet’s private key (EIP-191 personal sign). Contract wallets may need `key` / `blockchain` as in Swagger (`SignInDto`).

**Step C — exchange the signature**:

```http
POST /v1/auth/signIn
```

```json
{
  "address": "0xYourCompanyWallet",
  "signature": "0x..."
}
```

```json
{ "accessToken": "<jwt>" }
```

If `GET /v1/auth/challenge` was **not** called (or already expired) for this address, `signIn` takes the **user** path instead and typically returns `404 User not found` for a company-only address.

`signIn` consumes the challenge (one-time). Replay needs a new challenge.

**curl** (replace signing with your wallet stack):

```bash
BASE=https://api.dfx.swiss
ADDR=0xYourCompanyWallet

CHALLENGE=$(curl -sS "$BASE/v1/auth/challenge?address=$ADDR" | jq -r .challenge)
# SIGN=$(sign_personal "$CHALLENGE" )   # implement with your signer

curl -sS -X POST "$BASE/v1/auth/signIn" \
  -H 'Content-Type: application/json' \
  -d "{\"address\":\"$ADDR\",\"signature\":\"$SIGN\"}"
```

Put `accessToken` in `.env` as `DFX_ACCESS_TOKEN` for `npm test`. Refresh it when it expires (~10 minutes).

Errors:

| Status | Meaning |
|--------|---------|
| 400 `Wallet not found/invalid` | Address is not a known company wallet |
| 401 `Challenge invalid` | No challenge, or older than 10 seconds |
| 401 `Invalid credentials` | Signature does not match the challenge |

### 1.2 User JWT (RealUnit customer)

Use this for `/v1/realunit/buy`, `sell`, `register`, PDFs, legal accept, referral, etc.

**Step A — message to sign**:

```http
GET /v1/auth/signMessage?address=0xCustomerWallet
```

```json
{
  "message": "By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_0xCustomerWallet",
  "blockchains": ["Ethereum", "..."]
}
```

On non-production the message is prefixed with `[dev]_` or `[loc]_`.

**Step B — `POST /v1/auth/signIn`** with `{ "address", "signature" }` (optional `key`, `blockchain` for contract wallets). The user must already exist (`404 User not found` otherwise). First-time users use `POST /v1/auth/signUp` with the same signature plus optional `wallet` (wallet name, e.g. branding).

**Do not** call `/v1/auth/challenge` before a user `signIn`. A leftover valid challenge on that address would route the call through company login.

### 1.3 Using the token

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

A company token on a user-only route (or the reverse) is `403`.

---

## 2. Partner KYC-client endpoints

Role required: **`KycClientCompany`** (company JWT from §1.1).

These routes are scoped to **users of that company wallet**. Another company’s users are not returned. IDs in paths are **wallet addresses**.

### 2.1 Aktionariat status surface (thin)

These are the two GETs this repo tests. They return **only** status fields — no mail, name, address, phone, or trading limit.

Wallet name on the JWT must be `Aktionariat`. Any other KYC-client wallet gets `403 Wallet is not Aktionariat`.

| Method | Path | Auth | Success | Notes |
|--------|------|------|---------|--------|
| GET | `/v2/kyc/client/aktionariat/users` | Company JWT | `200` array | All users of the Aktionariat wallet |
| GET | `/v2/kyc/client/aktionariat/users/:address` | Company JWT | `200` object | One user; `404` if the address is not a user of this wallet |

Without `Authorization`: `401`. Wrong role: `403`.

**Item shape** (`AktionariatKycStatusDto`):

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | User wallet address (same as `:address`) |
| `kycLevel` | number | See §2.3 |
| `kycStatus` | string | `NA` \| `Light` \| `Full` \| `Rejected` (legacy label; prefer `kycLevel`) |
| `kycHash` | string | KYC hash |

```bash
TOKEN=...   # company JWT
curl -sS -H "Authorization: Bearer $TOKEN" \
  https://api.dfx.swiss/v2/kyc/client/aktionariat/users

curl -sS -H "Authorization: Bearer $TOKEN" \
  https://api.dfx.swiss/v2/kyc/client/aktionariat/users/0xCustomer
```

There is **no** partner endpoint that starts KYC or returns a Sumsub redirect. New customers complete KYC on the DFX / RealUnit hosted flow after legal consent. Status is read afterwards with the GETs above.

### 2.2 Full KYC-client dump (same JWT, more fields)

Same company JWT. These return the full `KycClientDataDto` (PII). Prefer §2.1 for the Aktionariat investor page.

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/v2/kyc/client/users` | `KycClientCompany` | Array of full KYC client rows (`id` = address plus mail, name, address, `kycLevel`, `kycStatus`, `kycHash`, `tradingLimit`, …) |
| GET | `/v2/kyc/client/users/:id/documents` | `KycClientCompany` | Available report types (currently `Identification`) |
| GET | `/v2/kyc/client/users/:id/documents/:type` | `KycClientCompany` | File bytes (`type` = `Identification`) |
| GET | `/v2/kyc/client/users/:id/payments` | `KycClientCompany` | Payments for that user; query `from`, `to` |
| GET | `/v2/kyc/client/payments` | **`ClientCompany`** (not KYC-client) | All payments; query `from`, `to`, `limit` (max 1000) |

`:id` is the user **address**. Unknown / other-wallet user → `404` (no existence leak).

### 2.3 `kycLevel`

| Value | Meaning |
|-------|---------|
| 0 | Nothing |
| 10 | Contact data |
| 20 | Personal data |
| 30 | Ident |
| 40 | Financial data |
| 50 | DFX staff approval |

---

## 3. RealUnit HTTP API (`/v1/realunit`)

Swagger tag: **Realunit**. Unless noted, paths are under `https://api.dfx.swiss/v1/realunit`.

Auth column:

- **Public** — no JWT
- **User JWT** — §1.2 (`User`, account active)
- **Staff JWT** — RealUnit operations (`RealUnit` role). Not for the Aktionariat partner integration.

### 3.1 Public market / chain data

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/account/:address` | Public | Account summary for a RealUnit address |
| GET | `/account/:address/history` | Public | Paginated history; query `first`, `before`, `after` |
| GET | `/holders` | Public | Paginated holders; query `first`, `before`, `after` |
| GET | `/price` | Public | Current REALU price |
| GET | `/price/history` | Public | History; query `timeFrame` (default week) |
| GET | `/tokenInfo` | Public | Token metadata |

### 3.2 Quotes (use these; `/brokerbot/*` is deprecated)

Public. Currency query follows Swagger (`BrokerbotCurrencyQueryDto`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/quote/info` | REALU spot plus on-chain Brokerbot contract addresses. Price values come from the Aktionariat Brokerbot. |
| GET | `/quote/price` | Price |
| GET | `/quote/buyPrice` | Buy quote for a CHF (or configured) amount |
| GET | `/quote/buyShares` | Buy quote for a share count |
| GET | `/quote/sellPrice` | Sell quote for an amount |
| GET | `/quote/sellShares` | Sell quote for a share count |

Deprecated mirrors (same payloads): `/brokerbot/info`, `/price`, `/buyPrice`, `/buyShares`, `/sellPrice`, `/sellShares`.

### 3.3 Registration (Aktionariat confirmation lives here)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/registration` | User JWT | What the connected wallet must do to register (`state`), plus `userData` to pre-fill |
| GET | `/wallet/status` | User JWT | Wallet/registration status for the caller |
| GET | `/register/date` | Account JWT | EIP-712 date envelope used by `register/complete` and `register/wallet` |
| GET | `/register/status` | User JWT | `true` if this wallet is RealUnit-registered |
| POST | `/register/email` | User JWT | First step: email. May send a merge mail if the email already exists |
| POST | `/register/complete` | Account JWT | Complete registration (EIP-712 envelope) |
| POST | `/register/wallet` | Account JWT | Register / bind wallet |
| GET | `/confirm-aktionariat` | **Public** | Called from the confirmation link (`realunit.app/confirm-aktionariat`). **Not** a JWT. The `code` query param is the capability. |

**`GET /v1/realunit/confirm-aktionariat` query** (all required):

| Query | Meaning |
|-------|---------|
| `email` | Address the link was sent to (case-insensitive; API lowercases) |
| `code` | Aktionariat confirmation code |
| `user` | Aktionariat user id from the link |

Response:

```json
{
  "status": "confirmed",
  "confirmedAddresses": ["0x..."],
  "confirmedDate": "2026-01-01T00:00:00.000Z"
}
```

`status`:

| Value | Meaning |
|-------|---------|
| `confirmed` | Aktionariat accepted (HTTP 2xx); local registration(s) unlocked |
| `confirmed_no_registration` | Aktionariat accepted but no local RealUnit registration matched the email — treat as hard failure, not a retry |
| `invalid` | Link invalid/expired (Aktionariat HTTP 4xx) |
| `unavailable` | Aktionariat unreachable / 5xx / timeout — retry |

Extra query params on the link are ignored.

### 3.4 Buy / sell / transfer / swap / pay (User JWT)

KYC **level 30** and RealUnit registration are required for buy (and similarly enforced on the other money paths). Missing KYC or registration → `400`.

| Method | Path | Purpose |
|--------|------|---------|
| PUT | `/buy` | Create buy; returns personal IBAN / payment info |
| PUT | `/buy/:id/confirm` | Confirm buy after payment |
| PUT | `/buy/:id/deactivate` | Cancel / deactivate buy |
| PUT | `/sell` | Create sell |
| PUT | `/sell/:id/confirm` | Confirm sell |
| PUT | `/sell/:id/unsigned-transactions` | Unsigned txs for `brokerbotSell` (nonce N) and `zchfDeposit` (nonce N+1) |
| PUT | `/sell/:id/broadcast` | Broadcast a signed EIP-1559 tx for one sell step; idempotent per signed payload |
| PUT | `/transfer` | Persist transfer intent; returns EIP-7702 delegation (gasless REALU transfer; DFX pays gas). Recipient must be a registered shareholder |
| PUT | `/transfer/:id/confirm` | Relay user-signed EIP-7702 delegation; returns tx hash |
| PUT | `/swap` | Swap intent |
| PUT | `/swap/:id/unsigned-transaction` | Unsigned swap tx |
| PUT | `/swap/:id/broadcast` | Broadcast signed swap tx |
| PUT | `/pay/unsigned-transaction` | OCP pay: unsigned tx |
| PUT | `/pay/submit` | OCP pay: submit |
| GET | `/pay/:id/status` | OCP pay status |

Bodies: see Swagger (`RealUnitBuyDto`, `RealUnitSellDto`, `RealUnitTransferDto`, `RealUnitSwapDto`, `RealUnitOcpPayDto`, …).

### 3.5 PDFs (User JWT)

The wallet in the body must be **the caller’s** (`403` otherwise). Reference dates for statements must be in the past.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/balance/pdf` | Portfolio statement (REALU only) as base64 PDF |
| POST | `/transactions/receipt/single` | Receipt for one chain tx |
| POST | `/transactions/receipt/multi` | Combined receipts |

### 3.6 Legal

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/v1/realunit/legal` | Public | Current RealUnit legal text / version |
| PUT | `/v1/realunit/legal` | User JWT | Accept current legal |

### 3.7 Referral (User JWT unless noted)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/v1/realunit/referral/terms` | Public | Terms |
| PUT | `/v1/realunit/referral/terms/accept` | User JWT | Accept terms |
| GET | `/v1/realunit/referral/summary` | User JWT | Caller summary |
| GET | `/v1/realunit/referral/payouts` | User JWT | Payouts |
| POST | `/v1/realunit/referral/invites` | User JWT | Create invite |
| GET | `/v1/realunit/referral/invites` | User JWT | List invites |
| POST | `/v1/realunit/referral/bind` | User JWT | Bind invite |
| GET | `/v1/realunit/referral/code/:code` | User JWT | Resolve code |
| POST | `/v1/realunit/referral/promo` | Public | Apply promo |

### 3.8 Staff-only (not for this partner integration)

Role `RealUnit` (operations). Hidden from public Swagger (`@ApiExcludeEndpoint`). Listed so they are not confused with partner routes.

- `GET/PUT /v1/realunit/admin/...` — quotes, transactions, payment confirm, deactivate, registration forward, stats
- `GET /v1/realunit/compliance/customers...` — customer dossier/files for RealUnit staff
- ` /v1/realunit/support/...` — tenant-scoped support desk
- Referral admin: `promo`, `relations`, payout retry

---

## 4. Tests in this repo

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN = company JWT from §1.1
# optional DFX_TEST_ADDRESS = one customer address for GET .../users/:address
npm test
```

Without `DFX_ACCESS_TOKEN`, tests skip (there is no dummy assertion).

`DFX_API_URL` defaults to `https://api.dfx.swiss`.
