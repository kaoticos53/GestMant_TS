import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import {
  CONFIRM_WORD,
  formatPurchasingSeedSummary,
  formatResetSummary,
  formatSeedSummary,
  isVaciarConfirmed,
} from "../helpers";
import type { UseWorkshopDataActionsReturn } from "../types";

export function useWorkshopDataActions(): UseWorkshopDataActionsReturn {
  const seedDemoData = useMutation(api.seed.seedDemoData);
  const seedDemoUploads = useAction(api.seed.seedDemoUploads);
  const seedDemoManuals = useAction(api.seed.seedDemoManuals);
  const seedPurchasing = useAction(api.seedPurchasing.seedPurchasingDemoData);
  const resetWorkshop = useAction(api.workshopReset.resetWorkshop);

  const [seeding, setSeeding] = useState(false);
  const [seedingPurchasing, setSeedingPurchasing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");

  const canVaciar = isVaciarConfirmed(phrase);

  const handleCloseResetDialog = () => {
    setConfirming(false);
    setPhrase("");
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const photos = await seedDemoUploads();
      await seedDemoData();
      const manuals = await seedDemoManuals();
      toast.success(formatSeedSummary(photos.uploaded, manuals.inserted));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedPurchasing = async () => {
    setSeedingPurchasing(true);
    try {
      const result = await seedPurchasing();
      toast.success(
        formatPurchasingSeedSummary(result.purchases, result.orders),
        {
          description: `${result.receptions} recepciones con su albarán, para que la sección tenga algo que enseñar.`,
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSeedingPurchasing(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await resetWorkshop();
      toast.success(formatResetSummary(result.deleted));
      handleCloseResetDialog();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  return {
    seeding,
    seedingPurchasing,
    resetting,
    confirming,
    phrase,
    canVaciar,
    confirmWord: CONFIRM_WORD,
    setConfirming,
    setPhrase,
    handleSeed,
    handleSeedPurchasing,
    handleReset,
    handleCloseResetDialog,
  };
}
