import { api } from "@/convex/_generated/api";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
} from "@/lib/trash";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Hook para gestionar el plazo de retención configurable de la papelera del taller.
 */
export function useTrashRetention() {
  const settings = useQuery(api.trash.settings);
  const saveSettings = useMutation(api.trash.setSettings);

  const [days, setDays] = useState(String(DEFAULT_TRASH_RETENTION_DAYS));
  const [savingDays, setSavingDays] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    setDays(String(settings.days));
    seeded.current = true;
  }, [settings]);

  const retentionDays = settings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;
  const daysValue = Number(days);
  const daysValid =
    days.trim() !== "" &&
    Number.isInteger(daysValue) &&
    daysValue >= MIN_TRASH_RETENTION_DAYS &&
    daysValue <= MAX_TRASH_RETENTION_DAYS;

  /** Guarda el plazo de la papelera para lo que se retire a partir de ahora. */
  const handleSaveDays = async () => {
    if (!daysValid) return;
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

  return {
    days,
    setDays,
    savingDays,
    daysValid,
    daysValue,
    retentionDays,
    settings,
    handleSaveDays,
  };
}
