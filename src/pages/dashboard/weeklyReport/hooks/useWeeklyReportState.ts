import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { WEEKDAY_OPTIONS } from "@/lib/weeklyReport";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  filterKnownRoleKeys,
  formatSendSuccessMessage,
  toggleRoleInList,
} from "../helpers";
import type { RoleOption } from "../types";

export function useWeeklyReportState(open: boolean) {
  const settings = useQuery(api.weeklyReport.settings);
  const roleOptions = useQuery(api.weeklyReport.roleOptions);
  const preview = useQuery(api.weeklyReport.preview);
  const history = useQuery(api.weeklyReport.history);
  const saveSettings = useMutation(api.weeklyReport.setSettings);
  const sendNow = useAction(api.weeklyReport.sendNow);

  const [enabled, setEnabled] = useState(true);
  const [weekday, setWeekday] = useState(String(WEEKDAY_OPTIONS[0].value));
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Los ajustes guardados rellenan el formulario al abrir, una sola vez.
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current || settings === undefined) return;
    setEnabled(settings.enabled);
    setWeekday(String(settings.weekday));
    setRoleKeys(settings.roleKeys);
    seeded.current = true;
  }, [open, settings]);

  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const audience = filterKnownRoleKeys(roleKeys, knownRoleKeys);
  const recipients = preview?.recipients ?? [];

  const toggleRole = (key: string, checked: boolean) =>
    setRoleKeys((current) => toggleRoleInList(current, key, checked));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        enabled,
        weekday: Number(weekday),
        roleKeys: audience,
      });
      toast.success("Ajustes del resumen guardados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendNow({});
      if (result.status === "sent") {
        toast.success(formatSendSuccessMessage(result.recipients.length));
      } else {
        toast.error(result.error ?? "No se pudo enviar el resumen");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return {
    settings,
    roleOptions: roleOptions as RoleOption[] | undefined,
    preview,
    history: history ?? [],
    enabled,
    weekday,
    roleKeys,
    recipients,
    saving,
    sending,
    setEnabled,
    setWeekday,
    toggleRole,
    handleSave,
    handleSend,
  };
}
