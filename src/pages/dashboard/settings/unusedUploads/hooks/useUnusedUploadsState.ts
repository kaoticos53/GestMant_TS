import { api } from "@/convex/_generated/api";
import { DEFAULT_TRASH_RETENTION_DAYS } from "@/lib/trash";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { buildPurgeSuccessMessage, buildUnusedSummary } from "../helpers";

export function useUnusedUploadsState() {
  const pending = useQuery(api.reportUploads.unusedImages);
  const purgeUnused = useMutation(api.reportUploads.purgeUnused);
  const trashSettings = useQuery(api.trash.settings);
  const retentionDays = trashSettings?.days ?? DEFAULT_TRASH_RETENTION_DAYS;

  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  const images = pending?.images ?? [];
  const tickets = pending?.tickets ?? 0;
  const unreadable = pending?.unreadable ?? 0;
  const totalBytes = pending?.totalBytes ?? 0;
  const total = images.length + tickets + unreadable;
  const summary = buildUnusedSummary(pending);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const result = await purgeUnused();
      toast.success(buildPurgeSuccessMessage(result));
      setConfirming(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPurging(false);
    }
  };

  return {
    pending,
    images,
    tickets,
    unreadable,
    totalBytes,
    total,
    summary,
    retentionDays,
    confirming,
    setConfirming,
    purging,
    handlePurge,
  };
}
