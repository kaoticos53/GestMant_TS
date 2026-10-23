import { useMemo, useState } from "react";
import { Printer, Tag } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_LABEL_SIZE,
  LABEL_SIZES,
  labelPrintDocument,
  labelSize,
  labelSvg,
  type LabelData,
  type LabelSizeId,
} from "@/lib/labelGenerator";
import { printLabelDocument } from "@/lib/labelBrowser";
import { getErrorMessage } from "@/lib/workshop";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

/** Cuántas copias de una misma etiqueta se pueden pedir de una vez. */
const MAX_COPIES = 50;

/**
 * La puerta a la impresora de etiquetas: se elige el rollo, las copias y se ve
 * tal cual va a salir antes de gastar una pegatina.
 *
 * La etiqueta que llega ya está compuesta —el código, el nombre y la dirección
 * del QR— por `lib/labelGenerator`; aquí solo se elige la medida y se manda. La
 * vista previa es el mismo SVG que se imprime, metido en un `img`: se ve el
 * reparto real de líneas, no una aproximación, y un QR torcido o un nombre
 * cortado se notan antes de imprimir.
 *
 * La impresión deja constancia en el rastro de seguridad: una etiqueta saca un
 * identificador del taller a una pared. Si no se puede apuntar —sin conexión,
 * por ejemplo—, la etiqueta sale igual y se avisa: bloquear la impresión por no
 * poder auditar dejaría al técnico sin pegatina en mitad del montaje.
 */
export function PrintLabelDialog({
  label,
  onClose,
}: {
  /** La etiqueta a imprimir; `null` cierra el diálogo. */
  label: LabelData | null;
  onClose: () => void;
}) {
  const [sizeId, setSizeId] = useState<LabelSizeId>(DEFAULT_LABEL_SIZE);
  const [copies, setCopies] = useState(1);
  const logPrint = useMutation(api.audit.logLabelPrint);

  const size = labelSize(sizeId);
  const svg = useMemo(
    () => (label === null ? "" : labelSvg(label, size)),
    [label, size],
  );
  // El SVG va como `img` y no como HTML inyectado: un nombre con `<` no puede
  // convertirse en marcado dentro de la aplicación.
  const previewSrc = useMemo(
    () =>
      svg === "" ? "" : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  );

  const count = Math.min(MAX_COPIES, Math.max(1, Math.trunc(copies) || 1));

  const handlePrint = () => {
    if (label === null) return;
    // Se comprueba aquí, no al pulsar: el botón se deshabilita y el mensaje
    // explica por qué.
    if (label.code === "") {
      toast.error("La etiqueta no tiene código: no se puede generar el QR.");
      return;
    }
    const printed = printLabelDocument(
      labelPrintDocument([label], { size: sizeId, copies: count }),
    );
    if (!printed) {
      toast.error(
        "El navegador ha bloqueado la ventana de impresión. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.",
      );
      return;
    }
    toast.success(
      count === 1
        ? `Etiqueta de ${label.code} enviada a la impresora`
        : `${count} copias de ${label.code} enviadas a la impresora`,
    );
    void logPrint({ kind: label.kind, codes: [label.code] }).catch((error) => {
      toast.warning("La etiqueta se ha impreso, pero no se ha podido auditar", {
        description: getErrorMessage(error),
      });
    });
  };

  return (
    <Dialog
      open={label !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            Imprimir etiqueta
          </DialogTitle>
          <DialogDescription>
            Se imprime en el rollo térmico: el QR abre la ficha en el buscador
            del taller y el código de barras lo lee la pistola del almacén.
          </DialogDescription>
        </DialogHeader>

        {label !== null && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border/70 bg-white p-4">
              {/* La misma composición que va al papel, a su medida. */}
              <img
                src={previewSrc}
                alt={`Vista previa de la etiqueta de ${label.code}`}
                className="mx-auto block h-auto max-w-full"
                style={{ width: `${size.widthMm * 3}px` }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
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
            </div>

            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="label-copies"
                  className="text-sm font-medium"
                >
                  Copias
                </label>
                <Input
                  id="label-copies"
                  type="number"
                  min={1}
                  max={MAX_COPIES}
                  value={copies}
                  onChange={(event) =>
                    setCopies(Number(event.target.value) || 1)
                  }
                  className="w-24 tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Una por estante o por equipo, si se va a pegar en varios sitios.
              </p>
            </div>

            {label.code === "" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Esta etiqueta todavía no tiene código: asígnalo en la ficha del
                equipo o del repuesto para que lleve QR y código de barras.
              </p>
            )}
          </div>
        )}

        <DialogFooter className={cn("gap-2")}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handlePrint}
            disabled={label === null || label.code === ""}
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
