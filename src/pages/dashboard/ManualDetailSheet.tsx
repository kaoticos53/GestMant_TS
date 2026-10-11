import { RichText } from "@/components/RichText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Doc } from "@/convex/_generated/dataModel";
import { manualRecord, manualRecordPdfFilename } from "@/lib/manualRecord";
import { downloadPdf, loadPdfImage } from "@/lib/pdfBrowser";
import { reportToPdf } from "@/lib/reportPdf";
import {
  MANUAL_FILE_FORMAT,
  MANUAL_KIND_META,
  manualChangeSummary,
  manualFileName,
  manualHistory,
  manualScopeLabel,
} from "@/lib/manuals";
import {
  equipmentLabel,
  formatDate,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { Download, FileDown, History, NotebookPen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ManualDoc } from "./ManualsView";

type EquipmentDoc = Doc<"equipment">;

/**
 * La ficha de un manual, en su propio sitio porque se abre desde dos lados: la
 * lista del módulo de manuales y la ficha de un equipo. Lo que enseña —datos,
 * archivo, nota, versiones anteriores, historial y el documento que se exporta—
 * es lo mismo en los dos, así que no puede haber dos copias que se separen.
 */
export function ManualDetailSheet({
  manual,
  equipment,
  onClose,
}: {
  manual: ManualDoc;
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const meta = MANUAL_KIND_META[manual.kind];
  const linked = equipment.find((item) => item._id === manual.equipmentId);
  const [exporting, setExporting] = useState(false);

  /**
   * La ficha como documento: el PDF se compone aquí mismo, en el navegador, y
   * la nota va con sus fotos si las lleva. Para adjuntar a un correo o
   * imprimir y guardar en papel.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const bytes = await reportToPdf(
        manualRecord(manual, {
          equipmentName: linked ? equipmentLabel(linked) : undefined,
        }),
        {
          footer: `Ficha del manual «${manual.title}» · Pulso Taller`,
          loadImage: loadPdfImage,
        },
      );
      downloadPdf(manualRecordPdfFilename(manual.title), bytes);
      toast.success("Ficha del manual descargada en PDF");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meta.badgeClassName}>
              {meta.label}
            </Badge>
            <Badge
              variant="outline"
              className="border-border bg-muted text-muted-foreground"
            >
              {manual.type}
            </Badge>
            {manual.brand && (
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                {manual.brand}
              </Badge>
            )}
            {manual.model && (
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                {manual.model}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl tracking-tight">
            {manual.title}
          </SheetTitle>
          <SheetDescription>
            {linked
              ? `Asignado a ${equipmentLabel(linked)}`
              : manualScopeLabel(manual)}
            {manual.author ? ` · ${manual.author}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileDown className="size-3.5" />
              Documento
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              La ficha con su clasificación, sus versiones anteriores y su
              historial de cambios, en un PDF para adjuntar o imprimir.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <FileDown className="size-4" />
              {exporting ? "Preparando..." : "Exportar ficha en PDF"}
            </Button>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Archivo
            </p>
            {manual.kind === "file" && manual.url ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {manualFileName(manual) ?? "Manual"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {MANUAL_FILE_FORMAT}
                    {manual.size ? ` · ${formatFileSize(manual.size)}` : ""} ·
                    subido el {formatDate(manual.createdAt)}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={manual.url} target="_blank" rel="noreferrer">
                    <Download className="size-4" />
                    Abrir o descargar
                  </a>
                </Button>
              </div>
            ) : manual.kind === "file" ? (
              <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                El archivo de este manual ya no está en el almacén del taller.
                Vuelve a subirlo desde «Editar».
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Es una nota del taller: su contenido es el texto de abajo.
              </p>
            )}
          </div>

          {manual.notes ? (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <NotebookPen className="size-3.5" />
                Nota del taller
              </p>
              <RichText value={manual.notes} className="mt-2" />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Este manual no lleva nota del taller.
            </p>
          )}

          {manual.history.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <History className="size-3.5" />
                Historial de cambios
              </p>
              <ol className="mt-3 grid gap-3">
                {manualHistory(manual).map((entry, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-5">
                        {manualChangeSummary(entry, manual.kind)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.at)}
                        {entry.by ? ` · ${entry.by}` : ""}
                      </p>
                      {entry.file && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {entry.url ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="size-3.5" />
                                Versión anterior: {entry.file.fileName}
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Versión anterior: {entry.file.fileName} (ya no
                              está en el almacén)
                            </span>
                          )}
                          {entry.file.size > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(entry.file.size)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
