import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/workshop";
import { Archive, CalendarClock, SlidersHorizontal } from "lucide-react";
import { CUTOFF_OPTIONS } from "../types";

export interface BulkArchiveCardProps {
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
  cutoffMonths: string;
  setCutoffMonths: (months: string) => void;
  cutoff: number;
  pending: { incidents: number; requests: number };
  canArchiveSomething: boolean;
  bulkTarget: "incidents" | "requests" | null;
  setBulkTarget: (target: "incidents" | "requests" | null) => void;
  bulkBusy: boolean;
  onBulkArchive: () => Promise<void>;
  onOpenSettings?: () => void;
}

export function BulkArchiveCard({
  canArchiveIncidents,
  canArchiveRequests,
  cutoffMonths,
  setCutoffMonths,
  cutoff,
  pending,
  canArchiveSomething,
  bulkTarget,
  setBulkTarget,
  bulkBusy,
  onBulkArchive,
  onOpenSettings,
}: BulkArchiveCardProps) {
  if (!canArchiveIncidents && !canArchiveRequests) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CalendarClock className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Archivar lo antiguo a mano
              </p>
              <p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">
                Elige una antigüedad y mándalo al archivo ahora mismo; no cambia
                el automático. Solo entra lo terminado, y una ficha concreta se
                archiva desde su propio detalle.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <div className="grid gap-1.5">
              <Label
                htmlFor="archivo-antiguedad"
                className="text-xs text-muted-foreground"
              >
                Antigüedad
              </Label>
              <Select
                value={cutoffMonths}
                onValueChange={(value) => setCutoffMonths(value)}
              >
                <SelectTrigger id="archivo-antiguedad" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUTOFF_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Corte: anterior al <strong>{formatDate(cutoff)}</strong>
          {canArchiveSomething
            ? ` · ${pending.incidents} ${pending.incidents === 1 ? "incidencia cerrada" : "incidencias cerradas"} y ${pending.requests} ${pending.requests === 1 ? "petición decidida" : "peticiones decididas"} pendientes de archivar`
            : " · no hay nada que archivar con este corte"}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {canArchiveIncidents && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={pending.incidents === 0}
              onClick={() => setBulkTarget("incidents")}
            >
              <Archive className="size-4" />
              Archivar {pending.incidents}{" "}
              {pending.incidents === 1 ? "incidencia" : "incidencias"}
            </Button>
          )}
          {canArchiveRequests && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={pending.requests === 0}
              onClick={() => setBulkTarget("requests")}
            >
              <Archive className="size-4" />
              Archivar {pending.requests}{" "}
              {pending.requests === 1 ? "petición" : "peticiones"}
            </Button>
          )}
          {onOpenSettings && (
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-muted-foreground"
              onClick={onOpenSettings}
              title="El archivado automático de cada noche se ajusta en Ajustes del taller"
            >
              <SlidersHorizontal className="size-4" />
              Ajustes del taller
            </Button>
          )}
        </div>
      </div>

      {bulkTarget && (
        <Dialog open onOpenChange={(open) => !open && setBulkTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Archivar lo antiguo</DialogTitle>
              <DialogDescription>
                {bulkTarget === "incidents"
                  ? `Se archivarán ${pending.incidents} ${pending.incidents === 1 ? "incidencia cerrada" : "incidencias cerradas"} anteriores al ${formatDate(cutoff)}.`
                  : `Se archivarán ${pending.requests} ${pending.requests === 1 ? "petición decidida" : "peticiones decididas"} anteriores al ${formatDate(cutoff)}.`}{" "}
                No se borra nada: seguirán consultables aquí y podrás
                recuperarlas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBulkTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={bulkBusy}
                onClick={() => void onBulkArchive()}
              >
                <Archive className="size-4" />
                {bulkBusy ? "Archivando..." : "Archivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
