import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import {
  SECURITY_ACTION_OPTIONS,
  formatSecurityMetadata,
  securityActionLabel,
  securityAuditCsvTable,
  type SecurityAuditEntry,
} from "@/lib/securityAudit";
import { formatDateTime } from "@/lib/workshop";

const PAGE_SIZE = 25;

/**
 * Visor de la tabla inmutable `securityAuditLog` para administradores, con
 * paginación por cursor, filtro por tipo de evento y exportación CSV segura.
 */
export function SecurityAuditPanel() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.audit.securityAuditLogs,
    actionFilter === "all" ? {} : { action: actionFilter },
    { initialNumItems: PAGE_SIZE },
  );

  const entries = results as SecurityAuditEntry[];

  const handleExport = () => {
    if (entries.length === 0) {
      toast.info("No hay trazas de seguridad cargadas para exportar.");
      return;
    }
    const { header, rows } = securityAuditCsvTable(entries);
    downloadCsv(csvFilename("auditoria-seguridad"), toCsv(header, rows));
    toast.success(`Exportadas ${entries.length} trazas de seguridad.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <CardTitle className="text-lg">Auditoría de seguridad</CardTitle>
              <CardDescription>
                Registro inmutable de cambios de roles, sesiones, configuración
                de correo, purgas manuales, vaciados y alertas anti-abuso.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[220px]" aria-label="Filtrar evento">
                <SelectValue placeholder="Todos los eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                {SECURITY_ACTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={entries.length === 0}
            >
              <Download className="size-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {status === "LoadingFirstPage" ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando trazas de seguridad…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay eventos de seguridad registrados para el filtro actual.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="divide-y divide-border/70 rounded-lg border border-border/70">
                {entries.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex flex-col gap-1.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-medium">
                          {securityActionLabel(entry.action)}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.target}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatSecurityMetadata(entry.metadata)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-start text-xs text-muted-foreground sm:items-end">
                      <span className="font-medium text-foreground">
                        {entry.actorEmail ?? entry.actorId ?? "Sistema / Público"}
                      </span>
                      <span>{formatDateTime(entry.at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {status === "CanLoadMore" && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadMore(PAGE_SIZE)}
                    disabled={isLoading}
                  >
                    Cargar más eventos
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

