import { useState, useCallback } from "react";
import { useProducts } from "@/hooks/useProducts";
import { ProductImage } from "@/components/ProductImage";
import { formatCents } from "@/lib/format";
import { downloadLabels, printLabels } from "@/lib/printing/labels/generate-labels";
import { getSellerInfo, type SellerInfo } from "@/lib/printing/seller-info";
import { showSuccess } from "@/utils/toast";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Printer,
  Download,
  CheckSquare,
  Square,
  Loader2,
  Search,
  Barcode,
} from "lucide-react";

interface PrintLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  preselectedIds?: string[];
}

export function PrintLabelsDialog({ open, onClose, preselectedIds }: PrintLabelsDialogProps) {
  const { products } = useProducts();
  const [selected, setSelected] = useState<Set<string>>(new Set(preselectedIds || []));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"download" | "print">("download");

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someFilteredSelected = filtered.some((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.delete(p.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of filtered) {
          if (p.barcode && p.barcode.length >= 13) next.add(p.id);
        }
        return next;
      });
    }
  };

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const handleGenerate = useCallback(async () => {
    if (selectedProducts.length === 0) return;
    setLoading(true);
    try {
      const sellerInfo = (await getSellerInfo()) as unknown as SellerInfo;
      const opts = { sellerInfo, products: selectedProducts };
      if (mode === "download") {
        downloadLabels(opts);
      } else {
        printLabels(opts);
      }
      showSuccess(
        `${selectedProducts.length} etiqueta${selectedProducts.length !== 1 ? "s" : ""} generada${selectedProducts.length !== 1 ? "s" : ""}`
      );
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [selectedProducts, mode]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-orange-600" />
            <DialogTitle>Imprimir Etiquetas</DialogTitle>
          </div>
          <DialogDescription>
            Selecciona los productos para generar etiquetas con código de barras
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-9 text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-2 flex items-center justify-between">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allFilteredSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-orange-500" />
            ) : someFilteredSelected ? (
              <Square className="w-3.5 h-3.5 text-orange-400/60" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {allFilteredSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
          <Badge variant="secondary" className="rounded-lg text-[10px]">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </Badge>
        </div>

        <ScrollArea className="h-[320px] px-6">
          <div className="space-y-1 pb-2">
            {filtered.map((product) => {
              const isChecked = selected.has(product.id);
              const hasBarcode = product.barcode && product.barcode.length >= 13;
              return (
                <button
                  key={product.id}
                  onClick={() => hasBarcode && toggleProduct(product.id)}
                  disabled={!hasBarcode}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left ${
                    !hasBarcode
                      ? "opacity-40 cursor-not-allowed"
                      : isChecked
                      ? "bg-orange-50 dark:bg-orange-900/20"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-lg overflow-hidden border flex-shrink-0">
                    <ProductImage
                      src={product.image_url}
                      name={product.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {product.sku}
                      {hasBarcode ? ` · ${product.barcode}` : " · Sin código EAN-13"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatCents(product.price_cents)}</p>
                    <p className="text-[10px] text-muted-foreground">{product.unit}</p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No se encontraron productos</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t bg-muted/20 flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <Switch
              id="label-print-mode"
              checked={mode === "print"}
              onCheckedChange={(v) => setMode(v ? "print" : "download")}
            />
            <Label htmlFor="label-print-mode" className="text-[11px] cursor-pointer">
              Impresión directa
            </Label>
          </div>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-xl h-9 bg-orange-600 hover:bg-orange-700"
            onClick={handleGenerate}
            disabled={selected.size === 0 || loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : mode === "download" ? (
              <Download className="w-4 h-4 mr-1.5" />
            ) : (
              <Printer className="w-4 h-4 mr-1.5" />
            )}
            {selected.size > 0
              ? `Generar ${selected.size} etiqueta${selected.size !== 1 ? "s" : ""}`
              : "Generar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
