import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import type { Branch, BranchStock } from "@/lib/types";

export const storePublicService = {
  async getBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data;
  },

  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data.map((p: Record<string, unknown>) => ({ ...p, stock: (p as Record<string, unknown>).stock ?? 0 } as Product));
  },

  async getBranchStock(): Promise<BranchStock[]> {
    const { data, error } = await supabase
      .from("branch_stock")
      .select("*");
    if (error) throw error;
    return data || [];
  },

  async getOrgIdFromBranch(branchId: string): Promise<string | null> {
    const { data } = await supabase
      .from("branches")
      .select("organization_id")
      .eq("id", branchId)
      .eq("is_active", true)
      .single();
    return data?.organization_id ?? null;
  },

  async createOrder(data: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    customerDocumentType: string;
    customerDocumentNumber: string;
    branchId: string;
    shippingAddress?: string;
    shippingDepartmentCode?: string;
    shippingProvinceCode?: string;
    shippingDistrictCode?: string;
    subtotalCents: number;
    gravadaCents: number;
    exoneradaCents: number;
    inafectaCents: number;
    igvCents: number;
    totalCents: number;
    notes?: string;
    items: Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
      taxAffectation: string;
      igvCents: number;
    }>;
  }): Promise<string> {
    const orgId = await storePublicService.getOrgIdFromBranch(data.branchId);
    if (!orgId) throw new Error("No se pudo determinar la organización para el pedido");

    const productIds = data.items.map((item) => item.productId).filter(Boolean);
    if (productIds.length > 0 && data.branchId) {
      const { data: branchStocks } = await supabase
        .from("branch_stock")
        .select("product_id, stock")
        .eq("branch_id", data.branchId)
        .in("product_id", productIds);
      const stockMap = new Map((branchStocks || []).map((s: { product_id: string; stock: number }) => [s.product_id, s.stock]));
      const insufficient: string[] = [];
      for (const item of data.items) {
        const available = stockMap.get(item.productId) ?? 0;
        if (item.quantity > available) {
          insufficient.push(`${item.productName}: solicitado ${item.quantity}, disponible ${available}`);
        }
      }
      if (insufficient.length > 0) {
        throw new Error(`Stock insuficiente para los siguientes productos:\n${insufficient.join("\n")}`);
      }
    }

    const { data: orderId, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        organization_id: orgId,
        order_number: data.orderNumber,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_email: data.customerEmail,
        customer_document_type: data.customerDocumentType,
        customer_document_number: data.customerDocumentNumber,
        branch_id: data.branchId,
        shipping_address: data.shippingAddress || null,
        shipping_department_code: data.shippingDepartmentCode || "",
        shipping_province_code: data.shippingProvinceCode || "",
        shipping_district_code: data.shippingDistrictCode || "",
        subtotal_cents: data.subtotalCents,
        gravada_cents: data.gravadaCents,
        exonerada_cents: data.exoneradaCents,
        inafecta_cents: data.inafectaCents,
        igv_cents: data.igvCents,
        total_cents: data.totalCents,
        notes: data.notes || null,
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    if (data.items.length > 0) {
      const orderItems = data.items.map((item) => ({
        order_id: orderId.id,
        product_id: item.productId,
        product_name: item.productName,
        product_sku: item.productSku,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.lineTotalCents,
        tax_affectation: item.taxAffectation,
        igv_cents: item.igvCents,
      }));
      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);
      if (itemsError) throw itemsError;
    }

    return orderId.id;
  },
};
