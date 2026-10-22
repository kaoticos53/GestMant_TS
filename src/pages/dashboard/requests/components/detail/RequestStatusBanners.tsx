import { formatDateTime } from "@/lib/workshop";
import type { RequestStatusBannersProps } from "./types";

export function RequestStatusBanners({
  withdrawnAt,
  deletedBy,
  deletedReason,
  archivedAt,
}: RequestStatusBannersProps) {
  const isWithdrawn = withdrawnAt !== undefined;
  const isArchived = archivedAt !== undefined && !isWithdrawn;

  return (
    <>
      {isWithdrawn && (
        <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-muted-foreground">
          Retirada el {formatDateTime(withdrawnAt)}
          {deletedBy ? ` por ${deletedBy}` : ""}
          {deletedReason ? ` · ${deletedReason}` : ""}. Mientras esté en la
          papelera se consulta en solo lectura; se recupera o se borra desde el
          módulo Archivo.
        </p>
      )}

      {isArchived && (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          En el archivo desde el {formatDateTime(archivedAt)}: la petición se
          consulta en solo lectura y no se trabaja desde la cola. Para volver a
          tramitarla, recupérala desde el módulo Archivo.
        </p>
      )}
    </>
  );
}
