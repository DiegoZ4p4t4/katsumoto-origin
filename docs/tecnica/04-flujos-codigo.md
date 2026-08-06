# 04 — Flujos de código

> Recorrido de los flujos principales por el código. Verificado contra `src/`, `migration-sql/` y las EFs (2026-08-06).

## A. Venta en POS → comprobante → SUNAT

```
POS.tsx
  → usePosInvoice.handleCobrar()          [valida caja abierta, stock, cliente, boleta>S/700]
  → PosPaymentDialog.onConfirm(method, cashReceived)
    → usePosInvoice.handleConfirmPayment()
      → createInvoiceMutation
        → invoiceService.createWithItems()      [src/services/invoice.service.ts]
            → getNextCorrelativo(serie)          → RPC get_next_correlativo
            → calculateInvoice(items)            [src/lib/calculations.ts: extrae IGV]
            → RPC create_invoice_with_items      [transacción: cabecera+ítems+stock+movimiento]
  → success → handlePrintTicket() / handleDownloadPDF()
    → generateThermalTicket() o buildEscposReceipt()  [src/lib/printing/]
```

**Envío a SUNAT (manual o por cierre de caja):**
```
InvoiceTable "SUNAT" / SunatDocuments send-summary / cierre de caja
  → sunatService.sendInvoice(id) | sendSummary(fecha)   [src/services/sunat.service.ts]
    → EF sunat-billing action "send" | "send-summary"
      → transformers.transformInvoiceToSunat()  → XML UBL → firmar → zip → SOAP sendBill/sendSummary
  → check-summary-ticket → propaga aceptación/rechazo a las boletas
```

## B. Tienda online → pedido → fulfillment

```
StoreIndex → CartContext.addItem(product)      [localStorage]
StoreCheckout.handleSubmit()
  → storePublicService.createOrder()            [src/services/store-public.service.ts]
    → RPC create_store_order                    [recalcula precios/IGV en servidor, inserta pedido+ítems]
Orders.tsx (admin) → advanceStatus()
  → orderService.updateStatus() → 'completed'
    → RPC fulfill_store_order                   [crea factura/boleta en almacén + descuenta stock]
```

## C. Nota de Crédito

```
InvoiceTable "NC" → CreateCreditNote.tsx
  → invoiceService.createCreditNote()
    → RPC create_credit_note
        [valida padre accepted/paid; serie FC01/BC01; calcula gravada = line_total − igv;
         total = subtotal; devuelve stock; audita]
  → si el padre es factura: sunatService.sendInvoice(ncId)   (SOAP sendBill)
  → si el padre es boleta: queda para el resumen diario (serie BC)
```

## D. Cajas registradoras

```
CashRegisters.tsx → openRegister()
  → registerService.open()                    [RPC get_next_register_number + insert]
  → registerService.addTransaction(method, amount)   [por cada venta POS, no para credit]
  → registerService.close()                   [arqueo esperado vs contado, diferencia]
    → useRegisterMutations.closeRegister()    [dispara send-summary si is_configured]
```

## E. Inventario

```
Ajuste:  StockAdjustDialog → stockService.adjust() → RPC adjust_stock
Transferencia: Transfers.tsx → stockService.transfer() → RPC transfer_stock (2 movimientos)
Movimientos:  StockMovements.tsx → stockService.getMovements() (kardex)
```

## F. Impresión de ticket térmico

- `usePrinter` (src/hooks/usePrinter.ts) orquesta la impresión:
  - ESC/POS → `buildEscposReceipt()` (para impresora física vía Tauri/plataforma).
  - Browser → `generateThermalTicket()` (PDF 58mm/80mm).
- `getSellerInfo()` (src/lib/printing/seller-info.ts) arma la cabecera desde `organizations` + `sunat_config` (razón social, RUC, dirección, teléfono, email, `ticket_footer`).
- El footer configurable sale de `sunat_config.ticket_footer`.

## G. Seguridad en cada RPC de escritura

Todas las RPC SECURITY DEFINER validan:
1. `p_created_by` pertenece a la org (existe en `profiles` con ese `organization_id`).
2. Sede/producto pertenecen a la org.
3. Stock ≥ cantidad (UPDATE condicional).
4. Correlativo UNIQUE (org, serie, correlativo).
