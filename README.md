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

Status `state`: `NotStarted` (has `url`; send the browser there, with no Sumsub widget and no consent of your own) | `NoConsent` (ident rejected; no `url`) | `Ok` (ident completed; no `url`). An address on another DFX wallet stays `NotStarted` until that account has consented to Aktionariat; after that, the same three states apply.

The status routes are on production at `https://api.dfx.swiss`.

## Tests

```bash
cp .env.example .env
# DFX_ACCESS_TOKEN from signIn with "wallet": "RealUnit"
npm test
```

Node.js 20+. Do not commit `.env`.
