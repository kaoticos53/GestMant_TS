import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_AFTER_MONTHS,
  archivableBefore,
} from "@/lib/archive";
import { monthsAgo } from "@/lib/browse";
import { getErrorMessage } from "@/lib/workshop";
import {
  formatRunNowResultToast,
  resolveAutoOptions,
} from "./helpers";

export function useAutomaticArchive() {
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const settings = useQuery(api.archive.settings);
  const saveSettings = useMutation(api.archive.setSettings);
  const runNow = useMutation(api.archive.runNow);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const autoMonths = settings?.afterMonths ?? DEFAULT_AFTER_MONTHS;
  const autoCutoff = monthsAgo(autoMonths);
  const pending = archivableBefore({
    incidents,
    requests,
    before: autoCutoff,
  });

  const autoOptions = resolveAutoOptions(autoMonths);

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

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      toast.success(formatRunNowResultToast(result));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return {
    settings,
    autoMonths,
    autoCutoff,
    pending,
    autoOptions,
    saving,
    running,
    handleSaveSettings,
    handleRunNow,
  };
}
