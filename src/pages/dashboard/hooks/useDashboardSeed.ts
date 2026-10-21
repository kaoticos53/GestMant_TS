import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface DashboardSeedCallbacks {
  onSeedSuccess?: () => void;
}

export function useDashboardSeed(callbacks?: DashboardSeedCallbacks) {
  const seedDemoData = useMutation(api.seed.seedDemoData);
  const seedMoreDemoData = useMutation(api.seed.seedMoreDemoData);
  const seedDemoUploads = useAction(api.seed.seedDemoUploads);
  const seedDemoManuals = useAction(api.seed.seedDemoManuals);

  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeedingMore, setIsSeedingMore] = useState(false);

  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    try {
      const photos = await seedDemoUploads();
      await seedDemoData();
      const manuals = await seedDemoManuals();
      const telling = [
        photos.uploaded > 0
          ? `${photos.uploaded} fotos del formulario esperando limpieza`
          : null,
        manuals.inserted > 0 ? `${manuals.inserted} manuales` : null,
      ].filter((part): part is string => part !== null);
      toast.success(
        telling.length > 0
          ? `Datos de ejemplo cargados · ${telling.join(" · ")}`
          : "Datos de ejemplo cargados",
      );
      callbacks?.onSeedSuccess?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeeding(false);
    }
  }, [callbacks, seedDemoData, seedDemoManuals, seedDemoUploads]);

  const handleSeedMore = useCallback(async () => {
    setIsSeedingMore(true);
    try {
      await seedDemoUploads();
      const result = await seedMoreDemoData({});
      const manuals = await seedDemoManuals();
      const added =
        result.incidents +
        result.requests +
        result.equipment +
        result.parts +
        result.team +
        manuals.inserted;
      toast.success(
        added === 0
          ? "No había nada nuevo que añadir"
          : `${result.incidents} incidencias y ${result.requests} peticiones nuevas · ${result.maintenance} fichas de mantenimiento` +
              (result.team > 0 ? ` · ${result.team} personas en el equipo` : "") +
              (manuals.inserted > 0 ? ` · ${manuals.inserted} manuales` : ""),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeedingMore(false);
    }
  }, [seedDemoManuals, seedDemoUploads, seedMoreDemoData]);

  return {
    isSeeding,
    isSeedingMore,
    handleSeed,
    handleSeedMore,
  };
}
