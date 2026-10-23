import {
  StorageCleanupHeader,
  StorageCleanupRunsList,
  useStorageCleanup,
} from "./storageCleanup";

/**
 * Limpieza del almacén: las pasadas que retiran archivos que ya no usa
 * nadie —lo que dejó a medias el formulario público y los que no cita ninguna
 * ficha—, con cuándo fue la última vez de cada una y qué se llevó. El taller las
 * corre de madrugada; el botón las adelanta cuando haga falta, las dos de una
 * vez y en el mismo orden que la noche.
 */
export function StorageCleanupCard() {
  const { runs, running, handleRunNow } = useStorageCleanup();

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <StorageCleanupHeader
        running={running}
        disabled={runs === undefined}
        onRunNow={() => void handleRunNow()}
      />
      <StorageCleanupRunsList runs={runs} />
    </div>
  );
}
