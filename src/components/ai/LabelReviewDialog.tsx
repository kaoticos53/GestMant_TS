import { Badge } from "@/components/ui/badge";
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
import type { AiConfidence, EquipmentLabelExtraction } from "@/lib/ai";
import { Check, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import type { AppliedLabelFields } from "./useEquipmentLabelScanner";

const CONFIDENCE_META: Record<
  AiConfidence,
  { label: string; className: string }
> = {
  high: {
    label: "Confianza alta",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  medium: {
    label: "Confianza media",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60",
  },
  low: {
    label: "Confianza baja",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/60",
  },
};

interface LabelReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string | null;
  extraction: EquipmentLabelExtraction | null;
  draft: AppliedLabelFields;
  onDraftChange: (next: AppliedLabelFields) => void;
  onConfirm: () => void;
}

export function LabelReviewDialog({
  open,
  onOpenChange,
  imageDataUrl,
  extraction,
  draft,
  onDraftChange,
  onConfirm,
}: LabelReviewDialogProps) {
  const [rotation, setRotation] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (!extraction || !imageDataUrl) {
    return null;
  }

  const confidenceMeta = CONFIDENCE_META[extraction.confidence];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Revisar datos de la etiqueta</DialogTitle>
          <DialogDescription>
            Compara la foto original con los campos detectados por IA antes de
            aplicarlos al formulario.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Foto de la etiqueta
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                >
                  <RotateCw className="mr-1.5 size-3.5" />
                  Rotar 90°
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomed((prev) => !prev)}
                >
                  {zoomed ? (
                    <ZoomOut className="mr-1.5 size-3.5" />
                  ) : (
                    <ZoomIn className="mr-1.5 size-3.5" />
                  )}
                  {zoomed ? "Ajustar" : "Ampliar"}
                </Button>
              </div>
            </div>

            <div className="flex max-h-80 items-center justify-center overflow-auto rounded-lg border bg-muted/30 p-2">
              <img
                src={imageDataUrl}
                alt="Etiqueta de equipo"
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoomed ? 1.5 : 1})`,
                }}
                className="max-h-72 rounded object-contain transition-transform"
              />
            </div>

            {extraction.evidence && (
              <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
                <p className="font-medium text-muted-foreground">
                  Texto leído literalmente:
                </p>
                <p className="mt-1 font-mono break-words">
                  {extraction.evidence}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={confidenceMeta.className}>
                {confidenceMeta.label}
              </Badge>
              {extraction.catalogMatch && (
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary"
                >
                  Coincide con catálogo: {extraction.catalogMatch.model}
                </Badge>
              )}
            </div>

            {extraction.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {extraction.warnings.join(" · ")}
              </div>
            )}

            <div className="grid gap-2.5">
              <div className="grid gap-1">
                <Label htmlFor="ai-review-brand">Marca</Label>
                <Input
                  id="ai-review-brand"
                  value={draft.brand ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, brand: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="ai-review-model">Modelo</Label>
                <Input
                  id="ai-review-model"
                  className="font-mono"
                  value={draft.model ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, model: e.target.value })
                  }
                />
                {extraction.alternatives.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Alternativas:
                    </span>
                    {extraction.alternatives.map((alt) => (
                      <Button
                        key={alt}
                        type="button"
                        size="sm"
                        variant={draft.model === alt ? "default" : "outline"}
                        className="h-6 px-2 font-mono text-[11px]"
                        onClick={() => onDraftChange({ ...draft, model: alt })}
                      >
                        {alt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-1">
                <Label htmlFor="ai-review-serial">Número de serie</Label>
                <Input
                  id="ai-review-serial"
                  className="font-mono"
                  value={draft.serialNumber ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, serialNumber: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="ai-review-kind">Tipo de equipo</Label>
                <Input
                  id="ai-review-kind"
                  value={draft.equipmentKind ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, equipmentKind: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="ai-review-description">
                  Descripción y datos varios
                </Label>
                <Textarea
                  id="ai-review-description"
                  rows={3}
                  className="text-xs"
                  value={draft.description ?? ""}
                  onChange={(e) =>
                    onDraftChange({ ...draft, description: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            <Check className="mr-1.5 size-4" />
            Confirmar y aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
