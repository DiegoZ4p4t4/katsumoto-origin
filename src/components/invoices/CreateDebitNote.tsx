import { useState, useMemo } from "react";
import { formatCents } from "@/lib/format";
import { DEBIT_NOTE_REASONS } from "@/lib/constants/invoices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, TrendingUp } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { invoiceService } from "@/services/invoice.service";
import { sunatService } from "@/services/sunat.service";
import type { Invoice, InvoiceItem, InvoiceItemFormData, Cents } from "@/lib/types";

interface SelectedItem {
  item: InvoiceItem;
  selected: boolean;
  adjustQuantity: number;
  adjustPercent: number;
}

interface CreateDebitNoteProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateDebitNote({ invoice, open, onOpenChange, onSuccess }: CreateDebitNoteProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(() =>
    (invoice.items || []).map((item) => ({
      item,
      selected: false,
      adjustQuantity: item.quantity,
      adjustPercent: 0,
    }))
  );
  const [motivo, setMotivo] = useState("08");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const motivoInfo = DEBIT_NOTE_REASONS[motivo];

  const handleMotivoChange = (code: string) => {
    setMotivo(code);
    const info = DEBIT_NOTE_REASONS[code];
    if (info) setDescripcion(info.description);
  };

  const toggleItem = (index: number) => {
    setSelectedItems((prev) =>
      prev.map((si, i) => (i === index ? { ...si, selected: !si.selected } : si))
    );
  };

  const updatePercent = (index: number, pct: number) => {
    setSelectedItems((prev) =>
      prev.map((si, i) => {
        if (i !== index) return si;
        return { ...si, adjustPercent: Math.max(0, Math.min(1000, pct)) };
      })
    );
  };

  const selectAll = () => {
    const allSelected = selectedItems.every((si) => si.selected);
    setSelectedItems((prev) => prev.map((si) => ({ ...si, selected: !allSelected })));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let igv = 0;
    for (const si of selectedItems) {
      if (!si.selected) continue;
      const ratio = si.adjustPercent / 100;
      const lineIncrease = Math.round(si.item.line_total_cents * ratio);
      const igvIncrease = Math.round(si.item.igv_cents * ratio);
      subtotal += lineIncrease;
      igv += igvIncrease;
    }
    return { subtotal, igv, total: subtotal + igv };
  }, [selectedItems]);

  const ndItems = useMemo(() => {
    const items: InvoiceItemFormData[] = [];
    for (const si of selectedItems) {
      if (!si.selected || si.adjustPercent <= 0) continue;
      const ratio = si.adjustPercent / 100;
      items.push({
        product_id: si.item.product_id || undefined,
        product_name: si.item.product_name,
        product_sku: si.item.product_sku || undefined,
        quantity: si.item.quantity,
        unit_price_cents: Math.round(si.item.unit_price_cents * (1 + ratio)) as Cents,
        discount_percent: si.item.discount_percent,
        tax_affectation: si.item.tax_affectation,
      });
    }
    return items;
  }, [selectedItems]);

  const canSubmit = ndItems.length > 0 && motivo && descripcion.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await invoiceService.createWithItems(
        {
          customer_id: invoice.customer_id,
          invoice_type: "nota_debito",
          issue_date: new Date().toISOString().split("T")[0],
          items: ndItems,
          notes: `[${motivo}] ${descripcion} — Ref: ${invoice.serie}-${String(invoice.correlativo).padStart(6, "0")}`,
        },
        invoice.branch_id,
        null,
        null,
      );

      showSuccess(`Nota de Débito ${result.serie}-${String(result.correlativo).padStart(6, "0")} creada`);

      if (invoice.invoice_type === "factura") {
        setSending(true);
        try {
          const sendResult = await sunatService.sendInvoice(result.id);
          if (sendResult.success) {
            showSuccess("ND enviada y aceptada por SUNAT");
          } else {
            showError(`SUNAT: ${sendResult.error_message || "Error al enviar ND"}`);
          }
        } catch (e) {
          showError(`Error enviando ND a SUNAT: ${(e as Error).message}`);
        } finally {
          setSending(false);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (invoice.invoice_type === "boleta") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nota de Débito no disponible</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Las notas de débito solo aplican a facturas. Para boletas, emite una nueva boleta con el monto adicional.
          </p>
          <div className="flex justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-600" />
            Nota de Débito
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Referencia: <span className="font-mono font-medium">{invoice.serie}-{String(invoice.correlativo).padStart(6, "0")}</span>
            {" · "}
            {invoice.customer?.name}
            {" · "}
            {formatCents(invoice.total_cents)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Motivo SUNAT</Label>
              <select
                value={motivo}
                onChange={(e) => handleMotivoChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Object.entries(DEBIT_NOTE_REASONS).map(([code, info]) => (
                  <option key={code} value={code}>
                    [{code}] {info.label}
                  </option>
                ))}
              </select>
              {motivoInfo && (
                <p className="text-xs text-muted-foreground">{motivoInfo.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descripción del motivo</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items a incrementar (% de ajuste)</Label>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                {selectedItems.every((si) => si.selected) ? "Deseleccionar todos" : "Seleccionar todos"}
              </Button>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2 px-3 w-10"></th>
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Producto</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Precio Original</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground w-20">% Ajuste</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Incremento</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((si, i) => (
                    <tr key={si.item.id} className={`border-b last:border-0 ${si.selected ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="py-2 px-3">
                        <Checkbox checked={si.selected} onCheckedChange={() => toggleItem(i)} />
                      </td>
                      <td className="py-2 px-3">
                        <p>{si.item.product_name}</p>
                        {si.item.product_sku && (
                          <p className="text-xs text-muted-foreground">{si.item.product_sku}</p>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">{formatCents(si.item.unit_price_cents)}</td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={si.adjustPercent}
                          onChange={(e) => updatePercent(i, parseInt(e.target.value) || 0)}
                          disabled={!si.selected}
                          className="h-8 w-16 text-right ml-auto"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-red-600">
                        {si.selected && si.adjustPercent > 0
                          ? `+${formatCents(Math.round(si.item.line_total_cents * (si.adjustPercent / 100)))}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {ndItems.length} ítem{ndItems.length !== 1 ? "s" : ""} con incremento
              </p>
              {totals.igv > 0 && (
                <p className="text-xs text-muted-foreground">
                  Base: {formatCents(totals.subtotal)} + IGV: {formatCents(totals.igv)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total ND</p>
              <p className="text-2xl font-bold text-red-600">{formatCents(totals.total)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {sending ? "Enviando a SUNAT..." : "Creando ND..."}
                </>
              ) : (
                "Emitir Nota de Débito"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
