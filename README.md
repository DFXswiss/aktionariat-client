# aktionariat-client

Tests the Aktionariat KYC-client status API from the partner side.

Endpoints under test:

- `GET /v2/kyc/client/aktionariat/users`
- `GET /v2/kyc/client/aktionariat/users/:address`

Auth is a KYC-client company JWT (Bearer). This repo does not implement a KYC-start client.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DFX_ACCESS_TOKEN` from a KYC-client company sign-in:
   - `GET /v1/auth/challenge?address=...`
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
