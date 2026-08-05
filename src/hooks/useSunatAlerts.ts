import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface SunatAlert {
  id: string;
  type: "no_cdr" | "rejected" | "stale" | "cert_expiring";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  entityType: "invoice" | "despatch";
  entityId: string;
  entityLabel: string;
}

export function useSunatAlerts(orgId: string | undefined) {
  return useQuery({
    queryKey: ["sunat-alerts", orgId],
    queryFn: async (): Promise<SunatAlert[]> => {
      if (!orgId) return [];
      const alerts: SunatAlert[] = [];
      const now = new Date();
      const dayMs = 1000 * 60 * 60 * 24;

      const [
        { data: noCdrInvoices },
        { data: rejected },
        { data: stale },
        { data: despatchRejected },
        { data: certFailures },
        { data: cfg },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, serie, correlativo, invoice_type, sunat_sent_at, sunat_cdr_path, status")
          .eq("organization_id", orgId)
          .eq("status", "accepted")
          .is("sunat_cdr_path", null)
          .not("sunat_sent_at", "is", null),
        supabase
          .from("invoices")
          .select("id, serie, correlativo, invoice_type, sunat_error_code, sunat_error_message")
          .eq("organization_id", orgId)
          .eq("status", "issued")
          .not("sunat_error_code", "is", null),
        supabase
          .from("invoices")
          .select("id, serie, correlativo, issue_date, invoice_type")
          .eq("organization_id", orgId)
          .eq("status", "issued")
          .is("sunat_sent_at", null)
          .lt("issue_date", new Date(now.getTime() - 3 * dayMs).toISOString().split("T")[0]),
        supabase
          .from("despatches")
          .select("id, serie, correlativo, sunat_error_code, sunat_error_message")
          .eq("organization_id", orgId)
          .eq("status", "rejected"),
        supabase
          .from("invoices")
          .select("id, serie, correlativo, sunat_error_code, sunat_error_message, sunat_sent_at")
          .eq("organization_id", orgId)
          .not("sunat_error_code", "is", null)
          .order("sunat_sent_at", { ascending: false })
          .limit(10),
        supabase
          .from("sunat_config")
          .select("certificado_path, updated_at, is_configured")
          .eq("organization_id", orgId)
          .maybeSingle(),
      ]);

      for (const inv of noCdrInvoices || []) {
        const sentAt = new Date(inv.sunat_sent_at);
        const hoursSince = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
        alerts.push({
          id: `no-cdr-${inv.id}`,
          type: "no_cdr",
          severity: hoursSince > 24 ? "critical" : "warning",
          title: "Comprobante sin CDR",
          description: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")} aceptado hace ${Math.round(hoursSince)}h sin CDR`,
          entityType: "invoice",
          entityId: inv.id,
          entityLabel: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}`,
        });
      }

      for (const inv of rejected || []) {
        alerts.push({
          id: `rejected-${inv.id}`,
          type: "rejected",
          severity: "critical",
          title: "Comprobante rechazado",
          description: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}: ${inv.sunat_error_message || inv.sunat_error_code}`,
          entityType: "invoice",
          entityId: inv.id,
          entityLabel: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}`,
        });
      }

      for (const inv of stale || []) {
        alerts.push({
          id: `stale-${inv.id}`,
          type: "stale",
          severity: "warning",
          title: "Comprobante sin enviar (>3 días)",
          description: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")} emitido ${inv.issue_date} sin enviar a SUNAT`,
          entityType: "invoice",
          entityId: inv.id,
          entityLabel: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}`,
        });
      }

      for (const d of despatchRejected || []) {
        alerts.push({
          id: `despatch-rejected-${d.id}`,
          type: "rejected",
          severity: "critical",
          title: "Guía rechazada",
          description: `${d.serie}-${String(d.correlativo).padStart(8, "0")}: ${d.sunat_error_message || d.sunat_error_code}`,
          entityType: "despatch",
          entityId: d.id,
          entityLabel: `${d.serie}-${String(d.correlativo).padStart(8, "0")}`,
        });
      }

      const certErrorCodes = ["2073", "2074", "2076"];
      for (const inv of certFailures || []) {
        const code = String(inv.sunat_error_code || "");
        if (certErrorCodes.some((c) => code.includes(c))) {
          const label = code.includes("2074")
            ? "Certificado digital expirado"
            : code.includes("2076")
            ? "RUC no coincide con certificado"
            : "Clave de certificado incorrecta";
          alerts.push({
            id: `cert-${inv.id}`,
            type: "cert_expiring",
            severity: "critical",
            title: `Error de certificado: ${label}`,
            description: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}: ${inv.sunat_error_message || inv.sunat_error_code}`,
            entityType: "invoice",
            entityId: inv.id,
            entityLabel: `${inv.serie}-${String(inv.correlativo).padStart(8, "0")}`,
          });
        }
      }

      if (cfg?.is_configured && cfg?.certificado_path && cfg?.updated_at) {
        const configAgeMonths = (now.getTime() - new Date(cfg.updated_at).getTime()) / (dayMs * 30);
        const { count: recentOk } = await supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "accepted")
          .gte("sunat_accepted_at", new Date(now.getTime() - 30 * dayMs).toISOString());
        if (configAgeMonths > 9 && (recentOk || 0) > 0) {
          alerts.push({
            id: "cert-near-expiry",
            type: "cert_expiring",
            severity: "warning",
            title: "Certificado digital próximo a vencer",
            description: `Configuración tiene ${Math.round(configAgeMonths)} meses. Renueve el certificado antes de que expire.`,
            entityType: "invoice",
            entityId: cfg.certificado_path,
            entityLabel: "Certificado digital",
          });
        }
      }

      return alerts.sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        return sev[a.severity] - sev[b.severity];
      });
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}
