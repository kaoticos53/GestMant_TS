import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { MIN_WORK_WITHOUT_TRACE_DAYS, getErrorMessage } from "@/lib/workshop";
import {
  filterKnownAudience,
  toggleRoleKey,
  validateDays,
} from "./helpers";
import type { RoleOption, WorkAlertSettingsData } from "./types";

export function useWorkAlertSettings() {
  const settings = useQuery(api.alerts.settings) as WorkAlertSettingsData | undefined;
  const roleOptions = useQuery(api.alerts.roleOptions) as RoleOption[] | undefined;
  const saveSettings = useMutation(api.alerts.setSettings);

  const [days, setDays] = useState(String(MIN_WORK_WITHOUT_TRACE_DAYS));
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // El formulario se rellena con lo guardado en cuanto llega, una sola vez:
  // mientras se edita no se pisa (la consulta sigue viva y puede refrescarse por detrás).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    setRoleKeys(settings.roleKeys);
    seeded.current = true;
  }, [settings]);

  const { isValid: daysValid, value } = validateDays(days);

  // Roles que existen hoy: un rol borrado no vuelve a guardarse en la lista.
  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const audience = filterKnownAudience(roleKeys, knownRoleKeys);

  const handleToggleRole = (key: string, checked: boolean) => {
    setRoleKeys((current) => toggleRoleKey(current, key, checked));
  };

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

  return {
    settings,
    roleOptions,
    days,
    setDays,
    daysValid,
    value,
    roleKeys,
    audience,
    saving,
    handleToggleRole,
    handleSave,
  };
}
