import { formatDateTime } from "@/lib/workshop";

export interface IncidentStatusBannersProps {
  withdrawnAt?: number;
  deletedBy?: string | null;
  deletedReason?: string | null;
  archivedAt?: number;
  withdrawn: boolean;
}

export function IncidentStatusBanners({
  withdrawnAt,
  deletedBy,
  deletedReason,
  archivedAt,
  withdrawn,
}: IncidentStatusBannersProps) {
  return (
    <>
      {withdrawnAt !== undefined && (
        <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-muted-foreground">
          Retirada el {formatDateTime(withdrawnAt)}
          {deletedBy ? ` por ${deletedBy}` : ""}
          {deletedReason ? ` · ${deletedReason}` : ""}.
          Mientras esté en la papelera se consulta en solo lectura; se recupera o
          se borra desde el módulo Archivo.
        </p>
      )}

      {archivedAt !== undefined && !withdrawn && (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          En el archivo desde el {formatDateTime(archivedAt)}: la incidencia se
          consulta en solo lectura y no se trabaja desde la cola. Para volver a
          tramitarla, recupérala desde el módulo Archivo.
        </p>
      )}
    </>
  );
}
