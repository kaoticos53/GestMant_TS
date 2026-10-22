import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  filterKnownRoleKeys,
  formatIncidentRolesNotice,
  formatWeeklyRolesNotice,
  toggleRoleInList,
} from "../helpers";
import type { RoleOption } from "../types";

export function useMailAudienceState() {
  const settings = useQuery(api.mailSettings.settings);
  const roleOptions = useQuery(api.mailSettings.roleOptions);
  const report = useQuery(api.weeklyReport.settings);
  const setIncidentRoles = useMutation(api.mailSettings.setIncidentRoles);
  const saveReport = useMutation(api.weeklyReport.setSettings);

  const [incident, setIncident] = useState<string[] | null>(null);
  const [weekly, setWeekly] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
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

  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const incidentKeys = filterKnownRoleKeys(incident, knownRoleKeys);
  const weeklyKeys = filterKnownRoleKeys(weekly, knownRoleKeys);

  const toggle = (
    which: "incident" | "weekly",
    key: string,
    checked: boolean,
  ) => {
    if (which === "incident") {
      setIncident((prev) => toggleRoleInList(prev, key, checked));
    } else {
      setWeekly((prev) => toggleRoleInList(prev, key, checked));
    }
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

  const incidentNotice = formatIncidentRolesNotice(incidentKeys, roleLabel);
  const weeklyNotice = formatWeeklyRolesNotice(weeklyKeys, roleLabel);

  return {
    loading,
    roleOptions: (roleOptions ?? []) as RoleOption[],
    incidentKeys,
    weeklyKeys,
    saving,
    toggle,
    handleSave,
    incidentNotice,
    weeklyNotice,
  };
}
