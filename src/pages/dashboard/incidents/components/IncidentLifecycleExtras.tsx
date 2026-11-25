import { useState } from "react";
import { useMutation } from "convex/react";
import { CopyPlus, RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isClosedIncident, isIncidentInExternalRepair } from "@/lib/incidentFlow";
import { getErrorMessage } from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export interface IncidentLifecycleExtrasProps {
  incident: IncidentDoc;
  canCoordinate: boolean;
  canWork: boolean;
  archived: boolean;
  withdrawn: boolean;
}

export function IncidentLifecycleExtras({
  incident,
  canCoordinate,
  canWork,
  archived,
  withdrawn,
}: IncidentLifecycleExtrasProps) {
  const reopen = useMutation(api.incidents.reopen);
  const createRecurrence = useMutation(api.incidents.createRecurrence);
  const updateExternal = useMutation(api.incidents.updateExternalRepair);

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [extOpen, setExtOpen] = useState(false);
  const [rmaNumber, setRmaNumber] = useState(
    incident.externalRepair?.rmaNumber ?? "",
  );
  const [quoteStatus, setQuoteStatus] = useState<
    "awaiting_quote" | "accepted" | "declined"
  >(incident.externalRepair?.quoteStatus ?? "awaiting_quote");
  const [estimatedCost, setEstimatedCost] = useState(
    incident.externalRepair?.estimatedCost !== undefined
      ? String(incident.externalRepair.estimatedCost)
      : "",
  );
  const [busy, setBusy] = useState(false);

  if (archived || withdrawn) return null;

  const isClosed = isClosedIncident(incident.status);
  const isExternal = isIncidentInExternalRepair(incident.status);

  if (!isClosed && !isExternal) return null;

  const handleReopen = async () => {
    const trimmed = reopenNote.trim();
    if (!trimmed) {
      toast.error("Indica el motivo de la reapertura.");
      return;
    }
    setBusy(true);
    try {
      await reopen({ incidentId: incident._id, note: trimmed });
      toast.success(`Incidencia ${incident.reference} reabierta en taller.`);
      setReopenOpen(false);
      setReopenNote("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRecurrence = async () => {
    setBusy(true);
    try {
      const res = await createRecurrence({ parentIncidentId: incident._id });
      toast.success(`Reincidencia ${res.reference} creada.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateExternal = async () => {
    const cost =
      estimatedCost.trim() === "" ? undefined : Number(estimatedCost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      toast.error("El coste estimado debe ser un número positivo.");
      return;
    }
    setBusy(true);
    try {
      await updateExternal({
        incidentId: incident._id,
        rmaNumber: rmaNumber.trim() || undefined,
        quoteStatus,
        estimatedCost: cost,
      });
      toast.success("Seguimiento SAT externo actualizado.");
      setExtOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 px-4 pb-2 sm:px-6">
        {isExternal && (canCoordinate || canWork) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => setExtOpen(true)}
          >
            <Wrench className="size-3.5" />
            Seguimiento SAT externo
          </Button>
        )}

        {isClosed && canCoordinate && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => void handleRecurrence()}
            >
              <CopyPlus className="size-3.5" />
              Abrir reincidencia
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => setReopenOpen(true)}
            >
              <RotateCcw className="size-3.5" />
              Reabrir (error de cierre)
            </Button>
          </>
        )}
      </div>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir {incident.reference}</DialogTitle>
            <DialogDescription>
              Devuelve la incidencia cerrada al estado <strong>En taller</strong>.
              Indica el motivo para dejar constancia en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="reopen-incident-note">Motivo (obligatorio)</Label>
            <Textarea
              id="reopen-incident-note"
              value={reopenNote}
              onChange={(e) => setReopenNote(e.target.value)}
              placeholder="Ej. Cerrada por error antes de verificar la prueba final…"
              rows={3}
              maxLength={240}
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReopenOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleReopen()}
              disabled={busy}
            >
              {busy ? "Reabriendo..." : "Confirmar reapertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seguimiento SAT externo</DialogTitle>
            <DialogDescription>
              Actualiza el nº de RMA, estado del presupuesto y coste estimado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ext-rma">Nº RMA / Expediente</Label>
              <Input
                id="ext-rma"
                value={rmaNumber}
                onChange={(e) => setRmaNumber(e.target.value)}
                placeholder="Ej. RMA-2026-441"
                disabled={busy}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ext-quote">Estado del presupuesto</Label>
              <select
                id="ext-quote"
                value={quoteStatus}
                onChange={(e) =>
                  setQuoteStatus(
                    e.target.value as
                      | "awaiting_quote"
                      | "accepted"
                      | "declined",
                  )
                }
                disabled={busy}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="awaiting_quote">Pendiente de presupuesto</option>
                <option value="accepted">Presupuesto aceptado</option>
                <option value="declined">Presupuesto rechazado / Irreparable</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ext-cost">Coste estimado (€)</Label>
              <Input
                id="ext-cost"
                type="number"
                min={0}
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setExtOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleUpdateExternal()}
              disabled={busy}
            >
              {busy ? "Guardando..." : "Guardar seguimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
