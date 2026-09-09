# aktionariat-client

Partner documentation and live checks for **Aktionariat → DFX**.

RealUnit is one issuer. **Every DFX call that names an issuer must send `RealUnit`.** Full contract: **[docs/API.md](docs/API.md)**.

This repository does not start KYC. It only documents and tests **status reads**.

```
GET /v2/kyc/client/aktionariat/users?wallet=RealUnit
GET /v2/kyc/client/aktionariat/users/:address?wallet=RealUnit
```

Those routes ship with [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429) and are not on production until that merges.

Auth is a **user** JWT. Login JSON must include `"wallet": "RealUnit"`. The operator address must be on DFX env `AKTIONARIAT_KYC_READER_ADDRESSES`.

## Tests

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN from POST /v1/auth/signIn with "wallet": "RealUnit"
# optional DFX_TEST_ADDRESS
npm test
```

Node.js 20+. Do not commit `.env`. Without a token, tests skip.
