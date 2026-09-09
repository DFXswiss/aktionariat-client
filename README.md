# aktionariat-client

DFX API notes and tests for **Aktionariat**. RealUnit is one issuer on that platform.

**Every DFX call must pass `RealUnit` as the issuer** (`wallet` in JSON or `?wallet=RealUnit`). See **[docs/API.md](docs/API.md)**.

This repo does not start KYC. It only reads status.

Endpoints (ship with [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429); not on production `develop` until that merges):

- `GET /v2/kyc/client/aktionariat/users?wallet=RealUnit`
- `GET /v2/kyc/client/aktionariat/users/:address?wallet=RealUnit`

Auth: user JWT of an address on `AKTIONARIAT_KYC_READER_ADDRESSES`. Login body must include `"wallet": "RealUnit"`.

## Setup

1. Copy `.env.example` to `.env`.
2. `GET /v1/auth/signMessage?address=...` then `POST /v1/auth/signIn` with `"wallet": "RealUnit"`. Put the token in `DFX_ACCESS_TOKEN`.
3. Optionally set `DFX_TEST_ADDRESS`.
4. Do not commit `.env`.

Without `DFX_ACCESS_TOKEN`, `npm test` skips.

```bash
npm test
```

Requires Node.js 20+.

## Response fields

| Field       | Meaning        |
|-------------|----------------|
| `id`        | Wallet address |
| `kycLevel`  | KYC level      |
| `kycStatus` | KYC status     |
| `kycHash`   | KYC hash       |
