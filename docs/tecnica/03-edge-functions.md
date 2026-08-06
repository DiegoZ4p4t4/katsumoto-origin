# 03 — Edge Functions (Deno)

> Las 3 funciones de Supabase Edge. Verificado contra el código (2026-08-06).

Todas tienen `verify_jwt = false` (el runtime Edge no soporta JWT ES256) y validan el token manualmente con `supabase.auth.getUser(token)` + lookup de `profiles`.

## 1. `sunat-billing` — Motor de facturación SUNAT

**Versión:** 80 · **Autor:** nativo Deno, sin PHP.

### Acciones

| Action | Transporte | Descripción |
|---|---|---|
| `test` | - | Firma un XML de prueba local (certificado + clave privada) |
| `send` | SOAP `sendBill` | Factura/nota (síncrono, CDR inmediato) |
| `send-summary` | SOAP `sendSummary` | Resumen diario de boletas (asíncrono, ticket) |
| `send-voided` | SOAP `sendSummary` | Comunicación de baja (asíncrono, ticket) |
| `check-ticket` | SOAP `getStatus` | Consulta ticket de baja |
| `check-summary-ticket` | SOAP `getStatus` | Consulta ticket de resumen |
| `send-despatch` | **REST** `sendCpe` | Guía de remisión (asíncrono, ticket) |
| `check-despatch-ticket` | **REST** `checkStatus` | Consulta ticket de guía (0/98/99) |

### Arquitectura por documento

| Documento | Transporte | Auth | Notas |
|---|---|---|---|
| Factura (01), Nota (07/08) | SOAP `sendBill` | WS-Security (usuario/clave SOL) | CDR inmediato |
| Boleta (03) | SOAP `sendSummary` | WS-Security | Resumen diario RC |
| Baja (RA) | SOAP `sendSummary` | WS-Security | Comunicación de baja |
| Guía Remisión (09) | **REST** | **OAuth2** | `api-cpe.sunat.gob.pe` |

### Módulos (`sunat-billing/sunat/`)

```
auth.ts, client.ts, constants.ts, direct-client.ts, http.ts,
storage.ts, transformers.ts, types.ts, validate.ts
crypto/  certificate.ts · credentials.ts · xml-signer.ts · c14n.ts
gre/     gre-rest-client.ts · token-cache.ts
soap/    soap-client.ts · soap-envelope.ts · soap-parser.ts
utils/   endpoints.ts · zip.ts · number-to-words.ts
xml/     helpers.ts · namespaces.ts · templates/ (invoice, note, summary, voided, despatch)
```

- **`direct-client.ts`**: orquestador — SOAP para CPE, REST para GRE.
- **`transformers.ts`**: DB → documento SUNAT (factura, nota, resumen, baja, guía). El contrato fiscal está pineado por tests Deno (`transformers.test.ts`).
- **`crypto/certificate.ts`**: carga PEMs de Storage (`{orgId}/certificates/private_key.pem`, `certificate.pem`).
- **`crypto/credentials.ts`**: desencripta `clave_sol` (AES-256-GCM con `SUNAT_CREDENTIALS_KEY`).
- **`crypto/xml-signer.ts` + `c14n.ts`**: XMLDSig (SHA-256 + RSA) con C14N simplificado. Los namespaces del root van en **una sola línea** (requisito del digest).
- **`gre/`**: OAuth2 password grant + token cache (refresh 10 min).

### Validaciones (previas al envío)

Estado `issued`, fecha ≤ 7 días, factura con RUC válido (mod-11), boleta bloqueada en `send`, body ≤ 100KB, rate limit 30/min.

## 2. `sunat-credentials` — CRUD de configuración SUNAT

**Versión:** 14

- `action: "get"` → devuelve la config **sin** `clave_sol`, `certificado_password`, `gre_client_id`, `gre_client_secret` (solo `has_clave_sol`, `has_gre_credentials`, etc.).
- `action: "save"` → persiste la config. Exige rol `owner`/`admin`. Encripta `clave_sol`/`certificado_password` con AES-256-GCM (IV de 12 bytes; `base64(iv + ciphertext)`).
- La clave de cifrado se deriva de `SUNAT_CREDENTIALS_KEY` (primeros 32 bytes del string). Si falta el secret, la función **lanza error al cargar** (500 en toda request).

## 3. `apis-peru-proxy` — Proxy RUC/DNI

**Versión:** 9

- `action` con `{ type: "ruc"|"dni", number }` → consulta `dniruc.apisperu.com` usando `APIS_PERU_TOKEN` (secret).
- Valida RUC (11 dígitos) / DNI (8 dígitos). Rate limit en memoria 30/min por IP+usuario.

## Secrets requeridos

Ver `operativa/01-secrets.md`. Los críticos: `SUNAT_CREDENTIALS_KEY` (ambas EFs SUNAT), `APIS_PERU_TOKEN` (apis-peru), `SUPABASE_URL` + `SUPABASE_ANON_KEY` (validación JWT), `SUPABASE_SERVICE_ROLE_KEY` (acceso DB desde las EFs).

## Deploy

```bash
npx supabase functions deploy sunat-billing --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy sunat-credentials --project-ref kdsjojrrspzmufdumywd
npx supabase functions deploy apis-peru-proxy --project-ref kdsjojrrspzmufdumywd
```

Cada función tiene `config.toml` con `verify_jwt = false`.
