import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, FileText } from "lucide-react";
import type { Invoice } from "@/lib/types";
import type { SellerInfo } from "@/lib/printing/seller-info";
import type { PrintOptions } from "@/lib/printing/types";

interface InvoicePreviewDialogProps {
  invoice: Invoice | null;
  sellerInfo: SellerInfo | null;
  printOptions?: PrintOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoicePreviewDialog({
  invoice,
  sellerInfo,
  printOptions,
  open,
  onOpenChange,
}: InvoicePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !invoice || !sellerInfo) {
      if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
      return;
    }
    let cancelled = false;
    setLoading(true);
    import("@/lib/printing/generate").then(({ generateInvoice }) => {
      if (cancelled) return;
      const opts: PrintOptions = { ...printOptions, action: "preview" };
      return generateInvoice(invoice, sellerInfo, opts);
    }).then((doc) => {
      if (cancelled || !doc) return;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(() => {
      if (!cancelled) setBlobUrl(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, invoice, sellerInfo, printOptions]);

  const handleDownload = useCallback(async () => {
    if (!invoice || !sellerInfo) return;
    const { generateInvoice } = await import("@/lib/printing/generate");
    await generateInvoice(invoice, sellerInfo, { ...printOptions, action: "download" });
  }, [invoice, sellerInfo, printOptions]);

  const handlePrint = useCallback(async () => {
    if (!invoice || !sellerInfo) return;
    const { generateInvoice } = await import("@/lib/printing/generate");
    const doc = await generateInvoice(invoice, sellerInfo, { ...printOptions, action: "preview" });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }, [invoice, sellerInfo, printOptions]);

  const handleTicket = useCallback(async () => {
    if (!invoice || !sellerInfo) return;
    const { generateThermalTicket } = await import("@/lib/printing/formats/thermal-ticket");
    const doc = await generateThermalTicket(invoice, sellerInfo, {
      format: "thermal-58mm",
      branchName: printOptions?.branchName,
      taxConfig: printOptions?.taxConfig,
      action: "print",
    });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }, [invoice, sellerInfo, printOptions]);

  if (!invoice || !open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg">
              Vista Previa — {invoice.number}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleTicket}>
                <FileText className="w-4 h-4" />Ticket
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handlePrint}>
                <Printer className="w-4 h-4" />Imprimir
              </Button>
              <Button size="sm" className="rounded-xl gap-1.5 bg-orange-600 hover:bg-orange-700 text-white" onClick={handleDownload}>
                <Download className="w-4 h-4" />Descargar
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="w-full h-[70vh] border rounded-xl overflow-hidden bg-muted/30">
          {blobUrl ? (
            <iframe src={blobUrl} className="w-full h-full border-0" title={`PDF ${invoice.number}`} />
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Generando vista previa...
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No se pudo generar la vista previa
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
