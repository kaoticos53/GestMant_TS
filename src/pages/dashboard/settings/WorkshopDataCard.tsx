import { useState } from "react";
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
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation } from "convex/react";
import { Database, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function WorkshopDataCard() {
  const seedDemoData = useMutation(api.seed.seedDemoData);
  const seedDemoUploads = useAction(api.seed.seedDemoUploads);
  const seedDemoManuals = useAction(api.seed.seedDemoManuals);
  const resetWorkshop = useAction(api.workshopReset.resetWorkshop);

  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");

  // La palabra que hay que escribir para confirmar: sin ella, un descuido no se
  // lleva por delante el taller entero.
  const CONFIRM_WORD = "VACIAR";
  const canVaciar = phrase.trim().toUpperCase() === CONFIRM_WORD;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      // El mismo orden que el aviso del panel: primero las fotos —lo que no cabe
      // en la mutación—, después la muestra y, al final, los manuales, que en
      // parte van a equipos que la muestra acaba de crear.
      const photos = await seedDemoUploads();
      await seedDemoData();
      const manuals = await seedDemoManuals();
      const telling = [
        photos.uploaded > 0
          ? `${photos.uploaded} fotos del formulario esperando limpieza`
          : null,
        manuals.inserted > 0 ? `${manuals.inserted} manuales` : null,
      ].filter((part): part is string => part !== null);
      toast.success(
        telling.length > 0
          ? `Datos de ejemplo cargados · ${telling.join(" · ")}`
          : "Datos de ejemplo cargados",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await resetWorkshop();
      toast.success(
        result.deleted === 0
          ? "El taller ya estaba vacío"
          : `Taller vacío · ${result.deleted} ${
              result.deleted === 1 ? "ficha retirada" : "fichas retiradas"
            }`,
      );
      setConfirming(false);
      setPhrase("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Database className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Datos del taller
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            La muestra de ejemplo es para probar el flujo completo: trae un
            catálogo de repuestos, equipos, incidencias y peticiones ya
            repartidas. Un taller de verdad no la necesita —basta con dejar el
            taller vacío y dar de alta lo suyo—, y si ya se cargó por error, se
            puede vaciar para empezar de cero.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={seeding || resetting}
          onClick={() => void handleSeed()}
        >
          <Sparkles className="size-4" />
          {seeding ? "Cargando..." : "Cargar datos de ejemplo"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={seeding || resetting}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Vaciar el taller
        </Button>
      </div>

      {confirming && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirming(false);
              setPhrase("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Vaciar el taller</DialogTitle>
              <DialogDescription>
                Se borran <strong>todos</strong> los datos del trabajo:
                repuestos, equipos, incidencias, peticiones, compras,
                mantenimiento, manuales, mensajes y avisos. Las cuentas del
                taller, sus roles y los ajustes de fondo se conservan. Esta
                acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="vaciar-confirm" className="text-xs">
                {`Escribe ${CONFIRM_WORD} para confirmar`}
              </Label>
              <Input
                id="vaciar-confirm"
                value={phrase}
                autoComplete="off"
                placeholder={CONFIRM_WORD}
                onChange={(event) => setPhrase(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirming(false);
                  setPhrase("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={!canVaciar || resetting}
                onClick={() => void handleReset()}
              >
                <Trash2 className="size-4" />
                {resetting ? "Vaciando..." : "Vaciar el taller"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
