# aktionariat-client

Partner tests and API notes for DFX RealUnit / Aktionariat.

**How to get a JWT and how to call each RealUnit / KYC-client endpoint:** see **[docs/API.md](docs/API.md)**.

This repo does not implement a KYC-start client.

Endpoints under test:

- `GET /v2/kyc/client/aktionariat/users`
- `GET /v2/kyc/client/aktionariat/users/:address`

Auth is a normal user JWT (Bearer). The address must be on `AKTIONARIAT_KYC_READER_ADDRESSES`.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DFX_ACCESS_TOKEN` from a **user** sign-in of an allowlisted address:
   - `GET /v1/auth/signMessage?address=...`
   - `POST /v1/auth/signIn`
3. Optionally set `DFX_TEST_ADDRESS` to exercise the single-user GET.
4. Do not commit `.env`.

Without `DFX_ACCESS_TOKEN`, `npm test` skips — there is nothing to assert without a live call.

## Run

```bash
npm test
```

Requires Node.js 20+.

## Response fields

Each user object exposes:

| Field       | Meaning                          |
|-------------|----------------------------------|
| `id`        | Wallet address                   |
| `kycLevel`  | KYC level                        |
| `kycStatus` | KYC status                       |
| `kycHash`   | KYC hash                         |

No dossier or document fields are returned on this surface.
