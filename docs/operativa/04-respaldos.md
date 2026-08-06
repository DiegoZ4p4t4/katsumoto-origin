# 04 — Respaldos y continuidad

> Qué hay que respaldar y cómo. Verificado contra el proyecto (2026-08-06).

## Qué respaldar

| Recurso | Dónde | Cómo |
|---|---|---|
| Base de datos | Supabase (PostgreSQL) | Backups automáticos de la plataforma (Dashboard → Database → Backups) + exportación manual periódica |
| Certificado digital (PEMs) | Storage `sunat-documents/{orgId}/certificates/` | Descargar copia fuera de Supabase |
| `SUNAT_CREDENTIALS_KEY` | Secrets del proyecto | **Gestor de contraseñas del administrador** (crítico — si se pierde, reingresar clave_sol) |
| `APIS_PERU_TOKEN` | Secrets | Gestor de contraseñas |
| Credenciales SOL + certificado | `sunat_config` (encriptado) | Copia en el gestor de contraseñas de la empresa |
| `.env` | Local (gitignored) | Copia segura (contiene VITE_* + DATABASE_URL local) |
| Código | Git local | El repo vive en la máquina de desarrollo; considerar push a un remoto privado |

## El proyecto es compartido con otra app

El proyecto Supabase (`kdsjojrrspzmufdumywd`) **también** aloja una segunda aplicación ("servicios técnicos") que usa las tablas `katsumoto_usuarios`, `servicios`, `piezas`, `actualizaciones` y el rol vía `current_user_role()`.

**Reglas operativas:**
- No renombrar/borrar esas tablas ni la función `current_user_role()` — la otra app depende de ellas.
- Las políticas de Katsumoto usan `profiles.role` / `is_owner_or_admin()`; no tocar las de la otra app.
- Al hacer cambios de esquema, verificar que no colisionen (nombres, constraints).

## Recuperación de incidentes conocidos

1. **EF devuelve 500** → revisar secrets (típicamente `SUNAT_CREDENTIALS_KEY` faltante). Ver `despliegue/03`.
2. **Se pierde `SUNAT_CREDENTIALS_KEY`** → generar nueva + reingresar `clave_sol` en Configuración SUNAT.
3. **Se corrompe la BD** → restaurar backup de Supabase (pérdida de hasta el último backup).
4. **Fallan los envíos a SUNAT** → verificar `modo_produccion`, credenciales y fechas (`operativa/02`).

## Recomendaciones

- Guardar `SUNAT_CREDENTIALS_KEY` y las credenciales SOL en el mismo gestor.
- Programar exportaciones de la BD (pg_dump) con periodicidad.
- Mantener una copia del certificado PEM fuera de Supabase.
- Considerar push del repo a GitHub (remoto privado) para no depender solo de la máquina local.
