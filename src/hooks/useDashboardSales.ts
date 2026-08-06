import { useMemo } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice } from "@/lib/types";

interface DailySales {
  date: string;
  total: number;
  count: number;
}

export interface DashboardSales {
  todaySales: number;
  todayCount: number;
  monthSales: number;
  monthCount: number;
  trend: DailySales[];
}

export function getDateKey(dateStr: string): string {
  return dateStr.split("T")[0];
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeDashboardSales(invoices: Invoice[], now: Date = new Date()): DashboardSales {
  const todayKey = formatLocalDate(now);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const validInvoices = invoices.filter(
    (inv) => inv.status !== "draft" && inv.status !== "cancelled"
  );

  let todaySales = 0;
  let todayCount = 0;
  let monthSales = 0;
  let monthCount = 0;

  const last7Days: Map<string, DailySales> = new Map();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = formatLocalDate(d);
    last7Days.set(key, { date: key, total: 0, count: 0 });
  }

  for (const inv of validInvoices) {
    const dateKey = getDateKey(inv.issue_date);
    const sign = inv.invoice_type === "nota_credito" ? -1 : 1;
    const isSale = inv.invoice_type !== "nota_credito";

    if (dateKey === todayKey) {
      todaySales += sign * inv.total_cents;
      if (isSale) todayCount++;
    }

    if (dateKey >= monthStart) {
      monthSales += sign * inv.total_cents;
      if (isSale) monthCount++;
    }

    const dayEntry = last7Days.get(dateKey);
    if (dayEntry) {
      dayEntry.total += sign * inv.total_cents;
      if (isSale) dayEntry.count++;
    }
  }

  return {
    todaySales,
    todayCount,
    monthSales,
    monthCount,
    trend: Array.from(last7Days.values()),
  };
}

export function useDashboardSales(): DashboardSales {
  const { branchInvoices } = useInvoices();

  return useMemo(() => computeDashboardSales(branchInvoices), [branchInvoices]);
}
