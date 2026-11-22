import { InlineNotice } from "@/components/InlineNotice";
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
import {
  RESTORE_CONFIRM_WORD,
  estimateRestoreSeconds,
  parseWorkshopBackup,
  restoreSizeLevel,
  type BackupSummary,
} from "@/lib/backup";
import {
  MIN_BACKUP_PASSPHRASE,
  isProtectedBackup,
  protectBackup,
  unlockBackup,
} from "@/lib/backupFile";
import {
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction } from "convex/react";
import { Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function WorkshopBackupSection() {
  const exportBackup = useAction(api.workshopBackup.exportBackup);
  const restoreBackup = useAction(api.workshopBackup.restoreBackup);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // El botón ya se deshabilita al empezar, pero el pestillo evita que dos
  // pulsaciones seguidas —antes de que React repinte— lancen dos restauraciones.
  const restoreInFlight = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRawJson, setPendingRawJson] = useState<string | null>(null);
  const [pendingSummary, setPendingSummary] = useState<BackupSummary | null>(
    null,
  );
  const [pendingBytes, setPendingBytes] = useState(0);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportRepeat, setExportRepeat] = useState("");
  const [protectedRaw, setProtectedRaw] = useState<string | null>(null);
  const [protectedBytes, setProtectedBytes] = useState(0);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const resetPending = () => {
    setPendingRawJson(null);
    setPendingSummary(null);
    setPendingBytes(0);
    setConfirmPhrase("");
  };

  const closeExport = () => {
    if (exporting) return;
    setExportOpen(false);
    setExportPassphrase("");
    setExportRepeat("");
  };

  const closeUnlock = () => {
    if (unlocking) return;
    setUnlockOpen(false);
    setProtectedRaw(null);
    setProtectedBytes(0);
    setUnlockPassphrase("");
  };

  const download = (raw: string, exportedAt: number) => {
    const blob = new Blob([raw], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStr = new Date(exportedAt).toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `pulso-taller-backup-${dateStr}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportConfirm = async () => {
    if (exporting) return;
    if (exportPassphrase.length < MIN_BACKUP_PASSPHRASE) {
      toast.error(
        `La frase de la copia debe tener al menos ${MIN_BACKUP_PASSPHRASE} caracteres.`,
      );
      return;
    }
    if (exportPassphrase !== exportRepeat) {
      toast.error("Las dos frases de la copia no coinciden.");
      return;
    }
    setExporting(true);
    try {
      const result = await exportBackup({});
      const protectedText = await protectBackup(
        result.rawJson,
        exportPassphrase,
      );
      download(protectedText, result.summary.exportedAt);
      toast.success(
        `Copia cifrada y comprimida descargada (${result.summary.totalRecords} registros)`,
      );
      setExportOpen(false);
      setExportPassphrase("");
      setExportRepeat("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = await file.text();
      resetPending();
      if (isProtectedBackup(raw)) {
        setProtectedRaw(raw);
        setProtectedBytes(file.size);
        setUnlockPassphrase("");
        setUnlockOpen(true);
        return;
      }
      const parsed = parseWorkshopBackup(raw);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      setPendingRawJson(raw);
      setPendingSummary(parsed.summary);
      setPendingBytes(file.size);
      if (parsed.migratedFrom !== undefined) {
        toast.info(
          `Copia de la versión ${parsed.migratedFrom} adaptada al formato actual.`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUnlock = async () => {
    if (unlocking || !protectedRaw) return;
    setUnlocking(true);
    try {
      const raw = await unlockBackup(protectedRaw, unlockPassphrase);
      const parsed = parseWorkshopBackup(raw);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      setPendingRawJson(raw);
      setPendingSummary(parsed.summary);
      setPendingBytes(protectedBytes);
      setConfirmPhrase("");
      setUnlockOpen(false);
      setProtectedRaw(null);
      setProtectedBytes(0);
      setUnlockPassphrase("");
      if (parsed.migratedFrom !== undefined) {
        toast.info(
          `Copia de la versión ${parsed.migratedFrom} adaptada al formato actual.`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUnlocking(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (restoreInFlight.current) return;
    if (!pendingRawJson || confirmPhrase.trim() !== RESTORE_CONFIRM_WORD) {
      return;
    }
    restoreInFlight.current = true;
    setRestoring(true);
    try {
      const res = await restoreBackup({ rawJson: pendingRawJson });
      toast.success(
        `Copia restaurada correctamente (${res.restoredRecords} registros)`,
      );
      resetPending();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      restoreInFlight.current = false;
      setRestoring(false);
    }
  };

  const canConfirm = confirmPhrase.trim() === RESTORE_CONFIRM_WORD;
  const restoreSeconds = pendingSummary
    ? estimateRestoreSeconds(pendingSummary.totalRecords)
    : 0;
  const restoreLevel = pendingSummary
    ? restoreSizeLevel(pendingSummary.totalRecords)
    : "normal";

  return (
    <div className="mt-5 border-t border-border/70 pt-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          Copia de seguridad y restauración
        </h3>
        <p className="text-xs text-muted-foreground">
          Descarga una copia completa, comprimida y cifrada con una frase de
          paso, o restaura desde un archivo anterior (sin alterar usuarios ni el
          registro de seguridad). También se aceptan copias antiguas en JSON.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={exporting || restoring}
          onClick={() => setExportOpen(true)}
        >
          <Download className="mr-2 size-4" />
          Descargar copia cifrada (.json)
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={exporting || restoring}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          Restaurar desde archivo...
        </Button>
      </div>

      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (!open) closeExport();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proteger la copia de seguridad</DialogTitle>
            <DialogDescription>
              La copia se comprimirá y cifrará con esta frase. No se guarda en
              el taller: sin ella no se puede volver a restaurar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="export-backup-passphrase">
                Frase de la copia
              </Label>
              <Input
                id="export-backup-passphrase"
                type="password"
                autoComplete="new-password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                disabled={exporting}
              />
              <p className="text-muted-foreground">
                Al menos {MIN_BACKUP_PASSPHRASE} caracteres. Guárdala en un
                sitio seguro.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-backup-passphrase-repeat">
                Repite la frase
              </Label>
              <Input
                id="export-backup-passphrase-repeat"
                type="password"
                autoComplete="new-password"
                value={exportRepeat}
                onChange={(e) => setExportRepeat(e.target.value)}
                disabled={exporting}
              />
              {exportRepeat.length > 0 && exportRepeat !== exportPassphrase && (
                <p className="text-destructive">Las dos frases no coinciden.</p>
              )}
            </div>
            {exporting && (
              <InlineNotice tone="info">
                <span>Validando y preparando la copia…</span>
              </InlineNotice>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={closeExport}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                exporting ||
                exportPassphrase.length < MIN_BACKUP_PASSPHRASE ||
                exportPassphrase !== exportRepeat
              }
              onClick={() => void handleExportConfirm()}
            >
              {exporting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Descargar copia cifrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unlockOpen}
        onOpenChange={(open) => {
          if (!open) closeUnlock();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir copia protegida</DialogTitle>
            <DialogDescription>
              Escribe la frase con la que se cifró este archivo. Sin ella no se
              puede leer ni restaurar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 text-xs">
            <Label htmlFor="unlock-backup-passphrase">Frase de la copia</Label>
            <Input
              id="unlock-backup-passphrase"
              type="password"
              autoComplete="current-password"
              value={unlockPassphrase}
              onChange={(e) => setUnlockPassphrase(e.target.value)}
              disabled={unlocking}
            />
            {unlocking && (
              <InlineNotice tone="info">
                <span>Comprobando la firma y descifrando…</span>
              </InlineNotice>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={unlocking}
              onClick={closeUnlock}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                unlocking || unlockPassphrase.length < MIN_BACKUP_PASSPHRASE
              }
              onClick={() => void handleUnlock()}
            >
              {unlocking && <Loader2 className="mr-2 size-4 animate-spin" />}
              Abrir copia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingSummary && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !restoring) {
              resetPending();
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar restauración de copia</DialogTitle>
              <DialogDescription>
                Se reemplazarán los datos operativos actuales del taller por el
                contenido de esta copia de seguridad.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="font-medium">
                  {pendingSummary.totalRecords} registros detectados
                  {pendingBytes > 0 && ` · ${formatFileSize(pendingBytes)}`}
                </p>
                <p className="text-muted-foreground">
                  Exportada por {pendingSummary.exportedBy} el{" "}
                  {formatDateTime(pendingSummary.exportedAt)}
                </p>
              </div>

              {restoring ? (
                <InlineNotice tone="info">
                  <span>
                    Restaurando la copia… No cierres la pestaña; puede tardar
                    unos {restoreSeconds} s.
                  </span>
                </InlineNotice>
              ) : restoreLevel === "normal" ? (
                <p className="text-muted-foreground">
                  Restauración estimada: unos {restoreSeconds} s.
                </p>
              ) : (
                <InlineNotice
                  tone="warning"
                  className={
                    restoreLevel === "very-slow" ? "font-medium" : undefined
                  }
                >
                  <span>
                    {restoreLevel === "very-slow"
                      ? "Copia grande"
                      : "Copia voluminosa"}
                    : restaurarla tardará unos {restoreSeconds} s
                    {restoreLevel === "very-slow" ? " o más" : ""}. No cierres
                    la pestaña hasta que termine.
                  </span>
                </InlineNotice>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="restore-confirm-input">
                  Escribe <code>{RESTORE_CONFIRM_WORD}</code> para continuar
                </Label>
                <Input
                  id="restore-confirm-input"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={RESTORE_CONFIRM_WORD}
                  disabled={restoring}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={restoring}
                onClick={resetPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canConfirm || restoring}
                onClick={() => void handleConfirmRestore()}
              >
                {restoring && <Loader2 className="mr-2 size-4 animate-spin" />}
                Restaurar copia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
