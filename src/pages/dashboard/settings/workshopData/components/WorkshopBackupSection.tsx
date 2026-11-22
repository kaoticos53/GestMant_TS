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
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRawJson, setPendingRawJson] = useState<string | null>(null);
  const [pendingSummary, setPendingSummary] = useState<BackupSummary | null>(
    null,
  );
  const [pendingBytes, setPendingBytes] = useState(0);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const resetPending = () => {
    setPendingRawJson(null);
    setPendingSummary(null);
    setPendingBytes(0);
    setConfirmPhrase("");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportBackup({});
      const blob = new Blob([result.rawJson], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStr = new Date(result.summary.exportedAt)
        .toISOString()
        .slice(0, 10);
      anchor.href = url;
      anchor.download = `pulso-taller-backup-${dateStr}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `Copia de seguridad descargada (${result.summary.totalRecords} registros)`,
      );
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
      const parsed = parseWorkshopBackup(raw);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      setPendingRawJson(raw);
      setPendingSummary(parsed.summary);
      setPendingBytes(file.size);
      setConfirmPhrase("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRawJson || confirmPhrase.trim() !== RESTORE_CONFIRM_WORD) {
      return;
    }
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
          Descarga una copia completa en JSON de todas las tablas operativas del
          taller o restaura desde un archivo anterior (sin alterar usuarios ni
          el registro de seguridad).
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={exporting || restoring}
          onClick={() => void handleExport()}
        >
          {exporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Descargar copia (.json)
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

              {restoreLevel === "normal" ? (
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
