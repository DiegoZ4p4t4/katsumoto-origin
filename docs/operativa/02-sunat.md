# 02 — Operaciones SUNAT

> Cómo operar el envío de comprobantes a SUNAT día a día. Verificado contra la EF `sunat-billing` y la BD (2026-08-06).

## Estado actual

- **`modo_produccion = false`** → el sistema opera contra el entorno **beta** de SUNAT (comprobantes de prueba).
- Configurado y operativo: certificado PEM firmando OK, `clave_sol` desencriptando OK.
- **Pendiente:** credenciales OAuth2 GRE (ver abajo).

## Qué documento va por qué canal

| Documento | Canal | Síncrono/Asíncrono | Resultado |
|---|---|---|---|
| Factura, Nota Crédito/Débito | SOAP `sendBill` | Síncrono | CDR inmediato → `accepted` |
| Boleta, NC a boleta | Resumen diario `send-summary` | Asíncrono | Ticket → `check-summary-ticket` |
| Comunicación de baja (factura/nota) | `send-voided` | Asíncrono | Ticket |
| Guía de remisión | **REST** GRE | Asíncrono | Ticket (0/98/99) |

## Flujo diario

1. **Ventas POS/manual** → comprobantes quedan `issued` (sin enviar).
2. **Facturas/notas:** botón "SUNAT" en la tabla/detalle → `sendBill` → `accepted` (CDR).
3. **Boletas:** se envían por **resumen diario** (por fecha) desde `/admin/sunat-documents`, o automáticamente al cerrar la caja.
   - Al resolver el ticket: aceptado → boletas `accepted`; rechazado → quedan reenviables.
4. **Cola de reenvío:** `/admin/sunat-documents` lista los pendientes y permite reintentar.

## Reglas que el sistema aplica

- Boleta **no** puede enviarse por `sendBill` (el sistema lo bloquea).
- Factura requiere cliente **RUC** válido (módulo 11).
- Fecha de emisión **≤ 7 días** para enviar.
- Boleta > **S/ 700** debe identificar al cliente (no puede usar "Consumidor Final" 00000000).

## Comunicación de baja (RA)

- Solo aplica a facturas/notas ya aceptadas.
- Se genera desde el detalle de la factura ("Baja").
- Asíncrona: la factura pasa a `cancelled` y el estado se confirma con `check-ticket`.

## Guías de remisión (GRE)

- Estado actual: **bloqueada externamente**. Las credenciales OAuth2 (`gre_client_id`/`gre_client_secret`) actuales son del sistema viejo y SUNAT las rechaza (`access_denied`).
- **Para habilitarla:** generar nuevas credenciales en **SUNAT Menú SOL → Configuración → OAuth2**, guardarlas en `sunat_config` (la UI de Configuración SUNAT no las edita; se cargan por SQL/EF), y probar con la guía T001-1.
- La guía tras enviarse queda `processing`; `check-despatch-ticket` la resuelve (0=aceptada, 98=en proceso, 99=rechazada).

## Pasar a producción

Cuando el negocio esté listo para facturar de verdad:
1. Obtener **certificado digital definitivo** y credenciales SOL reales.
2. En Configuración SUNAT: activar **`modo_produccion = true`**.
3. Enviar un comprobante de prueba y validar el CDR contra `https://cpe.sunat.gob.pe`.
4. Nota: en producción los comprobantes beta no cuentan; hay que emitir de nuevo.

## Verificación rápida

```bash
# Test de conexión (firma XML con el certificado)
# desde la UI: Configuración SUNAT → Probar conexión
# desde la API (requiere JWT de usuario admin):
curl -X POST "$URL/functions/v1/sunat-billing" \
  -H "Authorization: Bearer $TOKEN" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"action":"test"}'
```
