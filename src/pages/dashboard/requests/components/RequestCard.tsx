import {
  Archive,
  Check,
  Clock,
  FileText,
  ImageIcon,
  PackageCheck,
  Paperclip,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import {
  canEditRequest,
  canRequestStep,
  isRequestInMotion,
} from "@/lib/requestFlow";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  formatRelativeTime,
  type Priority,
} from "@/lib/workshop";

import type { RequestDoc } from "../types";
import { attachmentCounts, decisionLine } from "../helpers";

export function RequestCard({
  request,
  compact = false,
  canManage,
  archiving = false,
  onOpen,
  onAssociate,
  onApprove,
  onReject,
  onIssue,
  onArchive,
}: {
  request: RequestDoc;
  /** Tarjeta reducida: para recorrer colas largas de un vistazo. */
  compact?: boolean;
  canManage: boolean;
  /** Esta petición se está mandando al archivo ahora mismo. */
  archiving?: boolean;
  onOpen: () => void;
  onAssociate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onArchive: () => void;
}) {
  const status = STATUS_META[request.status] ?? STATUS_META.pending;
  const priority = PRIORITY_META[request.priority as Priority];
  const units = request.lines.reduce((sum, line) => sum + line.quantity, 0);
  const noReference = request.lines.length === 0;
  const { images, documents } = attachmentCounts(request);

  return (
    <article
      data-row
      className={cn(
        "rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/40",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
            {request.reference}
          </span>
          <Badge variant="outline" className={priority.badgeClassName}>
            {priority.label}
          </Badge>
          <Badge variant="outline" className={status.badgeClassName}>
            <span
              className={cn("size-1.5 rounded-full", status.dotClassName)}
            />
            {status.label}
          </Badge>
          {noReference && (
            <Badge
              variant="outline"
              className="border-amber-500/25 bg-amber-500/10 text-amber-700"
            >
              <Wrench className="size-3" />
              Sin repuesto
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-base font-semibold tracking-tight">
          {request.requesterName}
          {request.requesterTeam && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {request.requesterTeam}
            </span>
          )}
        </p>
        {request.equipment && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Equipo afectado: {request.equipment}
          </p>
        )}
      </div>

      {request.description && (
        <RichText
          value={request.description}
          className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80 [&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:object-contain"
        />
      )}

      {request.lines.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {request.lines.map((line) => (
            <li
              key={line.sparePartId}
              className="flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono font-medium">{line.code}</span>
              <span className="max-w-[14ch] truncate text-muted-foreground sm:max-w-[24ch]">
                {line.name}
              </span>
              <span className="font-semibold tabular-nums">
                ×{line.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}

      {noReference && canEditRequest(request.status) && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-800">
          <Wrench className="mt-0.5 size-3.5 shrink-0" />
          Petición sin repuesto: investiga el proveedor y su nº de parte antes
          de aprobar.
        </p>
      )}

      {request.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
            <Paperclip className="size-3.5" />
            {request.attachments.length} adjuntos
          </span>
          {images > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
              <ImageIcon className="size-3.5" />
              {images} fotos
            </span>
          )}
          {documents > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
              <FileText className="size-3.5" />
              {documents} documentos
            </span>
          )}
        </div>
      )}

      {request.notes && (
        // La nota la escribe el editor, así que se pinta con su formato: las
        // comillas eran el adorno de las notas de texto plano.
        <RichText
          value={request.notes}
          className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm italic leading-6 text-muted-foreground"
        />
      )}

      {request.status !== "pending" && decisionLine(request) !== "" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {decisionLine(request)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <span className="text-xs text-muted-foreground">
          {noReference
            ? "Sin repuestos asociados"
            : `${request.lines.length} líneas · ${units} unidades`}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
            Ver detalle
          </Button>
          {canManage && canRequestStep(request.status, "reject") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReject}
            >
              Rechazar
            </Button>
          )}
          {/* Aprobar y asociar el repuesto van juntos, y desde donde deja la
              máquina: pendiente o con el material ya recibido. */}
          {canManage &&
            canRequestStep(request.status, "approve") &&
            (noReference ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={onAssociate}
              >
                <Wrench className="size-3.5" />
                Asociar repuesto
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={onApprove}
              >
                <Check className="size-3.5" />
                Aprobar
              </Button>
            ))}
          {canManage && canRequestStep(request.status, "issue") && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={onIssue}
            >
              <PackageCheck className="size-3.5" />
              Entregar material
            </Button>
          )}
          {/* El archivo es solo para lo ya terminado: lo que sigue en movimiento
              —pendiente o en espera— no se archiva, ni a mano ni por la noche. */}
          {canManage && !isRequestInMotion(request.status) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              title={`Mandar ${request.reference} al archivo`}
              aria-label={`Archivar ${request.reference}`}
              disabled={archiving}
              onClick={onArchive}
            >
              <Archive className="size-3.5" />
              Archivar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Diálogo de aprobación / rechazo                                     */
/* ------------------------------------------------------------------ */

/**
 * Las decisiones que llevan motivo: aprobar, rechazar, entregar, poner en
 * espera, devolver el material y cancelar. Todas se escriben igual —el motivo,
 * con el editor— y solo cambian de rótulo y de lo que pasa después.
 */
