import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { MAIL_ORIGIN_LABELS, type MailOrigin } from "@/lib/mail";
import { roleBadgeClassName } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Qué correos del taller recibe cada rol.
 *
 * La matriz tiene una columna por cada **origen del correo del taller**, los
 * mismos cuatro de `MAIL_ORIGINS` (`lib/mail`) que apunta el histórico de envíos:
 * el **aviso a quien notificó**, el **aviso interno de una incidencia**, el
 * **resumen semanal** y la **prueba de envío**. Antes solo estaban los dos que se
 * reparten por rol, así que la tarjeta contaba media historia: quien venía a
 * decidir quién recibe qué no veía los dos correos que no se deciden por rol y
 * tenía que deducirlos de la letra pequeña.
 *
 * Las cuatro se enseñan, pero solo dos se tocan:
 *
 * - **El aviso interno de una incidencia** (`mailSettings.incidentRoles`): sale
 *   cuando entra el aviso, cuando se asigna y cuando se cierra.
 * - **El resumen semanal** (`reportSettings.roleKeys`): el mismo ajuste que el
 *   diálogo «Resumen semanal», no una copia; cambiar aquí es cambiar allí.
 * - **El aviso a quien notificó** y la **prueba de envío** tienen destinatario
 *   fijo —la dirección que dejó quien notificó, y la que se escribe en el
 *   servidor de correo— y no se reparten por rol. Van con su destino escrito en
 *   la celda para que la matriz no deje ningún correo fuera, y sin interruptor:
 *   apagarlas no es una decisión de este panel.
 *
 * La cabecera y las filas comparten la misma rejilla (`LA_MATRIZ`), y por eso
 * cada interruptor cae debajo de su encabezado. Antes la cabecera era un `flex`
 * con dos etiquetas de texto y cada fila otra pareja de interruptores, así que el
 * encabezado se quedaba donde le dejaba el ancho de su propia palabra y no
 * apuntaba a nada. En pantallas estrechas no cabe la cabecera, y cada celda lleva
 * su nombre corto debajo.
 *
 * Se guarda con un solo botón y dos escrituras, porque una lista sin la otra
 * dejaría a un rol recibiendo lo que se acaba de quitar.
 */

/** Una columna de la matriz: un origen del correo y quién lo recibe. */
interface MailColumn {
  /** El origen del catálogo: de ahí sale el nombre, para no tenerlo dos veces. */
  origin: MailOrigin;
  /** Qué lista escribe la columna, o `null` si su destinatario no va por rol. */
  list: "incident" | "weekly" | null;
  /** Nombre corto, para cuando la cabecera no cabe (pantallas estrechas). */
  short: string;
  /** Lo que se lee en la celda cuando no hay nada que repartir. */
  fixed?: string;
}

/**
 * Las cuatro columnas, en el orden del catálogo: primero las dos que no se
 * reparten, en medio las dos que sí.
 */
const COLUMNAS: readonly MailColumn[] = [
  {
    origin: "incidencia",
    list: null,
    short: "A quien notificó",
    fixed: "Siempre",
  },
  { origin: "equipo", list: "incident", short: "Aviso interno" },
  { origin: "resumen", list: "weekly", short: "Resumen" },
  { origin: "prueba", list: null, short: "Prueba", fixed: "A demanda" },
];

/**
 * La rejilla de la matriz, en una sola cadena: la usan la cabecera y todas las
 * filas, y es lo que mantiene cada interruptor debajo de su encabezado. La
 * primera pista es el rol, que se lleva lo que sobre; las otras cuatro, una por
 * correo, con el ancho de su interruptor.
 */
const LA_MATRIZ = "md:grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)]";

/**
 * Por qué una columna no se toca. Va en el `title` de la celda y en su etiqueta
 * accesible: un «Siempre» repetido en toda la columna dice que no se configura,
 * pero no dice a quién va.
 */
const DESTINO_FIJO: Partial<Record<MailOrigin, string>> = {
  incidencia:
    "Sale siempre a la dirección que dejó quien notificó: no se reparte por rol.",
  prueba:
    "Solo va a la dirección que se escribe en «Servidor de correo», cuando se pulsa «Enviar prueba».",
};

