import { useState } from "react";
import { useMutation } from "convex/react";
import {
  Archive,
  Check,
  FileDown,
  PackagePlus,
  Trash2,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { archiveWithUndoToast, unarchiveSuccessToast } from "@/lib/archiveToasts";
import {
  canAdvanceIncident,
  incidentTakesPartRequests,
  isClosedIncident,
  isIncidentWaitingParts,
} from "@/lib/incidentFlow";
import { getErrorMessage } from "@/lib/workshop";
import { useIncidentExport } from "../../hooks/useIncidentExport";
import { AssignDialog } from "../../dialogs/AssignDialog";
import { VerifyDialog } from "../../dialogs/VerifyDialog";
import { CloseDialog } from "../../dialogs/CloseDialog";
import { IncidentRequestDialog } from "../../dialogs/IncidentRequestDialog";
import { SendToExternalDialog } from "../../dialogs/SendToExternalDialog";
import { ReceiveFromExternalDialog } from "../../dialogs/ReceiveFromExternalDialog";
import type { EquipmentDoc, IncidentDoc } from "../../types";

export interface IncidentActionsBarProps {
  incident: IncidentDoc;
  linkedEquipment: EquipmentDoc | null;
  linkedRequests: Doc<"partRequests">[];
  trail: Doc<"incidentAuditLog">[] | undefined;
  currentUserId: Id<"users"> | null;
  currentUserName: string;
  canWork: boolean;
  canCoordinate: boolean;
  canReassignWorkshop: boolean;
  inWorkshop: boolean;
  archived: boolean;
  withdrawn: boolean;
  trailPending: boolean;
  onClose: () => void;
}

export function IncidentActionsBar({
  incident,
  linkedEquipment,
  linkedRequests,
  trail,
  currentUserId,
  currentUserName,
  canWork,
  canCoordinate,
  canReassignWorkshop,
  inWorkshop,
  archived,
  withdrawn,
  trailPending,
  onClose,
}: IncidentActionsBarProps) {
  const selfAssign = useMutation(api.incidents.selfAssign);
  const archiveIncident = useMutation(api.incidents.archive);
  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const withdrawIncident = useMutation(api.incidents.withdraw);

  const [busy, setBusy] = useState(false);
  const [assignTarget, setAssignTarget] = useState<"assign" | "workshop" | null>(
    null,
  );
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [sendExternalOpen, setSendExternalOpen] = useState(false);
  const [receiveExternalOpen, setReceiveExternalOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const {
    preparingPdf,
    preparingPackage,
    handleDownloadReport,
    handleDownloadReportPackage,
    handleDownloadReportPdf,
  } = useIncidentExport({
    incident,
    linkedEquipment,
    linkedRequests,
    trail,
    currentUserName,
  });

  const handleSelfAssign = async () => {
    setBusy(true);
    try {
      await selfAssign({
        incidentId: incident._id,
        expectedUpdatedAt: incident.updatedAt,
      });
      toast.success(`${incident.reference} autoasignada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await archiveIncident({ incidentId: incident._id });
      archiveWithUndoToast({
        reference: incident.reference,
        noun: "incidencia",
        onUndo: async () => {
          try {
            await unarchiveIncident({ incidentId: incident._id });
            unarchiveSuccessToast({ reference: incident.reference });
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    setBusy(true);
    try {
      const reason = withdrawReason.trim();
      await withdrawIncident({
        incidentId: incident._id,
        ...(reason ? { reason } : {}),
      });
      toast.success(
        `${incident.reference} retirada: queda en la papelera por si hay que volver a por ella`,
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
      setWithdrawOpen(false);
      setWithdrawReason("");
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex flex-wrap justify-end gap-2">
          {/* Dropdown unificado de descargas */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={trailPending}
                title={
                  trailPending
                    ? "Cargando el rastro de auditoría…"
                    : "Descargar el parte de la incidencia"
                }
              >
                <FileDown className="size-4" />
                Descargar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Parte de {incident.reference}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => handleDownloadReport()}>
                Markdown, para leerlo o editarlo
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={preparingPdf || preparingPackage}
                onSelect={() => void handleDownloadReportPdf()}
              >
                {preparingPdf ? "Preparando PDF…" : "PDF, listo para entregar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={preparingPdf || preparingPackage}
                onSelect={() => void handleDownloadReportPackage()}
              >
                {preparingPackage
                  ? "Preparando paquete…"
                  : "ZIP con las fotos dentro"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>

          {canAdvanceIncident(incident.status, "selfAssign") && (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleSelfAssign}
                disabled={busy || !currentUserId}
              >
                <UserPlus className="size-4" />
                Autoasignarme
              </Button>
              {canCoordinate && (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setAssignTarget("assign")}
                >
                  <UserPlus className="size-4" />
                  Asignar a un técnico
                </Button>
              )}
            </>
          )}

          {canAdvanceIncident(incident.status, "verifyWorkshop") &&
            canWork &&
            !inWorkshop && (
              <>
                {canCoordinate && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setAssignTarget("assign")}
                  >
                    <UserPlus className="size-4" />
                    Reasignar
                  </Button>
                )}
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setVerifyOpen(true)}
                >
                  <Check className="size-4" />
                  Verificar incidencia
                </Button>
              </>
            )}

          {canWork && incidentTakesPartRequests(incident.status) && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setRequestOpen(true)}
            >
              <PackagePlus className="size-4" />
              Petición de repuestos
            </Button>
          )}

          {isClosedIncident(incident.status) && canCoordinate && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={busy}
              onClick={() => void handleArchive()}
            >
              <Archive className="size-4" />
              Archivar
            </Button>
          )}

          {canCoordinate && (
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setWithdrawOpen(true)}
              title="Se guarda unos días en la papelera antes de borrarse de verdad"
            >
              <Trash2 className="size-4" />
              Retirar
            </Button>
          )}

          {canReassignWorkshop && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setAssignTarget("workshop")}
            >
              <UserPlus className="size-4" />
              Asignar orden
            </Button>
          )}

          {canAdvanceIncident(incident.status, "sendExternal") && canWork && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setSendExternalOpen(true)}
            >
              <Truck className="size-4" />
              Reparación externa
            </Button>
          )}

          {canAdvanceIncident(incident.status, "returnExternal") && canWork && (
            <Button
              type="button"
              className="gap-2"
              onClick={() => setReceiveExternalOpen(true)}
            >
              <Truck className="size-4" />
              Registrar retorno
            </Button>
          )}

          {canAdvanceIncident(incident.status, "closeResolved") &&
            canWork &&
            inWorkshop && (
              <Button
                type="button"
                className="gap-2"
                onClick={() => setCloseOpen(true)}
              >
                <Wrench className="size-4" />
                Finalizar trabajo
              </Button>
            )}
        </div>

        {!archived &&
          !withdrawn &&
          !canWork &&
          !canAdvanceIncident(incident.status, "selfAssign") && (
            <p className="mt-2 text-right text-xs text-muted-foreground">
              Solo el técnico asignado o el coordinador pueden actuar sobre esta
              incidencia.
            </p>
          )}
        {withdrawn && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            En la papelera: el caso se consulta en solo lectura. Se recupera o
            se borra desde el módulo Archivo.
          </p>
        )}
        {archived && !withdrawn && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            En el archivo: el caso se consulta en solo lectura. Se recupera desde
            el módulo Archivo.
          </p>
        )}
        {canWork && isIncidentWaitingParts(incident.status) && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            Esperando el material de la petición: cuando se entregue todo, la
            incidencia pasa a «En reparación» sola.
          </p>
        )}
      </div>

      {/* Diálogos subordinados de transición */}
      {assignTarget && (
        <AssignDialog
          incident={incident}
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {verifyOpen && (
        <VerifyDialog incident={incident} onClose={() => setVerifyOpen(false)} />
      )}

      {closeOpen && (
        <CloseDialog incident={incident} onClose={() => setCloseOpen(false)} />
      )}

      {requestOpen && (
        <IncidentRequestDialog
          incident={incident}
          onClose={() => setRequestOpen(false)}
        />
      )}

      {sendExternalOpen && (
        <SendToExternalDialog
          incident={incident}
          onClose={() => setSendExternalOpen(false)}
        />
      )}

      {receiveExternalOpen && (
        <ReceiveFromExternalDialog
          incident={incident}
          onClose={() => setReceiveExternalOpen(false)}
        />
      )}

      <AlertDialog
        open={withdrawOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWithdrawOpen(false);
            setWithdrawReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Retirar la incidencia {incident.reference}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La incidencia saldrá de la cola activa y se moverá a la papelera,
              donde se conservará unos días antes de borrarse definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="withdraw-reason">Motivo (opcional)</Label>
            <Input
              id="withdraw-reason"
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              placeholder="p. ej. Notificación duplicada o por error..."
              disabled={busy}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleWithdraw();
              }}
            >
              {busy ? "Retirando..." : "Retirar a la papelera"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
