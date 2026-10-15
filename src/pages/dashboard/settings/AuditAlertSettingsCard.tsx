import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { roleBadgeClassName } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { FileClock } from "lucide-react";
import { toast } from "sonner";

export function AuditAlertSettingsCard() {
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
