import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { roleBadgeClassName } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Qué correos del taller recibe cada rol.
 *
 * Son dos avisos que no se parecen: el **aviso interno de una incidencia**, que
 * sale cuando entra el aviso, cuando se asigna y cuando se cierra, y el
 * **resumen semanal**. Antes cada uno se configuraba por su cuenta —el resumen en
 * su diálogo y el aviso interno no existía—, así que aquí están los dos juntos,
 * con una columna cada uno, para decidir de una vez quién recibe qué.
 *
 * Dos cosas que esta tarjeta no toca:
 *
 * - **El correo a quien notificó** una incidencia: ese sale siempre a la
 *   dirección que dejó en el formulario y no depende de ningún rol.
 * - **El servidor y la clave**: eso es la tarjeta de al lado.
 *
 * La columna del resumen escribe el mismo ajuste que el diálogo «Resumen
 * semanal» (`reportSettings.roleKeys`), no una copia: cambiar aquí es cambiar
 * allí. Se guarda con un solo botón y dos escrituras, porque una lista sin la otra
 * dejaría a un rol recibiendo lo que se acaba de quitar.
 */
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
            Quién recibe cada correo del taller. Son dos avisos distintos: el
            <strong>aviso de incidencia</strong> —cuando entra, cuando se
            asigna, también si alguien se la lleva, y cuando se cierra— y el
            <strong>resumen semanal</strong>. El correo a quien notificó una
            incidencia no se toca desde aquí: sale siempre a la dirección que
            dejó.
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
          <div className="mt-4 hidden items-center justify-between gap-3 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:flex">
            <span>Rol</span>
            <span className="flex gap-8 pr-1">
              <span>Incidencias</span>
              <span>Resumen semanal</span>
            </span>
          </div>
          <ul className="mt-1 grid gap-1.5">
            {(roleOptions ?? []).map((option) => (
              <li
                key={option.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
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
                <div className="flex shrink-0 items-center gap-4">
                  <Switch
                    checked={incidentKeys.includes(option.key)}
                    disabled={saving}
                    aria-label={`Avisos de incidencia a ${option.label}`}
                    onCheckedChange={(checked) =>
                      toggle("incident", option.key, checked)
                    }
                  />
                  <Switch
                    checked={weeklyKeys.includes(option.key)}
                    disabled={saving}
                    aria-label={`Resumen semanal a ${option.label}`}
                    onCheckedChange={(checked) =>
                      toggle("weekly", option.key, checked)
                    }
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 grid gap-1">
            <p className="text-xs leading-5 text-muted-foreground">
              {incidentKeys.length === 0
                ? "Avisos de incidencia: nadie por correo. Quien notificó sigue recibiendo el suyo, y la campana del panel no cambia."
                : `Avisos de incidencia (alta, asignación y cierre): le llegan a ${
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
