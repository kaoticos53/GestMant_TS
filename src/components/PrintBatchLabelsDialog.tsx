import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Printer, Tags } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { printLabelDocument } from "@/lib/labelBrowser";
import {
  DEFAULT_LABEL_SIZE,
  isPrintableLabel,
  LABEL_SIZES,
  labelPrintDocument,
  labelSize,
  labelSvg,
  type LabelData,
  type LabelKind,
  type LabelSizeId,
} from "@/lib/labelGenerator";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";

/** Máximo de etiquetas distintas por lote (alineado con `logLabelPrint`). */
export const MAX_BATCH_LABELS = 50;
const MAX_BATCH_COPIES = 20;

export interface PrintBatchLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  kind: LabelKind;
  labels: readonly LabelData[];
}

/**
 * Diálogo de impresión de etiquetas QR y código de barras en lote para los
 * equipos o repuestos filtrados actualmente.
 */
export function PrintBatchLabelsDialog({
  open,
  onClose,
  kind,
  labels,
}: PrintBatchLabelsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-4 text-primary" />
            Imprimir lote de etiquetas
          </DialogTitle>
          <DialogDescription>
            Selecciona los elementos a imprimir (máximo {MAX_BATCH_LABELS} por
            lote). Cada etiqueta saldrá en su página del rollo térmico con QR y
            código de barras.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <PrintBatchLabelsDialogBody
            key={`${kind}-${labels.length}`}
            kind={kind}
            labels={labels}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrintBatchLabelsDialogBody({
  kind,
  labels,
  onClose,
}: {
  kind: LabelKind;
  labels: readonly LabelData[];
  onClose: () => void;
}) {
  const printableLabels = useMemo(
    () => labels.filter(isPrintableLabel),
    [labels],
  );
  const skippedCount = labels.length - printableLabels.length;

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () =>
      new Set(
        printableLabels
          .slice(0, MAX_BATCH_LABELS)
          .map((_, index) => index),
      ),
  );
  const [sizeId, setSizeId] = useState<LabelSizeId>(DEFAULT_LABEL_SIZE);
  const [copiesInput, setCopiesInput] = useState("1");
  const logPrint = useMutation(api.audit.logLabelPrint);

  const selectedLabels = useMemo(
    () => printableLabels.filter((_, index) => selectedIndices.has(index)),
    [printableLabels, selectedIndices],
  );

  const firstSelected = selectedLabels[0] ?? null;
  const size = labelSize(sizeId);
  const previewSvg = useMemo(
    () => (firstSelected ? labelSvg(firstSelected, size) : ""),
    [firstSelected, size],
  );
  const previewSrc = useMemo(
    () =>
      previewSvg
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`
        : "",
    [previewSvg],
  );

  const parsedCopies = Number.parseInt(copiesInput, 10);
  const copies = Number.isFinite(parsedCopies)
    ? Math.min(MAX_BATCH_COPIES, Math.max(1, parsedCopies))
    : 1;

  const toggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_BATCH_LABELS) {
        next.add(index);
      } else {
        toast.info(
          `El máximo por lote es de ${MAX_BATCH_LABELS} etiquetas.`,
        );
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(
      new Set(
        printableLabels.slice(0, MAX_BATCH_LABELS).map((_, idx) => idx),
      ),
    );
  };

  const clearAll = () => {
    setSelectedIndices(new Set());
  };

  const handlePrint = () => {
    if (selectedLabels.length === 0) return;
    setCopiesInput(String(copies));

    const printed = printLabelDocument(
      labelPrintDocument(selectedLabels, { size: sizeId, copies }),
    );
    if (!printed) {
      toast.error(
        "El navegador ha bloqueado la ventana de impresión. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.",
      );
      return;
    }

    const totalPages = selectedLabels.length * copies;
    toast.success(
      `${selectedLabels.length} ${
        selectedLabels.length === 1 ? "etiqueta enviada" : "etiquetas enviadas"
      } a la impresora (${totalPages} ${totalPages === 1 ? "copia" : "copias"})`,
    );

    void logPrint({
      kind,
      codes: selectedLabels.map((item) => item.code),
    }).catch((error) => {
      toast.warning("El lote se ha impreso, pero no se ha podido auditar", {
        description: getErrorMessage(error),
      });
    });
    onClose();
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {skippedCount > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {skippedCount}{" "}
            {skippedCount === 1
              ? "elemento filtrado se omitió por no tener código."
              : "elementos filtrados se omitieron por no tener código."}
          </p>
        )}

        {printableLabels.length > MAX_BATCH_LABELS && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Hay {printableLabels.length} elementos con código; por defecto se han
            marcado los primeros {MAX_BATCH_LABELS}.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedLabels.length} /{" "}
            {Math.min(printableLabels.length, MAX_BATCH_LABELS)} seleccionadas
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={selectAll}
              disabled={printableLabels.length === 0}
            >
              Seleccionar todo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearAll}
              disabled={selectedIndices.size === 0}
            >
              Ninguno
            </Button>
          </div>
        </div>

        <div className="max-h-56 divide-y divide-border/70 overflow-y-auto rounded-lg border border-border/70">
          {printableLabels.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Ninguno de los elementos filtrados tiene código para generar
              etiqueta.
            </p>
          ) : (
            printableLabels.map((item, index) => {
              const checked = selectedIndices.has(index);
              const checkboxId = `batch-label-${index}`;
              return (
                <label
                  key={`${index}-${item.code}`}
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={() => toggleIndex(index)}
                  />
                  <span className="shrink-0 font-mono text-xs font-medium">
                    {item.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.location && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {item.location}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Medida del rollo</span>
            <div className="flex flex-wrap gap-2">
              {LABEL_SIZES.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={option.id === sizeId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeId(option.id)}
                  aria-pressed={option.id === sizeId}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="mt-2 flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="batch-label-copies"
                  className="text-sm font-medium"
                >
                  Copias por etiqueta
                </label>
                <Input
                  id="batch-label-copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_BATCH_COPIES}
                  value={copiesInput}
                  onChange={(event) => setCopiesInput(event.target.value)}
                  onBlur={() => setCopiesInput(String(copies))}
                  className="w-24 tabular-nums"
                />
              </div>
              <span className="pb-2 text-xs text-muted-foreground">
                Total páginas: {selectedLabels.length * copies}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {firstSelected
                ? `Vista previa (${firstSelected.code})`
                : "Vista previa"}
            </span>
            <div className="flex min-h-[108px] items-center justify-center rounded-lg border border-border/70 bg-white p-3">
              {firstSelected ? (
                <img
                  src={previewSrc}
                  alt={`Vista previa de ${firstSelected.code}`}
                  className="block h-auto max-w-full"
                  style={{ width: `${size.widthMm * 2.8}px` }}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Marca al menos un elemento para previsualizar.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className={cn("gap-2")}>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={handlePrint}
          disabled={selectedLabels.length === 0}
        >
          <Printer className="size-4" />
          Imprimir ({selectedLabels.length * copies})
        </Button>
      </DialogFooter>
    </>
  );
}
