import type { Product, Branch } from "@/lib/types";
import { Warehouse, Copy } from "lucide-react";

interface BranchStockInfo {
  branch: Branch;
  stock: number;
  minStock: number;
  maxStock: number;
  isMirror: boolean;
  sourceBranchName: string;
}

interface ProductStockTabProps {
  product: Product;
  branchStocks: BranchStockInfo[];
  activeBranches: Branch[];
}

export function ProductStockTab({ product, branchStocks, activeBranches }: ProductStockTabProps) {
  return (
    <div className="p-6 mt-0 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Distribución en {activeBranches.length} sede{activeBranches.length !== 1 ? "s" : ""}
        </p>
        <p className="text-sm font-bold">Total: <span className="text-emerald-600 dark:text-emerald-400">{product.stock}</span> {product.unit}</p>
      </div>
      <div className="space-y-3">
        {branchStocks.map(({ branch, stock, minStock, maxStock, isMirror, sourceBranchName }) => {
          const effectiveMax = maxStock > 0 ? maxStock : stock;
          const percent = effectiveMax > 0 ? Math.min(100, (stock / effectiveMax) * 100) : 0;
          const isBranchOut = stock === 0;
          const isBranchLow = stock > 0 && stock <= minStock;
          const barColor = isMirror ? "bg-blue-400" : isBranchOut ? "bg-red-400" : isBranchLow ? "bg-amber-400" : "bg-emerald-400";
          return (
            <div key={branch.id} className={`p-4 bg-muted/30 rounded-xl border ${isMirror ? "border-blue-200 dark:border-blue-800" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMirror ? "bg-blue-50 dark:bg-blue-900/30" : "bg-emerald-50 dark:bg-emerald-900/30"}`}>
                    {isMirror
                      ? <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      : <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{branch.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {isMirror ? `Espejo de ${sourceBranchName}` : branch.code}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${isMirror ? "text-blue-600 dark:text-blue-400" : isBranchOut ? "text-red-600 dark:text-red-400" : isBranchLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    {stock}
                  </p>
                  {!isMirror && maxStock > 0 && (
                    <p className="text-[10px] text-muted-foreground">de {maxStock} {product.unit}</p>
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                {!isMirror ? (
                  <>
                    <span>Mín: {minStock} · Máx: {maxStock > 0 ? maxStock : "—"}</span>
                    {isBranchOut && <span className="text-red-500 dark:text-red-400 font-medium">Agotado</span>}
                    {isBranchLow && !isBranchOut && <span className="text-amber-500 dark:text-amber-400 font-medium">Stock bajo</span>}
                  </>
                ) : (
                  <span>Stock sincronizado de {sourceBranchName}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
