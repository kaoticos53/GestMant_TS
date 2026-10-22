import { Trash2 } from "lucide-react";
import type { TrashRow } from "../types";
import {
  TrashDeleteDialog,
  TrashGroup,
  TrashedIncidentItem,
  TrashedRequestItem,
} from "./trashSection/components";

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
            {trashedIncidentRows.map((row) => (
              <TrashedIncidentItem
                key={row.item.id}
                row={row}
                busyId={trashBusyId}
                onOpen={onOpen}
                onRestore={onRestore}
                onDelete={setTrashDeleting}
              />
            ))}
          </TrashGroup>
        )}

        {trashedRequestRows.length > 0 && (
          <TrashGroup
            title="Peticiones retiradas"
            count={trashedRequestRows.length}
          >
            {trashedRequestRows.map((row) => (
              <TrashedRequestItem
                key={row.item.id}
                row={row}
                busyId={trashBusyId}
                onOpen={onOpen}
                onRestore={onRestore}
                onDelete={setTrashDeleting}
              />
            ))}
          </TrashGroup>
        )}
      </div>

      <TrashDeleteDialog
        deletingRow={trashDeleting}
        busyId={trashBusyId}
        onClose={() => setTrashDeleting(null)}
        onConfirmDelete={onDeleteNow}
      />
    </>
  );
}