export function MailAudienceCard() {
  const settings = useQuery(api.mailSettings.settings);
  const roleOptions = useQuery(api.mailSettings.roleOptions);
  const report = useQuery(api.weeklyReport.settings);
  const setIncidentRoles = useMutation(api.mailSettings.setIncidentRoles);
  const saveReport = useMutation(api.weeklyReport.setSettings);

  const [incident, setIncident] = useState<string[] | null>(null);
  const [weekly, setWeekly] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Las dos listas se rellenan en cuanto llegan las consultas, una sola vez:
  // mientras se toca un interruptor no se pisan por un refresco de fondo.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined || report === undefined) {
      return;
    }
    setIncident(settings.incidentRoles);
    setWeekly(report.roleKeys);
    seeded.current = true;
  }, [settings, report]);

  const loading =
    settings === undefined ||
    report === undefined ||
    roleOptions === undefined ||
    incident === null ||
    weekly === null;

  // Roles que existen hoy: uno borrado no vuelve a guardarse en la lista.
  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const incidentKeys = (incident ?? []).filter((key) =>
    knownRoleKeys.includes(key),
  );
  const weeklyKeys = (weekly ?? []).filter((key) =>
    knownRoleKeys.includes(key),
  );

  /** Añade o quita un rol de una de las dos listas, sin repetidos. */
  const toggle = (
    which: "incident" | "weekly",
    key: string,
    checked: boolean,
  ) => {
    const update = (current: string[] | null) => {
      const list = current ?? [];
      if (!checked) return list.filter((item) => item !== key);
      return list.includes(key) ? list : [...list, key];
    };
    if (which === "incident") setIncident(update);
    else setWeekly(update);
  };

  const handleSave = async () => {
    if (report === undefined) return;
    setSaving(true);
    try {
      await setIncidentRoles({ roleKeys: incidentKeys });
      // El resumen conserva su día y su interruptor: aquí solo se cambia quién
      // lo recibe.
      await saveReport({
        enabled: report.enabled,
        weekday: report.weekday,
        roleKeys: weeklyKeys,
      });
      toast.success("Avisos por correo actualizados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (key: string) =>
    roleOptions?.find((option) => option.key === key)?.label ?? key;

  /** La celda de un rol en una columna: su interruptor, o su destino fijo. */
  const cell = (column: MailColumn, option: { key: string; label: string }) => {
    const list = column.list;
    const hint = DESTINO_FIJO[column.origin];
    return (
      <div
        key={column.origin}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 md:w-full md:flex-none"
      >
        {list === null ? (
          <span
            title={hint}
            className="whitespace-nowrap rounded-full border border-border/70 px-2 py-0.5 text-[10px] leading-4 text-muted-foreground"
          >
            <span className="sr-only">{`${MAIL_ORIGIN_LABELS[column.origin]}: ${hint ?? ""} `}</span>
            {column.fixed}
          </span>
        ) : (
          <Switch
            checked={(list === "incident" ? incidentKeys : weeklyKeys).includes(
              option.key,
            )}
            disabled={saving}
            aria-label={`${MAIL_ORIGIN_LABELS[column.origin]} a ${option.label}`}
            onCheckedChange={(checked) => toggle(list, option.key, checked)}
          />
        )}
        {/* El alto es el de dos líneas: «A quien notificó» no cabe en una, y
            sin él las demás etiquetas suben y la fila queda torcida. */}
        <span className="min-h-7 text-center text-[10px] leading-tight text-muted-foreground md:hidden">
          {column.short}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Users className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Avisos por correo por rol
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Quién recibe cada correo del taller, con los cuatro tipos que salen
            de aquí: el <strong>aviso a quien notificó</strong>, el{" "}
            <strong>aviso interno de incidencia</strong> —cuando entra, cuando
            se asigna, también si alguien se la lleva, y cuando se cierra—, el{" "}
            <strong>resumen semanal</strong> y la{" "}
            <strong>prueba de envío</strong>. Los dos del medio se reparten por
            rol; los otros dos tienen destinatario fijo y se enseñan aquí para
            que la matriz no deje ningún correo fuera.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ) : (
        <>
          <div
            className={cn(
              // El borde de las filas se repite aquí, transparente: la rejilla se
              // mide sobre el contenido, y sin él la cabecera cae un píxel a la
              // derecha de sus interruptores.
              "mt-4 hidden items-end gap-x-2 border border-transparent px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid",
              LA_MATRIZ,
            )}
          >
            <span>Rol</span>
            {COLUMNAS.map((column) => (
              <span
                key={column.origin}
                className="text-center text-[10px] leading-4"
              >
                {MAIL_ORIGIN_LABELS[column.origin]}
                {column.list === null && (
                  <span className="mt-0.5 block font-normal normal-case tracking-normal">
                    fijo
                  </span>
                )}
              </span>
            ))}
          </div>
          <ul className="mt-1 grid gap-1.5">
            {(roleOptions ?? []).map((option) => (
              <li
                key={option.key}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 md:grid md:items-center md:gap-x-2 md:gap-y-0",
                  LA_MATRIZ,
                )}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {option.label}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClassName(option.key)}`}
                    >
                      {option.key}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 md:contents">
                  {COLUMNAS.map((column) => cell(column, option))}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 grid gap-1">
            <p className="text-xs leading-5 text-muted-foreground">
              Aviso a quien notificó: sale siempre a la dirección que se dejó en
              el formulario, en cada paso del caso. No depende de ningún rol.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {incidentKeys.length === 0
                ? "Aviso interno de incidencia: nadie por correo. Quien notificó sigue recibiendo el suyo, y la campana del panel no cambia."
                : `Aviso interno de incidencia (alta, asignación y cierre): le llega a ${
                    incidentKeys.length === 1
                      ? "un rol"
                      : `${incidentKeys.length} roles`
                  } (${incidentKeys.map(roleLabel).join(", ")}).`}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {weeklyKeys.length === 0
                ? "Resumen semanal: sin roles, el resumen no se puede enviar a nadie."
                : `Resumen semanal: le llega a ${
                    weeklyKeys.length === 1
                      ? "un rol"
                      : `${weeklyKeys.length} roles`
                  } (${weeklyKeys.map(roleLabel).join(", ")}). Es el mismo ajuste que el del diálogo «Resumen semanal».`}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Prueba de envío: solo a la dirección que se escribe en «Servidor
              de correo», y solo cuando se pulsa «Enviar prueba».
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando..." : "Guardar avisos"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
