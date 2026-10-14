import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  confusablePublicCodeChars,
  formatPublicCode,
  normalizePublicCode,
} from "@/lib/publicCode";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  looksLikeIncidentReference,
} from "@/lib/workshop";
import { useQuery } from "convex/react";
import { CalendarClock, MapPin, Search, Tag, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

/** Lo que se dice cuando lo escrito tiene letras que no caben en un código. */
function confusableNote(chars: string): string {
  const quoted = [...chars].map((char) => `«${char}»`);
  const list =
    quoted.length === 1
      ? `la ${quoted[0]}`
      : `${quoted.slice(0, -1).join(", ")} o ${quoted[quoted.length - 1]}`;
  return quoted.length === 1
    ? `Un código no lleva la ${quoted[0]}: se confunde con el cero o el uno, y por eso se deja fuera. Comprueba lo que has copiado.`
    : `Un código no lleva ${list}: se confunden con el cero o el uno, y por eso se dejan fuera. Comprueba lo que has copiado.`;
}

/**
 * Seguir una incidencia por su código. Es la puerta de quien la notificó sin ser
 * del taller: al avisar recibe un código —«Tu código: A7K2-QX9M»— y con él ve en
 * qué punto va su caso, sin entrar en la cola del taller ni ver nada de nadie más.
 *
 * Por eso aquí no vale la referencia interna («INC-0004»): es un correlativo, y
 * admitirlo dejaría la cola entera al alcance de quien fuera probando números.
 * Quien la notificó no lo tiene: se le da el código, y el código no se puede
 * adivinar. Si alguien teclea una referencia, se le dice con qué se sigue, en vez
 * de «no encontramos nada» —que sería verdad pero no ayuda—.
 *
 * Lo que enseña lo decide el backend (`incidents.byCode`): el recorte de
 * seguimiento, sin notas internas, documentos ni quién dio cada paso. Aquí solo
 * se pinta lo que llega.
 *
 * Se pregunta al enviar el formulario, no en cada letra: lo tecleado no tiene por
 * qué ser un código completo hasta que se pulsa «Consultar». La excepción es
 * llegar con el código ya puesto en la dirección —`?codigo=A7K2QX9M`, como el
 * enlace del correo—, que se consulta solo al abrir.
 */
export function IncidentLookup({
  className,
  initialCode,
}: {
  className?: string;
  /** El código que trae la dirección, si viene. Se consulta al abrir. */
  initialCode?: string | null;
}) {
  // Lo que se ha pedido, no lo que hay en el campo: así escribir después de
  // consultar no cambia el resultado que se está leyendo.
  const [typed, setTyped] = useState(initialCode ?? "");
  const [asked, setAsked] = useState<string | null>(initialCode ?? null);
  const code = asked === null ? null : normalizePublicCode(asked);
  const tracking = useQuery(
    api.incidents.byCode,
    code === null ? "skip" : { code },
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAsked(typed.trim() === "" ? null : typed);
  };

  const status =
    tracking === null || tracking === undefined
      ? null
      : INCIDENT_STATUS_META[tracking.status];
  const confusables = asked === null ? "" : confusablePublicCodeChars(asked);
  // Una referencia interna —«INC-0004», o el número suelto— no es un código, y
  // quien la teclee viene de un correo viejo: se le dice qué es y de dónde sale
  // el código, que es más útil que un «no encontramos nada» o que avisarle de las
  // letras que sobran.
  const referenceTyped =
    asked !== null && code === null && looksLikeIncidentReference(asked);

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="A7K2-QX9M"
          aria-label="Código de la incidencia"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
        />
        <Button type="submit" className="shrink-0 gap-2">
          <Search className="size-4" />
          Consultar
        </Button>
      </form>

      {referenceTyped && (
        <p className="mt-3 text-sm text-muted-foreground">
          Eso parece la referencia del taller, no el código con el que se sigue
          desde fuera: el código no lleva números correlativos. Te lo dieron al
          notificar la incidencia —o te llega por correo cuando el caso cambia
          de estado—, así que pídelo al taller si no lo tienes.
        </p>
      )}

      {!referenceTyped && confusables !== "" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {confusableNote(confusables)}
        </p>
      )}

      {!referenceTyped && confusables === "" && code === null && (
        <p className="mt-3 text-sm text-muted-foreground">
          Escribe el código de la incidencia, el que te dieron al notificarla:
          ocho caracteres como «A7K2-QX9M».
        </p>
      )}

      {code !== null && tracking === undefined && (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {code !== null && tracking === null && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          No encontramos ninguna incidencia con el código{" "}
          <span className="font-mono font-medium text-foreground">
            {formatPublicCode(code)}
          </span>
          . Comprueba el código que te dieron al notificarla.
        </p>
      )}

      {tracking !== null && tracking !== undefined && status !== null && (
        <article className="mt-4 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm">
          <header className="flex flex-wrap items-center gap-2">
            <span className="select-all font-mono text-sm font-semibold text-foreground">
              {tracking.code === null
                ? "Sin código"
                : formatPublicCode(tracking.code)}
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
