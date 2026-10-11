import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { TrashItem } from "@/convex/trash";
import {
  AFTER_MONTHS_OPTIONS,
  DEFAULT_AFTER_MONTHS,
  afterMonthsLabel,
  archivableBefore,
} from "@/lib/archive";
import { monthsAgo } from "@/lib/browse";
import {
  CLEANUP_PASS_META,
  cleanupCount,
  cleanupUnreadableLabel,
  cleanupTicketsLabel,
} from "@/lib/cleanupLog";
import { roleBadgeClassName } from "@/lib/roles";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  trashRemainingLabel,
} from "@/lib/trash";
import { cn } from "@/lib/utils";
import {
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  File,
  FileClock,
  ImageOff,
  Moon,
  Play,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type IncidentDoc = Doc<"incidents">;
type RequestDoc = Doc<"partRequests">;

/**
 * Ajustes del taller: los ajustes de fondo que decide quien los gobierna, en
 * una sola pantalla. Antes vivían repartidos —el archivado automático dentro
 * del módulo Archivo, el aviso de trabajo sin constancia en un diálogo de la
 * cabecera y los avisos del expediente sin poder ajustarse—, así que quien
 * venía a configurar el taller tenía que saber en qué módulo estaba cada cosa.
 *
 * Aquí solo se ajusta, no se trabaja: el módulo Archivo sigue siendo donde se
 * busca lo archivado y se manda al archivo a mano, el aviso de trabajo sigue
 * saliendo en el panel y los avisos del expediente, en el avisador. Cada
 * tarjeta se enseña solo a quien puede configurarla.
 */
export function WorkshopSettingsView({
  incidents = [],
  requests = [],
  canManageArchive = false,
  canManageAlert = false,
  canManageAudit = false,
  canPurgeUploads = false,
}: {
  /** Cola viva de incidencias: con ella se cuenta lo que archiva el automático. */
  incidents?: IncidentDoc[];
  /** Cola viva de peticiones: lo mismo, para el archivado automático. */
  requests?: RequestDoc[];
  /** Quien coordina incidencias o decide peticiones ajusta el archivo. */
  canManageArchive?: boolean;
  /** Quien coordina las incidencias ajusta el aviso de trabajo sin constancia. */
  canManageAlert?: boolean;
  /** Quien audita el expediente reparte sus avisos entre los roles. */
  canManageAudit?: boolean;
  /**
   * Quien gobierna el taller mira —y purga— lo que la noche va a barrer del
   * formulario, y ve la limpieza del almacén entera con su botón.
   */
  canPurgeUploads?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {canManageArchive && (
        <AutomaticArchiveCard incidents={incidents} requests={requests} />
      )}
      {canPurgeUploads && <UnusedUploadsCard />}
      {canPurgeUploads && <TrashCard />}
      {canPurgeUploads && <StorageCleanupCard />}
      {canManageAlert && <WorkAlertSettingsCard />}
      {canManageAudit && <AuditAlertSettingsCard />}
      <p className="text-xs leading-5 text-muted-foreground">
        Estas son las reglas de fondo del taller. El día a día —buscar en el
        archivo, recuperar lo archivado, trabajar las incidencias— sigue en sus
        módulos.
      </p>
    </div>
  );
}

/**
 * Archivado automático: la pasada que hace el taller cada noche. Se ajusta con
 * los dos controles de arriba (encendido y antigüedad) y se puede adelantar con
 * «Ejecutar ahora», que usa la misma antigüedad guardada. Cuántas fichas
 * entrarían se cuenta con la regla compartida (`lib/archive`), la misma que
 * aplica la pasada de la noche.
 */
function AutomaticArchiveCard({
  incidents,
  requests,
}: {
  incidents: IncidentDoc[];
  requests: RequestDoc[];
}) {
  const settings = useQuery(api.archive.settings);
  const saveSettings = useMutation(api.archive.setSettings);
  const runNow = useMutation(api.archive.runNow);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Antigüedad guardada; mientras carga vale la de partida.
  const autoMonths = settings?.afterMonths ?? DEFAULT_AFTER_MONTHS;
  const autoCutoff = monthsAgo(autoMonths);
  const pending = archivableBefore({
    incidents,
    requests,
    before: autoCutoff,
  });
  // El valor guardado manda: el selector enseña lo que hay, aunque no sea una
  // de las antigüedades habituales.
  const autoOptions = AFTER_MONTHS_OPTIONS.some(
    (option) => option.months === autoMonths,
  )
    ? AFTER_MONTHS_OPTIONS
    : [
        { months: autoMonths, label: afterMonthsLabel(autoMonths) },
        ...AFTER_MONTHS_OPTIONS,
      ];

  /** Guarda el automático (interruptor y antigüedad van juntos). */
  const handleSaveSettings = async (next: {
    enabled: boolean;
    afterMonths: number;
  }) => {
    setSaving(true);
    try {
      await saveSettings(next);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /** Limpieza inmediata con la antigüedad configurada, sin esperar la noche. */
  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      toast.success(
        result.total === 0
          ? "No había nada terminado tan antiguo"
          : `${result.incidents} ${result.incidents === 1 ? "incidencia" : "incidencias"} y ${result.requests} ${result.requests === 1 ? "petición" : "peticiones"} al archivo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <Moon className="size-4" />
          </span>
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight">
              Archivado automático
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Cada noche el taller manda solo al archivo lo que ya está
              terminado —incidencias cerradas y peticiones ya decididas—
              anterior a la antigüedad elegida. No se borra nada: todo sigue en
              el módulo Archivo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              (settings?.enabled ?? true)
                ? "text-signal"
                : "text-muted-foreground",
            )}
          >
            {settings === undefined
              ? "Cargando..."
              : settings.enabled
                ? "Activado"
                : "Desactivado"}
          </span>
          <Switch
            checked={settings?.enabled ?? true}
            disabled={settings === undefined || saving}
            aria-label="Archivado automático de cada noche"
            onCheckedChange={(checked) =>
              void handleSaveSettings({
                enabled: checked,
                afterMonths: autoMonths,
              })
            }
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label
            htmlFor="ajustes-archivo-antiguedad"
            className="text-xs text-muted-foreground"
          >
            Antigüedad
          </Label>
          <Select
            value={String(autoMonths)}
            disabled={settings === undefined || saving}
            onValueChange={(value) =>
              void handleSaveSettings({
                enabled: settings?.enabled ?? true,
                afterMonths: Number(value),
              })
            }
          >
            <SelectTrigger id="ajustes-archivo-antiguedad" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {autoOptions.map((option) => (
                <SelectItem key={option.months} value={String(option.months)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={running || settings === undefined}
          onClick={() => void handleRunNow()}
        >
          <Play className="size-4" />
          {running
            ? "Archivando..."
            : pending.total > 0
              ? `Ejecutar ahora (${pending.total})`
              : "Ejecutar ahora"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {(settings?.enabled ?? true)
          ? `Corte automático: anterior al ${formatDate(autoCutoff)}`
          : "El automático está apagado: mientras siga así, solo se archiva cuando lo pidas desde el módulo Archivo."}
        {settings?.lastRunAt
          ? ` · última limpieza automática ${formatDateTime(settings.lastRunAt)} (${settings.lastRunArchived ?? 0} ${
              (settings.lastRunArchived ?? 0) === 1 ? "ficha" : "fichas"
            })`
          : " · sin limpiezas automáticas todavía"}
      </p>
    </div>
  );
}

/**
 * Aviso de trabajo sin constancia: con qué margen avisa (días en curso sin una
 * sola nota del técnico) y a qué roles les llega. El panel usa estos ajustes
 * para decidir a quién se lo enseña; aquí se cambian sin tener que esperar a
 * que haya algo parado que avisar. El «Guardar aviso» es a propósito: son dos
 * campos que se piensan juntos, a diferencia del interruptor del archivado.
 */
function WorkAlertSettingsCard() {
  const settings = useQuery(api.alerts.settings);
  const roleOptions = useQuery(api.alerts.roleOptions);
  const saveSettings = useMutation(api.alerts.setSettings);

  const [days, setDays] = useState(String(MIN_WORK_WITHOUT_TRACE_DAYS));
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse
  // por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    setRoleKeys(settings.roleKeys);
    seeded.current = true;
  }, [settings]);

  const value = Number(days);
  const daysValid =
    days.trim() !== "" &&
    Number.isInteger(value) &&
    value >= MIN_WORK_WITHOUT_TRACE_DAYS &&
    value <= MAX_WORK_WITHOUT_TRACE_DAYS;

  // Roles que existen hoy: un rol borrado no vuelve a guardarse en la lista.
  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const audience = roleKeys.filter((key) => knownRoleKeys.includes(key));

  const toggleRole = (key: string, checked: boolean) =>
    setRoleKeys((current) =>
      checked
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((item) => item !== key),
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({ days: value, roleKeys: audience });
      toast.success("Aviso actualizado");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <BellRing className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Aviso de trabajo sin constancia
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            El panel avisa de las incidencias que llevan días en curso sin que
            quien las trabaja haya escrito una sola nota: trabajo que avanza sin
            dejar rastro en el cuaderno. Aquí decides con cuántos días avisa y a
            qué roles les llega.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="ajustes-aviso-margen" className="text-sm">
          Margen sin constancia (días)
        </Label>
        <Input
          id="ajustes-aviso-margen"
          type="number"
          inputMode="numeric"
          min={MIN_WORK_WITHOUT_TRACE_DAYS}
          max={MAX_WORK_WITHOUT_TRACE_DAYS}
          step={1}
          value={days}
          disabled={settings === undefined || saving}
          onChange={(event) => setDays(event.target.value)}
          className="w-28"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          {daysValid
            ? `Avisa cuando una incidencia lleve ${value} ${
                value === 1 ? "día" : "días"
              } o más en curso sin que su técnico anote nada.`
            : `Escribe un número entero de días entre ${MIN_WORK_WITHOUT_TRACE_DAYS} y ${MAX_WORK_WITHOUT_TRACE_DAYS}.`}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-sm">A qué roles les avisa</Label>
          <p className="text-xs leading-5 text-muted-foreground">
            El aviso es un reparto, no un permiso: quien esté en esta lista lo
            ve, coordine incidencias o no. Abrir la ficha que señala sigue
            dependiendo de los permisos de cada rol.
          </p>
        </div>
        {roleOptions === undefined ? (
          <div className="grid gap-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        ) : (
          <ul className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
            {roleOptions.map((option) => (
              <li
                key={option.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
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
                <Switch
                  checked={roleKeys.includes(option.key)}
                  disabled={saving}
                  aria-label={`Avisar a ${option.label}`}
                  onCheckedChange={(checked) => toggleRole(option.key, checked)}
                />
              </li>
            ))}
          </ul>
        )}
        {roleOptions !== undefined && (
          <p className="text-xs leading-5 text-muted-foreground">
            {audience.length === 0
              ? "Sin ningún rol marcado el aviso no se lo enseña a nadie."
              : `Le llega a ${
                  audience.length === 1 ? "un rol" : `${audience.length} roles`
                }: ${audience
                  .map(
                    (key) =>
                      roleOptions.find((option) => option.key === key)?.label ??
                      key,
                  )
                  .join(", ")}.`}
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={
            saving ||
            settings === undefined ||
            roleOptions === undefined ||
            !daysValid
          }
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando..." : "Guardar aviso"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Avisos de auditoría del expediente: a qué roles les llegan los movimientos
 * que no deben pasar desapercibidos —un documento retirado, cuya retirada es la
 * única constancia que queda de él, o cualquier cambio en el expediente de una
 * incidencia ya cerrada—. El reparto es una lista, no un permiso: quien esté en
 * ella los recibe aunque no audite, y el rastro completo lo sigue leyendo quien
 * tenga el módulo de Auditoría.
 *
 * Es la tarjeta hermana de la del aviso de trabajo sin constancia, y a
 * propósito se guarda igual: con un «Guardar» y no con interruptores sueltos,
 * porque la lista se piensa entera. Aquí no hay margen que ajustar: el aviso no
 * depende del tiempo.
 */
function AuditAlertSettingsCard() {
  const settings = useQuery(api.auditAlerts.settings);
  const roleOptions = useQuery(api.auditAlerts.roleOptions);
  const saveAudience = useMutation(api.auditAlerts.setAudience);

  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse
  // por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setRoleKeys(settings.roleKeys);
    seeded.current = true;
  }, [settings]);

  // Roles que existen hoy: un rol borrado no vuelve a guardarse en la lista.
  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const audience = roleKeys.filter((key) => knownRoleKeys.includes(key));

  const toggleRole = (key: string, checked: boolean) =>
    setRoleKeys((current) =>
      checked
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((item) => item !== key),
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAudience({ roleKeys: audience });
      toast.success("Avisos del expediente actualizados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FileClock className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Avisos de auditoría del expediente
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            El avisador recoge los movimientos del expediente que no deben pasar
            desapercibidos: un documento retirado y cualquier cambio en el
            expediente de una incidencia ya cerrada. Un alta o una edición al
            día no avisan a nadie. Aquí decides a qué roles les llegan.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-sm">A qué roles les llegan</Label>
          <p className="text-xs leading-5 text-muted-foreground">
            El aviso es un reparto, no un permiso: quien esté en esta lista lo
            recibe, audite el expediente o no. El rastro completo lo sigue
            leyendo quien tenga el módulo de Auditoría.
          </p>
        </div>
        {roleOptions === undefined ? (
          <div className="grid gap-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        ) : (
          <ul className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
            {roleOptions.map((option) => (
              <li
                key={option.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
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
                <Switch
                  checked={roleKeys.includes(option.key)}
                  disabled={saving}
                  aria-label={`Avisar a ${option.label} de los movimientos del expediente`}
                  onCheckedChange={(checked) => toggleRole(option.key, checked)}
                />
              </li>
            ))}
          </ul>
        )}
        {roleOptions !== undefined && (
          <p className="text-xs leading-5 text-muted-foreground">
            {audience.length === 0
              ? "Sin ningún rol marcado estos movimientos no le avisan a nadie: quedan solo en el rastro del módulo de Auditoría."
              : `Le llega a ${
                  audience.length === 1 ? "un rol" : `${audience.length} roles`
                }: ${audience
                  .map(
                    (key) =>
                      roleOptions.find((option) => option.key === key)?.label ??
                      key,
                  )
                  .join(", ")}.`}
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={
            saving || settings === undefined || roleOptions === undefined
          }
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando..." : "Guardar avisos"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Imágenes del formulario público que nadie llegó a usar: el aviso se quedó a
 * medias y su foto no la cita ninguna incidencia. La limpieza de la madrugada se
 * las lleva pasada su ventana de cortesía —un día entero sin que nadie las
 * mencione—, y aquí se ven antes de que se las lleve, con la opción de barrerlas
 * ya: es lo que quiere quien está mirando el almacén del taller.
 *
 * La tarjeta enseña exactamente lo que la pasada de la noche se llevaría —la
 * misma cuenta que hace la limpieza, leída antes de borrar—, así que la lista y
 * el botón no prometen nada que la pasada no fuera a hacer igual. Lo que se
 * acaba de subir no aparece: todavía puede acabar en un aviso que alguien está
 * escribiendo.
 */
function UnusedUploadsCard() {
  const pending = useQuery(api.reportUploads.unusedImages);
  const purgeUnused = useMutation(api.reportUploads.purgeUnused);
  // El plazo de la papelera lo ajusta el taller; mientras carga vale el de
  // partida, que es lo que la propia limpieza haría sin ajuste guardado.
  const trashSettings = useQuery(api.trash.settings);
  const retentionDays = trashSettings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  const images = pending?.images ?? [];
  const tickets = pending?.tickets ?? 0;
  // Vales cuyo archivo el almacén ya no puede leer: se van en la misma pasada,
  // pero no son imágenes ni dejan nada en la papelera.
  const unreadable = pending?.unreadable ?? 0;
  const total = images.length + tickets + unreadable;
  // Lo pendiente, en una línea: cuántas fotos, cuánto ocupan, y lo que se va con
  // ellas (los vales sin archivo no son imágenes, pero se van en la misma pasada).
  const summary = [
    `${images.length} ${images.length === 1 ? "imagen" : "imágenes"} (${formatFileSize(
      pending?.totalBytes ?? 0,
    )})`,
    tickets > 0
      ? `${tickets} ${tickets === 1 ? "vale" : "vales"} sin archivo`
      : null,
    unreadable > 0 ? cleanupUnreadableLabel(unreadable) : null,
    pending?.partial ? "la limpieza va por tandas" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  const handlePurge = async () => {
    setPurging(true);
    try {
      const result = await purgeUnused();
      // Lo purgado no se pierde: queda en la papelera con su plazo por delante.
      const parts = [
        result.images > 0 ? cleanupCount("reportUploads", result.images) : null,
        result.tickets > 0 ? cleanupTicketsLabel(result.tickets) : null,
      ].filter((part): part is string => part !== null);
      // Y lo que no se puede leer no deja nada: se dice aparte para no contarlo
      // entre lo que se guarda.
      const messages = [
        parts.length > 0
          ? `A la papelera: ${parts.join(" y ")}${
              result.bytes > 0 ? ` (${formatFileSize(result.bytes)})` : ""
            }`
          : null,
        result.unreadable > 0
          ? `${cleanupUnreadableLabel(result.unreadable)}, que no dejan nada`
          : null,
      ].filter((part): part is string => part !== null);
      toast.success(
        messages.length === 0
          ? "No había nada que purgar"
          : messages.join(" · "),
      );
      setConfirming(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageOff className="size-4" />
        </span>
        <div className="max-w-xl">
          <p className="text-sm font-semibold tracking-tight">
            Imágenes del formulario sin usar
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Las fotos que llegan por el formulario público y que ninguna
            incidencia cita: el aviso se quedó a medias. La limpieza de la
            madrugada se las lleva pasada su ventana de cortesía —un día entero
            sin que nadie las use—; aquí las ves antes y las puedes purgar de
            una vez. Unos minutos antes de que pase, la campana avisa con lo que
            hay pendiente, para que no te enteres cuando ya no estén.
          </p>
        </div>
      </div>

      {pending === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          No hay nada pendiente: la limpieza de esta noche no tiene nada que
          barrer del formulario. Una foto que se suba y nadie cite aparecerá
          aquí al día siguiente, cuando cumpla su ventana.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {summary}
          </p>

          {unreadable > 0 && (
            // Lo que no se puede leer no tiene miniatura que enseñar —por eso no
            // está en la lista de abajo—, así que se explica: es un vale que
            // sigue ahí y un archivo que ya no.
            <p className="mt-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {`${cleanupUnreadableLabel(
                unreadable,
              )}: el vale sigue aquí, pero el archivo ya no está en el almacén. La pasada se lleva el vale —ya no sirve para nada— y lo cuenta aparte, sin hacerlo pasar por una imagen.`}
            </p>
          )}

          {images.length > 0 && (
            // Las imágenes de la tanda, como grupo: si lo que falla es la
            // dirección pública —lo mismo para todas—, el porqué se dice una vez
            // y no una vez por foto.
            <AttachmentGroup>
              <ul className="mt-3 grid gap-2">
                {images.map((image) => (
                  <li
                    key={image.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-2"
                  >
                    {/* La miniatura lleva dentro el mismo aviso que un adjunto
                        roto: si su dirección no llega —o el archivo ya no está
                        en el almacén—, en vez del icono de respaldo se lee por
                        qué; con varias fotos a la vez, el porqué va arriba, una
                        sola vez. */}
                    <AttachmentImage
                      url={image.url}
                      name=""
                      layout="row"
                      frameClassName="size-10 shrink-0 overflow-hidden rounded-md border border-border/70"
                      imageClassName="size-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-sm">
                        Subida el {formatDateTime(image.uploadedAt)}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {formatFileSize(image.size)} · sin citar en ninguna
                        incidencia
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </AttachmentGroup>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={purging}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" />
              {`Purgar ahora (${total})`}
            </Button>
          </div>
        </>
      )}

      <ManualPurgeLog />

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Purgar sin esperar a la noche</DialogTitle>
              <DialogDescription>
                {`Se retirarán ${images.length} ${
                  images.length === 1 ? "imagen" : "imágenes"
                } (${formatFileSize(pending?.totalBytes ?? 0)})`}
                {tickets > 0
                  ? ` y ${tickets} ${tickets === 1 ? "vale" : "vales"} sin archivo`
                  : ""}
                {unreadable > 0
                  ? `, y ${cleanupUnreadableLabel(
                      unreadable,
                    )}, que se irán sin dejar nada en la papelera`
                  : ""}
                {`. No están en ninguna incidencia, así que no se pierde nada del expediente: se quedan ${retentionDays} días en la papelera, por si hay que volver a por ellas.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={purging}
                onClick={() => void handlePurge()}
              >
                <Trash2 className="size-4" />
                {purging ? "Purgando..." : "Purgar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * La constancia de las purgas a mano, debajo del botón que las hace: quién, cuándo
 * y qué se llevó cada una, con sus vales a un clic. Las pasadas de la madrugada no
 * aparecen aquí a propósito —tienen la suya, con la última vez de cada una—: esto
 * es la firma de lo que decide una persona, y con nombre y apellidos, porque es lo
 * único que quedará de un archivo que nadie citó.
 */
function ManualPurgeLog() {
  const purges = useQuery(api.cleanupLog.purges);
  // Un solo detalle abierto a la vez: la lista se lee de un vistazo y los vales
  // aparecen cuando se piden.
  const [openId, setOpenId] = useState<string | null>(null);
  const entries = purges?.entries ?? [];

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Constancia de las purgas a mano
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Quién purgó, cuándo y qué se llevó. Las pasadas de la madrugada no se
        firman aquí: esto es lo que hizo una persona.
      </p>

      {purges === undefined ? (
        <Skeleton className="mt-2 h-12 rounded-lg" />
      ) : entries.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          Todavía no ha purgado nadie a mano. La primera purga deja aquí su
          firma, con la lista de lo que se llevó.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {entries.map((entry) => {
            const total = entry.images.length + entry.tickets.length;
            const open = openId === entry.id;
            const counted = [
              entry.images.length > 0
                ? `${cleanupCount("reportUploads", entry.images.length)} (${formatFileSize(
                    entry.bytes,
                  )})`
                : null,
              entry.tickets.length > 0
                ? cleanupTicketsLabel(entry.tickets.length)
                : null,
            ].filter((part): part is string => part !== null);
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-border/70 p-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{entry.runBy}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatDateTime(entry.ranAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {counted.join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setOpenId(open ? null : entry.id)}
                  >
                    {open ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    {open ? "Ocultar" : `Ver qué se llevó (${total})`}
                  </Button>
                </div>

                {open && (
                  <ul className="mt-2 grid gap-1 border-t border-border/60 pt-2">
                    {entry.images.map((image) => (
                      <li
                        key={image.ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{image.ticket}</span>
                        <span className="shrink-0">
                          {formatFileSize(image.size)}
                        </span>
                      </li>
                    ))}
                    {entry.tickets.map((ticket) => (
                      <li
                        key={ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{ticket}</span>
                        <span className="shrink-0">vale sin archivo</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {purges?.partial && (
            <li className="text-[11px] leading-5 text-muted-foreground">
              Se enseñan las últimas {entries.length} purgas a mano; las de
              antes siguen guardadas.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Limpieza del almacén: las dos pasadas que retiran archivos que ya no usa
 * nadie —lo que dejó a medias el formulario público y los que no cita ninguna
 * ficha—, con cuándo fue la última vez de cada una y qué se llevó. El taller las
 * corre de madrugada; el botón las adelanta cuando haga falta, las dos de una
 * vez y en el mismo orden que la noche.
 *
 * La constancia la deja la propia pasada (`storageCleanupRuns`), así que lo que
 * enseña la tarjeta es lo que de verdad hizo, no una cuenta que la pantalla se
 * eche mirando lo que queda —que no dice nada de lo que ya se llevó—. Una pasada
 * que todavía no ha corrido lo dice, en lugar de inventarse una fecha.
 */
function StorageCleanupCard() {
  const runs = useQuery(api.cleanupLog.lastRuns);
  // Acción y no mutación: cada pasada del almacén va en su propia transacción.
  const runNow = useAction(api.storageCleanup.runNow);
  const [running, setRunning] = useState(false);

  /** Limpieza inmediata: las dos pasadas, sin esperar la madrugada. */
  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      // Lo que retiran las dos primeras pasadas va a la papelera; lo que libera
      // sitio es lo que borra la tercera. Se cuentan aparte para no decir que se
      // ha liberado lo que solo se ha guardado.
      const removed = [
        result.reportUploads.files > 0
          ? cleanupCount("reportUploads", result.reportUploads.files)
          : null,
        result.reportUploads.tickets > 0
          ? cleanupTicketsLabel(result.reportUploads.tickets)
          : null,
        result.orphanFiles.files > 0
          ? cleanupCount("orphanFiles", result.orphanFiles.files)
          : null,
      ].filter((part): part is string => part !== null);
      const freed =
        result.trash.files > 0
          ? `${formatFileSize(result.trash.bytes)} liberados (${cleanupCount(
              "trash",
              result.trash.files,
            )})`
          : null;
      // Lo que no se puede leer se dice aparte: lo de los archivos sin citar se
      // queda donde estaba —de lo que no se lee no se decide nada— y el vale del
      // formulario se va sin dejar nada en la papelera.
      const unreadable = [
        result.reportUploads.unreadable > 0
          ? `${cleanupUnreadableLabel(
              result.reportUploads.unreadable,
            )}, sin nada que guardar`
          : null,
        result.orphanFiles.unreadable > 0
          ? `${cleanupUnreadableLabel(result.orphanFiles.unreadable)}, sin retirar`
          : null,
      ].filter((part): part is string => part !== null);
      // Solo se cuenta lo que salió: una pasada que no se llevó nada no se
      // nombra, para que el aviso diga lo que pasó y no lo que pudo pasar.
      const parts = [
        removed.length > 0 ? `${removed.join(" y ")} a la papelera` : null,
        freed,
        ...unreadable,
      ].filter((part): part is string => part !== null);

      toast.success(
        parts.length === 0
          ? "La limpieza no tenía nada que hacer"
          : `Limpieza hecha: ${parts.join(" · ")}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Trash2 className="size-4" />
          </span>
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight">
              Limpieza del almacén
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Cada madrugada el taller retira los archivos que ya no usa nadie:
              lo que dejó a medias el formulario público y los que ya no cita
              ninguna ficha. Lo retirado se guarda unos días en la papelera, que
              vacía la tercera pasada. Aquí ves la última vez de cada una
              —cuándo fue y qué se llevó— y las puedes adelantar de una vez.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={running || runs === undefined}
          onClick={() => void handleRunNow()}
        >
          <Play className="size-4" />
          {running ? "Limpiando..." : "Ejecutar ahora"}
        </Button>
      </div>

      {runs === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {runs.map((run) => {
            const meta = CLEANUP_PASS_META[run.pass];
            // Lo que retiró la última vez; una pasada que no se llevó nada lo
            // dice, que es distinto de no haber corrido nunca.
            const detail = [
              run.ranAt === null
                ? null
                : run.files === 0
                  ? "no retiró nada"
                  : `${cleanupCount(run.pass, run.files)} · ${formatFileSize(run.bytes)}`,
              run.tickets > 0 ? cleanupTicketsLabel(run.tickets) : null,
              // Lo que no se pudo leer, aparte de lo retirado: no es lo mismo que
              // no haberlo visto.
              run.unreadable > 0
                ? `${cleanupUnreadableLabel(run.unreadable)}${
                    run.pass === "orphanFiles"
                      ? ", sin retirar"
                      : ", sin nada que guardar"
                  }`
                : null,
            ].filter((part): part is string => part !== null);

            return (
              <li
                key={run.pass}
                className="rounded-lg border border-border/70 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm">{meta.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {run.ranAt === null
                      ? "todavía no ha corrido"
                      : `${formatRelativeTime(run.ranAt)} · ${formatDateTime(run.ranAt)}`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {detail.length > 0
                    ? detail.join(" · ")
                    : "Nunca ha retirado nada."}
                  {run.ranAt !== null && (
                    <>
                      {" · "}
                      {run.automatic
                        ? "la lanzó la limpieza automática"
                        : `a mano, ${run.runBy}`}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * La papelera del almacén: lo que retira la limpieza no se borra en el acto.
 *
 * Cada archivo retirado se queda aquí unos días —sigue en el almacén; lo que
 * cambia es que ya no lo cita ninguna ficha— con su dirección para abrirlo o
 * descargarlo. Desde aquí se recupera: un archivo del formulario público vuelve
 * a su vale, con la ventana nueva, y uno de los que ya no citaba nadie se queda
 * rescatado, que es lo que impide que caduque. Pasado el plazo lo borra la
 * tercera pasada de la limpieza, y hasta entonces se puede adelantar a mano.
 *
 * Se enseña solo lo que el almacén sabe del archivo —su tipo y su tamaño—: por
 * un archivo retirado ya no responde ninguna ficha, así que no hay nombre que
 * enseñar. Lo que sí se dice es de dónde salió y qué pasada se lo llevó, que es
 * lo que permite juzgar si se retiró por error.
 */
function TrashCard() {
  const trash = useQuery(api.trash.list);
  const restore = useMutation(api.trash.restore);
  const deleteNow = useMutation(api.trash.deleteNow);
  // El plazo de la papelera: lo que se retire a partir de ahora se guardará esos
  // días. Es un ajuste guardado (`storageSettings`), como los demás del taller.
  const settings = useQuery(api.trash.settings);
  const saveSettings = useMutation(api.trash.setSettings);
  const [days, setDays] = useState(String(DEFAULT_TRASH_RETENTION_DAYS));
  const [savingDays, setSavingDays] = useState(false);
  // El archivo con algo en marcha (recuperarlo o borrarlo) y el que espera
  // confirmación para borrarse del todo.
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TrashItem | null>(null);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse
  // por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    seeded.current = true;
  }, [settings]);

  const pending = trash?.pending ?? [];
  const kept = trash?.kept ?? [];
  const total = pending.length + kept.length;
  // El plazo vigente para lo que se retire de ahora en adelante; mientras carga
  // vale el de partida. Lo que ya está en la papelera cumple el plazo con el que
  // entró, y su propia fila dice cuándo se va.
  const retentionDays = settings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;
  const daysValue = Number(days);
  const daysValid =
    days.trim() !== "" &&
    Number.isInteger(daysValue) &&
    daysValue >= MIN_TRASH_RETENTION_DAYS &&
    daysValue <= MAX_TRASH_RETENTION_DAYS;

  /** Guarda el plazo de la papelera para lo que se retire a partir de ahora. */
  const handleSaveDays = async () => {
    setSavingDays(true);
    try {
      await saveSettings({ days: daysValue });
      toast.success("Plazo de la papelera actualizado");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingDays(false);
    }
  };

  /** Recuperar: de vuelta a su vale, o rescatado para que no caduque. */
  const handleRestore = async (item: TrashItem) => {
    setBusy(item.id);
    try {
      const result = await restore({ id: item.id });
      toast.success(
        result.kept
          ? "Rescatado: se queda en la papelera y ya no se borra solo"
          : "Recuperada: vuelve al formulario, con la ventana nueva",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Borrarlo ya, sin esperar a que cumpla su plazo. */
  const handleDelete = async (item: TrashItem) => {
    setBusy(item.id);
    try {
      const result = await deleteNow({ id: item.id });
      toast.success(`Borrado para siempre · ${formatFileSize(result.bytes)}`);
      setDeleting(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Una fila de la papelera: lo que se sabe del archivo y qué se puede hacer. */
  const row = (item: TrashItem) => (
    <li
      key={item.id}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-2"
    >
      {item.kind === "image" ? (
        // La foto, con el aviso de siempre dentro: si su archivo ya no está en
        // el almacén, o su dirección no llega, la fila lo dice en lugar de
        // quedarse el icono de respaldo.
        <AttachmentImage
          url={item.url}
          name=""
          layout="row"
          frameClassName="size-10 shrink-0 overflow-hidden rounded-md border border-border/70"
          imageClassName="size-full object-cover"
        />
      ) : (
        // Un PDF no tiene miniatura que enseñar: su icono es el que le toca.
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted text-muted-foreground">
          <File className="size-4" />
        </span>
      )}

      <div className="min-w-[10rem] flex-1">
        <p className="text-sm">
          {formatFileSize(item.size)}
          {item.contentType ? ` · ${item.contentType}` : ""}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {CLEANUP_PASS_META[item.pass].label} · retirado{" "}
          {formatRelativeTime(item.removedAt)} ({formatDateTime(item.removedAt)}
          )
          {item.kept
            ? item.keptAt === null
              ? ""
              : ` · rescatado ${formatRelativeTime(item.keptAt)}`
            : ` · ${trashRemainingLabel(item.purgeAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {item.url && (
          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Abrir
            </a>
          </Button>
        )}
        {!item.kept && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy === item.id}
            title={
              item.fromForm
                ? `Devolverle su vale del formulario, con ${retentionDays} días de ventana nueva`
                : "Que se quede: deja de caducar y solo se borra a mano"
            }
            onClick={() => void handleRestore(item)}
          >
            <Undo2 className="size-4" />
            {item.fromForm ? "Recuperar" : "Conservar"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          disabled={busy === item.id}
          onClick={() => setDeleting(item)}
        >
          <Trash2 className="size-4" />
          Borrar
        </Button>
      </div>
    </li>
  );

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Undo2 className="size-4" />
        </span>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-tight">
            Papelera del almacén
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Lo que la limpieza retira no se borra en el acto: se queda aquí{" "}
            {retentionDays} días, con el archivo todavía en el almacén, por si
            hay que recuperarlo. Mientras esté puedes abrirlo, devolverle su
            sitio si vino del formulario público o rescatarlo; pasado el plazo,
            la pasada de la papelera lo borra de verdad.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="ajustes-papelera-plazo" className="text-sm">
          Plazo de la papelera (días)
        </Label>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            id="ajustes-papelera-plazo"
            type="number"
            inputMode="numeric"
            min={MIN_TRASH_RETENTION_DAYS}
            max={MAX_TRASH_RETENTION_DAYS}
            step={1}
            value={days}
            disabled={settings === undefined || savingDays}
            onChange={(event) => setDays(event.target.value)}
            className="w-28"
          />
          <Button
            type="button"
            disabled={savingDays || settings === undefined || !daysValid}
            onClick={() => void handleSaveDays()}
          >
            {savingDays ? "Guardando..." : "Guardar plazo"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {daysValid
            ? `Lo que se retire a partir de ahora se guardará ${daysValue} ${
                daysValue === 1 ? "día" : "días"
              } en la papelera antes de borrarse de verdad. Lo que ya está dentro cumple el plazo con el que entró.`
            : `Escribe un número entero de días entre ${MIN_TRASH_RETENTION_DAYS} y ${MAX_TRASH_RETENTION_DAYS}.`}
        </p>
      </div>

      {trash === undefined ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          La papelera está vacía: lo que retiren la limpieza de la madrugada o
          una purga a mano aparecerá aquí, con su plazo, antes de borrarse.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {`${pending.length} ${
                pending.length === 1 ? "archivo" : "archivos"
              } · ${formatFileSize(trash?.pendingBytes ?? 0)} · ${
                // Lo que le queda al primero: es el mismo texto que lleva su fila,
                // y con uno caducado dice que le toca la próxima pasada en vez de
                // enseñar una fecha que ya pasó.
                trash?.nextPurgeAt === null || trash?.nextPurgeAt === undefined
                  ? "se borran al cumplir su plazo"
                  : `el primero ${trashRemainingLabel(trash.nextPurgeAt)}`
              }`}
            </p>
          )}

          {pending.length > 0 && (
            // Los archivos de la papelera, como grupo: si lo que falla es la
            // dirección pública, el porqué se dice una vez sobre la lista en
            // lugar de en cada fila que se cae.
            <AttachmentGroup>
              <ul className="mt-3 grid gap-2">{pending.map(row)}</ul>
            </AttachmentGroup>
          )}

          {kept.length > 0 && (
            <>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {`Rescatados (${kept.length}): no se borran solos, solo si los borras tú.`}
              </p>
              <AttachmentGroup>
                <ul className="mt-3 grid gap-2">{kept.map(row)}</ul>
              </AttachmentGroup>
            </>
          )}
        </>
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Borrar de la papelera</DialogTitle>
              <DialogDescription>
                {`Se borrará del almacén ese archivo (${formatFileSize(
                  deleting.size,
                )}) sin esperar a su plazo. Después ya no se puede recuperar.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={busy === deleting.id}
                onClick={() => void handleDelete(deleting)}
              >
                <Trash2 className="size-4" />
                {busy === deleting.id ? "Borrando..." : "Borrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
