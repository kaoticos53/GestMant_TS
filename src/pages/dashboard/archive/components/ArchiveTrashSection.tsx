import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reporterNoticeText } from "@/lib/incidentMail";
import { trashRemainingLabel } from "@/lib/trash";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  formatDateTime,
} from "@/lib/workshop";
import { ArchiveRestore, Eye, Trash2 } from "lucide-react";
import type { TrashRow } from "../types";

function TrashGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
      </h3>
      <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

function TrashButtons({
  row,
  busyId,
  onOpen,
  onRestore,
  onDelete,
}: {
  row: TrashRow;
  busyId: string | null;
  onOpen: (row: TrashRow) => void;
  onRestore: (row: TrashRow) => Promise<void>;
  onDelete: (row: TrashRow) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busyId === row.item.id}
        onClick={() => onOpen(row)}
      >
        <Eye className="size-4" />
        Ver ficha
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busyId === row.item.id}
        onClick={() => void onRestore(row)}
      >
        <ArchiveRestore className="size-4" />
        Recuperar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 text-destructive hover:text-destructive"
        disabled={busyId === row.item.id}
        onClick={() => onDelete(row)}
      >
        <Trash2 className="size-4" />
        Borrar ya
      </Button>
    </div>
  );
}

export interface ArchiveTrashSectionProps {
  trashedIncidentRows: Extract<TrashRow, { kind: "incident" }>[];
  trashedRequestRows: Extract<TrashRow, { kind: "request" }>[];
  trashRetentionDays: number;
  trashBusyId: string | null;
  trashDeleting: TrashRow | null;
  setTrashDeleting: (row: TrashRow | null) => void;
  onOpen: (row: TrashRow) => void;
  onRestore: (row: TrashRow) => Promise<void>;
  onDeleteNow: () => Promise<void>;
}

export function ArchiveTrashSection({
  trashedIncidentRows,
  trashedRequestRows,
  trashRetentionDays,
  trashBusyId,
  trashDeleting,
  setTrashDeleting,
  onOpen,
  onRestore,
  onDeleteNow,
}: ArchiveTrashSectionProps) {
  const trashCount = trashedIncidentRows.length + trashedRequestRows.length;
  if (trashCount === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-destructive/25 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Trash2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Papelera</p>
            <p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">
              Los avisos equivocados o duplicados y las peticiones pedidas por
              error que se retiraron desde su ficha. Se borran de verdad al
              cumplir {trashRetentionDays}{" "}
              {trashRetentionDays === 1 ? "día" : "días"}; hasta entonces se
              recuperan tal y como están, con su expediente, sus notas y sus
              repuestos asociados.
            </p>
          </div>
        </div>

        {trashedIncidentRows.length > 0 && (
          <TrashGroup
            title="Incidencias retiradas"
            count={trashedIncidentRows.length}
          >
            {trashedIncidentRows.map((row) => {
              const item = row.item;
              const meta =
                INCIDENT_STATUS_META[item.status] ??
                INCIDENT_STATUS_META.reported;
              return (
                <article
                  key={item.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {item.reference}
                      </span>
                      <Badge
                        variant="outline"
                        className={meta.badgeClassName}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                        {trashRemainingLabel(item.purgeAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-5">
                      {[item.equipmentKind, item.model]
                        .filter(Boolean)
                        .join(" ") || "Incidencia sin equipo"}
                    </p>
                    {item.description !== "" && (
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Retirada el {formatDateTime(item.deletedAt)}
                      {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                      {item.deletedReason ? ` · ${item.deletedReason}` : ""}
                      {item.archived
                        ? " · saldrá del archivo al recuperarla"
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aviso a quien notificó: {reporterNoticeText(item)}
                    </p>
                  </div>
                  <TrashButtons
                    row={row}
                    busyId={trashBusyId}
                    onOpen={onOpen}
                    onRestore={onRestore}
                    onDelete={setTrashDeleting}
                  />
                </article>
              );
            })}
          </TrashGroup>
        )}

        {trashedRequestRows.length > 0 && (
          <TrashGroup
            title="Peticiones retiradas"
            count={trashedRequestRows.length}
          >
            {trashedRequestRows.map((row) => {
              const item = row.item;
              const meta = STATUS_META[item.status] ?? STATUS_META.pending;
              const context = [
                item.requesterName,
                item.requesterTeam,
                item.equipment,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <article
                  key={item.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {item.reference}
                      </span>
                      <Badge
                        variant="outline"
                        className={meta.badgeClassName}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                        {trashRemainingLabel(item.purgeAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-5">
                      {item.summary || "Petición sin repuesto"}
                    </p>
                    {context !== "" && (
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {context}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Retirada el {formatDateTime(item.deletedAt)}
                      {item.deletedBy ? ` por ${item.deletedBy}` : ""}
                      {item.deletedReason ? ` · ${item.deletedReason}` : ""}
                      {item.archived
                        ? " · saldrá del archivo al recuperarla"
                        : ""}
                    </p>
                  </div>
                  <TrashButtons
                    row={row}
                    busyId={trashBusyId}
                    onOpen={onOpen}
                    onRestore={onRestore}
                    onDelete={setTrashDeleting}
                  />
                </article>
              );
            })}
          </TrashGroup>
        )}
      </div>

      <AlertDialog
        open={trashDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setTrashDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Borrar {trashDeleting?.item.reference} definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {trashDeleting?.kind === "request"
                ? "Se borra ahora, sin esperar el plazo de la papelera: la petición y los archivos que adjuntaba. Las compras que se pidieron por ella se quedan en su módulo. No se puede recuperar."
                : "Se borra ahora, sin esperar el plazo de la papelera, y con ella su expediente: sus documentos, sus notas y los avisos que la señalaban. No se puede recuperar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trashBusyId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={trashBusyId !== null}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void onDeleteNow();
              }}
            >
              <Trash2 className="size-4" />
              {trashBusyId !== null ? "Borrando..." : "Borrar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
