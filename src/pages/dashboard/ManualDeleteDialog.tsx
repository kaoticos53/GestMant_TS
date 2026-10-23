import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { ManualDoc } from "./ManualsView";

/**
 * Retirar un manual: la confirmación, con lo que se lleva por delante. Vive en
 * su propio sitio porque se borra desde dos lados —la lista del módulo de
 * manuales y la ficha de un equipo— y el aviso tiene que decir exactamente lo
 * mismo en los dos, incluido lo que este caso no es evidente: un manual del
 * modelo está en la ficha de todos los equipos de ese modelo, no solo en el que
 * se tenga delante.
 *
 * El borrado lo hace el propio diálogo: quien lo abre solo tiene que escuchar
 * `onDeleted` para cerrar lo que tuviera abierto de ese manual.
 */
export function ManualDeleteDialog({
  manual,
  onClose,
  onDeleted = () => {},
}: {
  manual: ManualDoc;
  onClose: () => void;
  /** Solo si el borrado salió bien (para cerrar la ficha abierta del manual). */
  onDeleted?: () => void;
}) {
  const removeManual = useMutation(api.manuals.remove);

  const handleDelete = async () => {
    try {
      await removeManual({ id: manual._id });
      toast.success(`«${manual.title}» retirado de los manuales`);
      onDeleted();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      onClose();
    }
  };

  return (
    <DestructiveConfirmDialog
      onClose={onClose}
      title={`¿Borrar «${manual.title}»?`}
      description={
        (manual.kind === "file"
          ? "Se borra la ficha, su archivo y las versiones anteriores que guarda su historial: no se puede deshacer."
          : "Se borra la nota del taller. No se puede deshacer.") +
        (!manual.equipmentId && manual.model
          ? " Es un manual del modelo: desaparece también de la ficha de los demás equipos con ese modelo."
          : "")
      }
      confirmLabel="Borrar manual"
      onConfirm={handleDelete}
    />
  );
}
