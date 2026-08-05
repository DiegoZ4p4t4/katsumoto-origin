import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sunatService } from "@/services/sunat.service";

export interface PendingDocument {
  id: string;
  type: "invoice" | "despatch";
  serie: string;
  correlativo: number;
  issue_date: string;
  status: string;
  sunat_error_code: string | null;
  sunat_sent_at: string | null;
}

export function useSunatPendingQueue(orgId: string | undefined) {
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ["sunat-pending", orgId],
    queryFn: async (): Promise<PendingDocument[]> => {
      if (!orgId) return [];

      const { data: pendingInvoices } = await supabase
        .from("invoices")
        .select("id, serie, correlativo, issue_date, status, sunat_error_code, sunat_sent_at, invoice_type")
        .eq("organization_id", orgId)
        .eq("status", "issued")
        .or("sunat_sent_at.is.null,sunat_error_code.not.is.null");

      const { data: pendingDespatches } = await supabase
        .from("despatches")
        .select("id, serie, correlativo, issue_date, status, sunat_error_code, sunat_sent_at")
        .eq("organization_id", orgId)
        .in("status", ["issued", "processing"])
        .is("sunat_sent_at", null);

      const invoices: PendingDocument[] = (pendingInvoices || []).map((inv) => ({
        id: inv.id,
        type: "invoice" as const,
        serie: inv.serie,
        correlativo: inv.correlativo,
        issue_date: inv.issue_date,
        status: inv.status,
        sunat_error_code: inv.sunat_error_code,
        sunat_sent_at: inv.sunat_sent_at,
      }));

      const despatches: PendingDocument[] = (pendingDespatches || []).map((d) => ({
        id: d.id,
        type: "despatch" as const,
        serie: d.serie,
        correlativo: d.correlativo,
        issue_date: d.issue_date,
        status: d.status,
        sunat_error_code: d.sunat_error_code,
        sunat_sent_at: d.sunat_sent_at,
      }));

      return [...invoices, ...despatches];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
  });

  const retry = useMutation({
    mutationFn: async (doc: PendingDocument) => {
      if (doc.type === "invoice") {
        return sunatService.sendInvoice(doc.id);
      }
      return sunatService.sendDespatch(doc.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sunat-pending", orgId] });
      queryClient.invalidateQueries({ queryKey: ["sunat-alerts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["sunat-health", orgId] });
    },
  });

  return { queue, retry };
}
