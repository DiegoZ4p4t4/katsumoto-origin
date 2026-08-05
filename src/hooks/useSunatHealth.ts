import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface SunatHealthStats {
  totalInvoices: number;
  accepted: number;
  rejected: number;
  pending: number;
  draft: number;
  noXml: number;
  noCdr: number;
  staleOver3Days: number;
  totalDespatches: number;
  despatchesAccepted: number;
  despatchesRejected: number;
  lastSentAt: string | null;
  lastAcceptedAt: string | null;
}

export function useSunatHealth(orgId: string | undefined) {
  return useQuery({
    queryKey: ["sunat-health", orgId],
    queryFn: async (): Promise<SunatHealthStats> => {
      if (!orgId) {
        return {
          totalInvoices: 0, accepted: 0, rejected: 0, pending: 0, draft: 0,
          noXml: 0, noCdr: 0, staleOver3Days: 0,
          totalDespatches: 0, despatchesAccepted: 0, despatchesRejected: 0,
          lastSentAt: null, lastAcceptedAt: null,
        };
      }

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [
        { count: totalInvoices },
        { count: accepted },
        { count: rejectedCount },
        { count: pending },
        { count: draft },
        { count: noXml },
        { count: noCdr },
        { count: staleOver3Days },
        { data: lastSent },
        { data: lastAccepted },
        { count: totalDespatches },
        { count: despatchesAccepted },
        { count: despatchesRejected },
      ] = await Promise.all([
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "accepted"),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "issued").not("sunat_error_code", "is", null),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "issued").is("sunat_error_code", null),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "draft"),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "accepted").is("sunat_xml_path", null),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "accepted").is("sunat_cdr_path", null),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "issued").is("sunat_sent_at", null).lt("issue_date", threeDaysAgo),
        supabase.from("invoices").select("sunat_sent_at").eq("organization_id", orgId).not("sunat_sent_at", "is", null).order("sunat_sent_at", { ascending: false }).limit(1),
        supabase.from("invoices").select("sunat_accepted_at").eq("organization_id", orgId).not("sunat_accepted_at", "is", null).order("sunat_accepted_at", { ascending: false }).limit(1),
        supabase.from("despatches").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("despatches").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "accepted"),
        supabase.from("despatches").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "rejected"),
      ]);

      return {
        totalInvoices: totalInvoices || 0,
        accepted: accepted || 0,
        rejected: rejectedCount || 0,
        pending: pending || 0,
        draft: draft || 0,
        noXml: noXml || 0,
        noCdr: noCdr || 0,
        staleOver3Days: staleOver3Days || 0,
        totalDespatches: totalDespatches || 0,
        despatchesAccepted: despatchesAccepted || 0,
        despatchesRejected: despatchesRejected || 0,
        lastSentAt: lastSent?.[0]?.sunat_sent_at || null,
        lastAcceptedAt: lastAccepted?.[0]?.sunat_accepted_at || null,
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}
