# aktionariat-client

Aktionariat → DFX for the **RealUnit** issuer page.

- Aktionariat reads **KYC status only**. It does not start KYC and does not store the dossier.
- **Every issuer field is `RealUnit`.**
- Full contract: **[docs/API.md](docs/API.md)**.

```
POST /v1/auth/signIn          { "wallet": "RealUnit", ... }
GET  /v2/kyc/client/aktionariat/users?wallet=RealUnit
GET  /v2/kyc/client/aktionariat/users/:address?wallet=RealUnit
```

Status `state`: `NotStarted` | `NoConsent` | `Ok`. After `NotStarted` / `NoConsent`: DFX legal consent, then the Sumsub widget (no start-URL API).

Routes: [DFXswiss/backend#5429](https://github.com/DFXswiss/backend/pull/5429) (not on production until merged).

## Tests

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN from signIn with "wallet": "RealUnit"
npm test
```

Node.js 20+. Do not commit `.env`.
