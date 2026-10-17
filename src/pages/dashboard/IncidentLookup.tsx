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
import { isIncidentInWorkshop } from "@/lib/incidentFlow";
import {
  PENDING_PARTS_UNSPECIFIED,
  TRACKING_STATUS_NOTE,
  pendingPartWait,
  pendingPartsOldest,
  trackingAgeNote,
  type PendingPart,
} from "@/lib/incidentTracking";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  formatRelativeTime,
  getErrorMessage,
  incidentStatusLabel,
  looksLikeIncidentReference,
} from "@/lib/workshop";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  PackageSearch,
  Search,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

/** Lo que devuelve el seguimiento: la ficha recortada del caso consultado. */
type Tracking = NonNullable<FunctionReturnType<typeof api.incidents.byCode>>;

/** Lo que dejó una consulta: el seguimiento —o su ausencia—, o el motivo del no. */
type LookupOutcome =
  { ok: true; tracking: Tracking | null } | { ok: false; error: string };

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
 * Un dato de la ficha, con su nombre a la vista.
 *
 * El nombre va escrito y no escondido en un `sr-only` porque esta ficha la lee
 * gente que no conoce el taller: un icono de etiqueta junto a «HDC3500-2505-0147»
 * no dice si es el número de serie o la referencia, y quien consulta su caso no
 * tiene por qué adivinarlo.
 */
