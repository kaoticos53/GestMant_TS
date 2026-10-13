import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  normalizeIncidentReference,
} from "@/lib/workshop";
import { useQuery } from "convex/react";
import { CalendarClock, MapPin, Search, Tag, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Seguir una incidencia por su referencia. Es la puerta de quien la notificó sin
 * ser del taller: al avisar recibe un número —«Incidencia INC-0004 registrada»—
 * y con él ve en qué punto va su caso, sin entrar en la cola del taller ni ver
 * nada de nadie más.
 *
 * Lo que enseña lo decide el backend (`incidents.byReference`): el recorte de
 * seguimiento, sin notas internas, documentos ni quién dio cada paso. Aquí solo
 * se pinta lo que llega.
 *
 * Se pregunta al enviar el formulario, no en cada letra: lo tecleado no tiene
 * por qué ser una referencia completa hasta que se pulsa «Consultar».
 */
export function IncidentLookup({ className }: { className?: string }) {
  const [typed, setTyped] = useState("");
  // Lo que se ha pedido, no lo que hay en el campo: así escribir después de
  // consultar no cambia el resultado que se está leyendo.
  const [asked, setAsked] = useState<string | null>(null);
  const reference = asked === null ? null : normalizeIncidentReference(asked);
  const tracking = useQuery(
    api.incidents.byReference,
    reference === null ? "skip" : { reference },
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAsked(typed.trim() === "" ? null : typed);
  };

  const status =
    tracking === null || tracking === undefined
      ? null
      : INCIDENT_STATUS_META[tracking.status];

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="INC-0004"
          aria-label="Referencia de la incidencia"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="submit" className="shrink-0 gap-2">
          <Search className="size-4" />
          Consultar
        </Button>
      </form>

      {asked !== null && reference === null && (
        <p className="mt-3 text-sm text-muted-foreground">
          Escribe el número de la incidencia, el que aparece en «INC-0004».
        </p>
      )}

      {reference !== null && tracking === undefined && (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {reference !== null && tracking === null && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          No encontramos ninguna incidencia con la referencia{" "}
          <span className="font-mono font-medium text-foreground">
            {reference}
          </span>
          . Comprueba el número que te dieron al notificarla.
        </p>
      )}

      {tracking !== null && tracking !== undefined && status !== null && (
        <article className="mt-4 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm">
          <header className="flex flex-wrap items-center gap-2">
            <span className="select-all font-mono text-sm font-semibold text-foreground">
              {tracking.reference}
            </span>
            <Badge variant="outline" className={status.badgeClassName}>
              {status.label}
            </Badge>
          </header>

          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {[tracking.equipmentKind, tracking.model]
              .filter(Boolean)
              .join(" · ") || "Equipo sin identificar"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.description} · notificada{" "}
            {formatDateTime(tracking.reportedAt)}
            {tracking.closedAt !== null &&
              ` · cerrada ${formatDateTime(tracking.closedAt)}`}
          </p>

          <dl className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
            {tracking.serialNumber && (
              <div className="flex items-center gap-1.5">
                <Tag className="size-3.5 shrink-0" />
                <dt className="sr-only">Número de serie</dt>
                <dd>{tracking.serialNumber}</dd>
              </div>
            )}
            {tracking.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <dt className="sr-only">Ubicación</dt>
                <dd>{tracking.location}</dd>
              </div>
            )}
            {(tracking.assigneeName || tracking.workshopAssigneeName) && (
              <div className="flex items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <dt className="sr-only">Quién la lleva</dt>
                <dd>
                  {[tracking.assigneeName, tracking.workshopAssigneeName]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>

          {richDocToPlainText(tracking.description).trim() !== "" && (
            <p className="mt-3 whitespace-pre-line text-sm leading-6">
              {richDocToPlainText(tracking.description)}
            </p>
          )}

          {tracking.history.length > 0 && (
            <ol className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3">
              {tracking.history.map((entry, index) => (
                <li
                  key={`${entry.status}-${entry.at}-${index}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">
                    {INCIDENT_STATUS_META[entry.status].label}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      )}
    </div>
  );
}
