import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { roleBadgeClassName } from "@/lib/roles";
import {
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
  getErrorMessage,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

export function WorkAlertSettingsCard() {
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
