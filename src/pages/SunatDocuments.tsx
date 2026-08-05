import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSunatSummaryLogs, useSunatMutations } from "@/hooks/useSunatConfig";
import { useOrgId } from "@/hooks/useOrgId";
import { useSunatAlerts } from "@/hooks/useSunatAlerts";
import { useSunatPendingQueue } from "@/hooks/useSunatPendingQueue";
import { FileText, Send, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, ClipboardList, Trash2, ShieldAlert, FileWarning, SendHorizonal } from "lucide-react";
import type { SunatSummaryLog } from "@/services/sunat.service";

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pendiente", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400", icon: Clock },
  processing: { label: "Procesando", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400", icon: Loader2 },
  accepted: { label: "Aceptado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", icon: XCircle },
};

export default function SunatDocuments() {
  const { logs, isLoading } = useSunatSummaryLogs();
  const { sendSummary, isSendingSummary, sendVoided, isSendingVoided, checkSummaryTicket, isCheckingSummary } = useSunatMutations();
  const orgId = useOrgId();
  const { data: alerts = [] } = useSunatAlerts(orgId);
  const { queue, retry } = useSunatPendingQueue(orgId);

  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split("T")[0]);
  const [voidedInvoiceId, setVoidedInvoiceId] = useState("");
  const [voidedMotivo, setVoidedMotivo] = useState("ERROR EN EMISION");

  const handleCheck = (log: SunatSummaryLog) => {
    if (log.ticket) {
      checkSummaryTicket({ ticket: log.ticket, logId: log.id });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
          <FileText className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Documentos SUNAT</h1>
          <p className="text-sm text-muted-foreground">
            Resúmenes diarios, comunicaciones de baja y seguimiento de tickets
          </p>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-red-200 dark:border-red-900/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-base">Alertas SUNAT</h2>
              <Badge variant="destructive" className="text-[10px] rounded-lg">{alerts.length}</Badge>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-xl ${
                    alert.severity === "critical"
                      ? "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30"
                      : "bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30"
                  }`}
                >
                  {alert.severity === "critical" ? (
                    <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                  <Badge
                    variant={alert.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[10px] rounded-lg flex-shrink-0"
                  >
                    {alert.severity === "critical" ? "Crítica" : "Advertencia"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {queue.data && queue.data.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <SendHorizonal className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-base">Cola de Reenvío</h2>
              <Badge variant="outline" className="text-[10px] rounded-lg">{queue.data.length} pendientes</Badge>
            </div>
            <div className="space-y-2">
              {queue.data.map((doc) => (
                <div
                  key={`${doc.type}-${doc.id}`}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      doc.type === "invoice" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-purple-100 dark:bg-purple-900/30"
                    }`}>
                      {doc.type === "invoice" ? (
                        <FileText className="w-4 h-4 text-orange-600" />
                      ) : (
                        <ClipboardList className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono">
                        {doc.serie}-{String(doc.correlativo).padStart(8, "0")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type === "invoice" ? "Comprobante" : "Guía"} · {doc.issue_date}
                        {doc.sunat_error_code && (
                          <span className="text-red-600 ml-1">({doc.sunat_error_code})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs h-8"
                    onClick={() => retry.mutate(doc)}
                    disabled={retry.isPending}
                  >
                    {retry.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Reenviar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-lg">Resumen Diario</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Envía todas las boletas del día seleccionado en un resumen diario (RC) a SUNAT.
              Las boletas NO se envían individualmente, van en resumen.
            </p>
            <div className="space-y-2">
              <Label>Fecha de referencia</Label>
              <Input
                type="date"
                value={summaryDate}
                onChange={(e) => setSummaryDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl bg-blue-600 hover:bg-blue-700 w-full"
              onClick={() => sendSummary(summaryDate)}
              disabled={isSendingSummary || !summaryDate}
            >
              {isSendingSummary ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSendingSummary ? "Enviando..." : "Enviar Resumen Diario"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-lg">Comunicación de Baja</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Anula un comprobante ya enviado a SUNAT. Genera un documento RA con el motivo de baja.
            </p>
            <div className="space-y-2">
              <Label>ID del Comprobante</Label>
              <Input
                placeholder="UUID del comprobante a anular"
                value={voidedInvoiceId}
                onChange={(e) => setVoidedInvoiceId(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                value={voidedMotivo}
                onChange={(e) => setVoidedMotivo(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              variant="destructive"
              className="rounded-xl w-full"
              onClick={() => sendVoided({ invoiceId: voidedInvoiceId, motivo: voidedMotivo })}
              disabled={isSendingVoided || !voidedInvoiceId}
            >
              {isSendingVoided ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {isSendingVoided ? "Enviando..." : "Enviar Comunicación de Baja"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Historial de Envíos
            </h2>
            <Badge variant="outline">{logs.length} registros</Badge>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay envíos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const st = statusConfig[log.status] || statusConfig.pending;
                return (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${log.tipo === "resumen_diario" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        {log.tipo === "resumen_diario" ? (
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {log.tipo === "resumen_diario" ? "Resumen Diario" : "Comunicación de Baja"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ref: {log.fecha_referencia}
                          {log.ticket && ` · Ticket: ${log.ticket.substring(0, 16)}...`}
                          {" · "}{new Date(log.created_at).toLocaleString("es-PE")}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />{log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>
                        <st.icon className={`w-3 h-3 ${log.status === "processing" ? "animate-spin" : ""}`} />
                        {st.label}
                      </span>
                      {log.ticket && (log.status === "processing" || log.status === "pending") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs h-8"
                          onClick={() => handleCheck(log)}
                          disabled={isCheckingSummary}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingSummary ? "animate-spin" : ""}`} />
                          Consultar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