function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  );
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
 *
 * Cada consulta se pide una vez y se guarda el resultado —no es una suscripción—
 * porque cada una cuenta: la puerta admite treinta consultas por hora y código
 * (`lib/publicLookup`), y el freno llega como error con lo que falta para que
 * vuelva, que es lo que se enseña tal cual.
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
  // El resultado se guarda porque la consulta ya no es una suscripción: `null` es
  // «no hay ninguna» y `undefined`, «todavía consultando».
  const [tracking, setTracking] = useState<Tracking | null | undefined>(
    undefined,
  );
  // Cuándo llegó lo que se está leyendo. Las cuentas de tiempo de la ficha se
  // hacen contra este momento y no contra el de pintarla: si se preguntara la
  // hora en el render, el resultado dependería de cuándo repinta React, que es
  // justo lo que una pantalla no debe decidir (y el linter lo prohíbe).
  const [arrivedAt, setArrivedAt] = useState(0);
  // El freno de la puerta —o cualquier error del backend—, tal y como se cuenta.
  const [failure, setFailure] = useState<string | null>(null);
  // Cada consulta lleva su número: si llegan dos respuestas seguidas, la que ya no
  // es la última se descarta en vez de pisar lo que se está leyendo.
  const latest = useRef(0);
  const consultar = useMutation(api.incidents.byCode);
  const code = asked === null ? null : normalizePublicCode(asked);

  // Pide el seguimiento y devuelve qué ha pasado, sin tocar el estado: quien lo
  // pinta es quien sabe en qué orden van las respuestas. Va aparte del formulario
  // porque la consulta de la dirección arranca al montar, y entonces el estado se
  // escribe al llegar la respuesta, no antes.
  const pedir = useCallback(
    async (found: string): Promise<LookupOutcome> => {
      try {
        return { ok: true, tracking: await consultar({ code: found }) };
      } catch (error) {
        // Agotado el cupo, el backend contesta cuánto falta: se enseña su texto y
        // no un «no encontramos ninguna», que mandaría a revisar el código cuando
        // lo que pasa es que hay que esperar.
        return { ok: false, error: getErrorMessage(error) };
      }
    },
    [consultar],
  );

  // Deja en pantalla lo que llegó…
  const guardar = useCallback((request: number, outcome: LookupOutcome) => {
    // …si sigue siendo la última consulta pedida: una respuesta que llega tarde no
    // pisa lo que ya se está leyendo.
    if (latest.current !== request) return;
    if (outcome.ok) {
      setTracking(outcome.tracking);
      setArrivedAt(Date.now());
    } else {
      setFailure(outcome.error);
      setTracking(null);
    }
  }, []);

  const buscar = useCallback(
    async (value: string) => {
      const found = normalizePublicCode(value);
      if (found === null) return;
      setTracking(undefined);
      setFailure(null);
      latest.current += 1;
      const request = latest.current;
      guardar(request, await pedir(found));
    },
    [guardar, pedir],
  );

  // El código que trae la dirección se consulta solo al abrir, y una sola vez: el
  // enlace del correo no puede gastar dos consultas por pintar la pantalla dos
  // veces (React vuelve a montar en desarrollo).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const found = normalizePublicCode(initialCode);
    if (found === null) return;
    latest.current += 1;
    const request = latest.current;
    void pedir(found).then((outcome) => guardar(request, outcome));
  }, [guardar, initialCode, pedir]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = typed.trim();
    setAsked(value === "" ? null : value);
    setFailure(null);
    setTracking(undefined);
    // Lo que no tiene forma de código no llega a ser una consulta: no gasta cupo y
    // se explica qué falta (una letra que se confunde, una referencia interna…).
    if (value !== "") void buscar(value);
  };

  const status =
    tracking === null || tracking === undefined
      ? null
      : INCIDENT_STATUS_META[tracking.status];
  // Esperar repuestos o estar en reparación no dice dónde está el equipo: eso lo
  // cuenta la entrada a taller, que el seguimiento también trae.
  const statusLabel =
    tracking === null || tracking === undefined
      ? null
      : incidentStatusLabel(
          tracking.status,
          isIncidentInWorkshop({
            status: tracking.status,
            workshopAssigneeName: tracking.workshopAssigneeName ?? undefined,
          }),
        );
  // Lo que acompaña a los datos: qué significa el estado, cuánto lleva el caso y
  // desde cuándo está en este punto. El paso a paso trae las fechas, y la última
  // entrada es el estado que se está leyendo; si solo hay una, esa es la misma
  // notificación y decir «en este punto desde…» repetiría la fecha de arriba.
  const ageNote =
    tracking === null || tracking === undefined
      ? null
      : trackingAgeNote({
          reportedAt: tracking.reportedAt,
          closedAt: tracking.closedAt,
          now: arrivedAt,
        });
  const currentSince =
    tracking !== null &&
    tracking !== undefined &&
    tracking.closedAt === null &&
    tracking.history.length > 1
      ? tracking.history[tracking.history.length - 1].at
      : null;
  const description =
    tracking === null || tracking === undefined
      ? ""
      : richDocToPlainText(tracking.description).trim();
  // Lo que falta, en concreto: los repuestos que el caso espera, con su cantidad
  // y desde cuándo. La ficha los enseña sin abrir la petición, y sin nada de la
  // petición que sea del taller —referencia, proveedor, precio—.
  //
  // Se admite que el campo no venga: una pestaña abierta con el panel de antes
  // puede preguntar a un backend que todavía no lo devuelve, y la ficha de
  // seguimiento —que es pública— no puede romperse por el orden de un despliegue.
  const pendingParts: PendingPart[] =
    tracking === null || tracking === undefined
      ? []
      : (tracking.pendingParts ?? []);
  // Un caso cerrado ya no espera nada: si quedó una petición viva por descuido,
  // no se enseña como pendiente en una ficha que dice que está cerrada.
  const missingParts =
    tracking !== null && tracking !== undefined && tracking.closedAt === null
      ? pendingParts
      : [];
  const oldestPending = pendingPartsOldest(missingParts);
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

      {failure !== null && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground"
        >
          {failure}
        </p>
      )}

      {code !== null && tracking === null && failure === null && (
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
              {statusLabel}
            </Badge>
          </header>

          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {[tracking.equipmentKind, tracking.model]
              .filter(Boolean)
              .join(" · ") || "Equipo sin identificar"}
          </h3>
          {/* Qué significa el estado, en palabras de quien consulta y no del
              taller: el nombre del estado solo no explica si hay que esperar. */}
          <p className="mt-1 text-sm leading-6">
            {TRACKING_STATUS_NOTE[tracking.status]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ageNote}
            {currentSince !== null &&
              ` En este punto desde ${formatRelativeTime(currentSince)}.`}
          </p>

          {/* Qué falta, de forma concreta: el nombre del estado dice que se
              espera material, pero no qué material ni desde cuándo. */}
          {missingParts.length > 0 ? (
            <section className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <PackageSearch className="size-3.5 shrink-0" aria-hidden />
                Repuestos pendientes
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5">
                {missingParts.map((part, index) => (
                  <li
                    key={`${part.since}-${index}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm text-amber-900"
                  >
                    <span>
                      <span className="font-semibold tabular-nums">
                        {part.quantity} ×
                      </span>{" "}
                      {part.name}
                    </span>
                    <span className="text-xs text-amber-800/80">
                      {pendingPartWait(part.since, arrivedAt)}
                    </span>
                  </li>
                ))}
              </ul>
              {oldestPending !== null && (
                <p className="mt-2 text-xs text-amber-800/80">
                  {missingParts.length === 1
                    ? "Se pidió el"
                    : "El más antiguo se pidió el"}{" "}
                  {formatDateTime(oldestPending)}.
                </p>
              )}
            </section>
          ) : (
            tracking.status === "waitingParts" &&
            tracking.closedAt === null && (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
                {PENDING_PARTS_UNSPECIFIED}
              </p>
            )
          )}

          <dl className="mt-4 grid gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
            <Detail icon={CalendarClock} label="Notificada">
              {formatDateTime(tracking.reportedAt)}
            </Detail>
            {tracking.closedAt !== null && (
              <Detail icon={CheckCircle2} label="Cerrada">
                {formatDateTime(tracking.closedAt)}{" "}
                <span className="text-muted-foreground">
                  ({formatRelativeTime(tracking.closedAt)})
                </span>
              </Detail>
            )}
            {tracking.location && (
              <Detail icon={MapPin} label="Ubicación">
                {tracking.location}
              </Detail>
            )}
            {tracking.serialNumber && (
              <Detail icon={Tag} label="Número de serie">
                <span className="font-mono">{tracking.serialNumber}</span>
              </Detail>
            )}
            {(tracking.assigneeName || tracking.workshopAssigneeName) && (
              <Detail icon={UserRound} label="Quién la lleva">
                {[tracking.assigneeName, tracking.workshopAssigneeName]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            )}
          </dl>

          {description !== "" && (
            <section className="mt-4">
              <h4 className="text-xs font-medium text-muted-foreground">
                Lo que se avisó
              </h4>
              <p className="mt-1 whitespace-pre-line text-sm leading-6">
                {description}
              </p>
            </section>
          )}

          {tracking.history.length > 0 && (
            <section className="mt-4 border-t border-border/70 pt-3">
              <h4 className="text-xs font-medium text-muted-foreground">
                Cómo ha avanzado
              </h4>
              <ol className="mt-2 flex flex-col gap-2">
                {tracking.history.map((entry, index) => (
                  <li
                    key={`${entry.status}-${entry.at}-${index}`}
                    className="flex flex-wrap items-center gap-x-2 text-xs"
                  >
                    <CalendarClock
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="font-medium">
                      {INCIDENT_STATUS_META[entry.status].label}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(entry.at)} ·{" "}
                      {formatRelativeTime(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Un seguimiento no es el expediente: decirlo aquí evita que quien
              consulta su caso crea que el taller le está ocultando algo. */}
          <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            Este es el resumen que se puede consultar con el código: las notas
            internas, los documentos y quién dio cada paso se quedan en el
            taller.
          </p>
        </article>
      )}
    </div>
  );
}
