import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Product, BranchStock, Branch } from "@/lib/types";
import { getBranchStock } from "@/lib/utils/stock";

interface ProductSearchComboboxProps {
  products: Product[];
  branchStocks: BranchStock[];
  branches: Branch[];
  branchId: string;
  value: string;
  onValueChange: (productId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductSearchCombobox({
  products,
  branchStocks,
  branches,
  branchId,
  value,
  onValueChange,
  placeholder = "Buscar producto...",
  disabled = false,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);

  const available = useMemo(() => {
    if (!branchId) return [];
    return products.filter(
      (p) => p.is_active && getBranchStock(branchStocks, branchId, p.id, branches) > 0
    );
  }, [products, branchStocks, branchId, branches]);

  const selected = available.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !branchId}
          className="w-full justify-between rounded-xl font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Package className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selected.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                (Stock: {getBranchStock(branchStocks, branchId, selected.id, branches)})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{branchId ? placeholder : "Selecciona sede origen primero"}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nombre o SKU..." />
          <CommandList>
            <CommandEmpty>No se encontraron productos.</CommandEmpty>
            <CommandGroup>
              {available.map((p) => {
                const stock = getBranchStock(branchStocks, branchId, p.id, branches);
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.sku}`}
                    onSelect={() => {
                      onValueChange(p.id === value ? "" : p.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === p.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {p.sku} · Stock: <span className="font-semibold">{stock}</span>
                      </p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
