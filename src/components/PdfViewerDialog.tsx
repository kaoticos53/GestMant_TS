import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadFileFromUrl } from "@/lib/downloadFile";
import {
  PDF_MIME_TYPE,
  pdfPreviewProblem,
  pdfPreviewProblemMessage,
} from "@/lib/pdfPreview";
import { getErrorMessage } from "@/lib/workshop";

export interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dirección del archivo en el almacén. */
  url: string;
  /** Título del documento (cabecera del visor). */
  title: string;
  /** Nombre con el que se descarga. */
  fileName: string;
}

/**
 * Visor de PDF a pantalla casi completa, sin salir de la aplicación. Usa el
 * lector de PDF del propio navegador sobre una copia local del archivo; si no
 * se puede previsualizar, ofrece descargarlo o abrirlo aparte.
 */
export function PdfViewerDialog({
  open,
  onOpenChange,
  url,
  title,
  fileName,
}: PdfViewerDialogProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadFileFromUrl(url, fileName);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-3 p-4 sm:max-w-6xl sm:p-5">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-8">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="truncate">{title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate">{fileName}</span>
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={downloading}
                onClick={() => void handleDownload()}
              >
                {downloading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Descargar
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Abrir en otra pestaña
                </a>
              </Button>
            </span>
          </DialogDescription>
        </DialogHeader>

        {open && <PdfFrame key={url} url={url} title={title} />}
      </DialogContent>
    </Dialog>
  );
}

type FrameState =
  | { status: "loading" }
  | { status: "ready"; objectUrl: string }
  | { status: "error"; message: string };

function PdfFrame({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<FrameState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(
            `No se pudo cargar el archivo (${response.status}).`,
          );
        }
        const received = await response.blob();
        const head = new Uint8Array(
          await received.slice(0, 1024).arrayBuffer(),
        );
        const problem = pdfPreviewProblem(received.size, head);
        if (problem) {
          setState({ status: "error", message: pdfPreviewProblemMessage(problem) });
          return;
        }
        // Se fuerza el tipo: el navegador lo trata siempre como documento PDF.
        const pdf = received.slice(0, received.size, PDF_MIME_TYPE);
        objectUrl = URL.createObjectURL(pdf);
        if (controller.signal.aborted) return;
        setState({ status: "ready", objectUrl });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: getErrorMessage(error) });
      }
    };

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <div
        role="status"
        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border/70 bg-muted/30 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        Cargando el documento…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground"
      >
        <FileText className="size-6" />
        <p className="max-w-md">{state.message}</p>
      </div>
    );
  }

  return (
    <iframe
      src={`${state.objectUrl}#view=FitH`}
      title={`Vista previa de ${title}`}
      className="min-h-0 w-full flex-1 rounded-lg border border-border/70 bg-white"
    />
  );
}
