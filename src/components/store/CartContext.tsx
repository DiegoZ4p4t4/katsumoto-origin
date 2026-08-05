import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import type { Product, Cents } from "@/lib/types";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, maxStock?: number) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number, maxStock?: number) => void;
  clearCart: () => void;
  syncProducts: (products: Product[]) => void;
  totalItems: number;
  totalCents: Cents;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "katsumoto_store_cart";

interface StoredItem { productId: string; quantity: number; }

function loadStoredCart(): StoredItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i: unknown): i is StoredItem =>
      typeof i === "object" && i !== null && "productId" in i && "quantity" in i
    );
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  const stored: StoredItem[] = items.map(i => ({
    productId: i.product.id,
    quantity: i.quantity,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = loadStoredCart();
    if (stored.length > 0) {
      setItems(stored.map(s => ({
        product: { id: s.productId } as Product,
        quantity: s.quantity,
      })));
    }
  }, []);

  const addItem = useCallback((product: Product, maxStock?: number): boolean => {
    const effectiveMax = maxStock ?? Infinity;
    if (effectiveMax <= 0) return false;

    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      let next: CartItem[];
      if (existing) {
        if (existing.quantity >= effectiveMax) return prev;
        next = prev.map(i =>
          i.product.id === product.id ? { product, quantity: i.quantity + 1 } : i
        );
      } else {
        next = [...prev, { product, quantity: 1 }];
      }
      saveCart(next);
      return next;
    });
    return true;
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => { const next = prev.filter(i => i.product.id !== productId); saveCart(next); return next; });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, maxStock?: number) => {
    setItems(prev => {
      let next: CartItem[];
      if (quantity <= 0) {
        next = prev.filter(i => i.product.id !== productId);
      } else {
        const clamped = Math.min(quantity, maxStock ?? Infinity);
        next = prev.map(i =>
          i.product.id === productId ? { ...i, quantity: clamped } : i
        );
      }
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const syncProducts = useCallback((products: Product[]) => {
    setItems(prev => {
      const productMap = new Map(products.map(p => [p.id, p]));
      let changed = false;
      const next = prev.map(item => {
        const real = productMap.get(item.product.id);
        if (real && (!item.product.name || item.product.price_cents === undefined)) {
          changed = true;
          return { ...item, product: real };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price_cents * i.quantity, 0 as Cents),
    [items]
  );

  const contextValue = useMemo(() => ({
    items, addItem, removeItem, updateQuantity, clearCart, syncProducts, totalItems, totalCents
  }), [items, addItem, removeItem, updateQuantity, clearCart, syncProducts, totalItems, totalCents]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
