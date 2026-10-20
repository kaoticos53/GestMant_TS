import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  Cpu,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/workshop";
import {
  EquipmentModelDialog,
  type EquipmentModelDoc,
} from "./EquipmentModelDialog";

export function EquipmentModelsCard() {
  const models = useQuery(api.equipmentModels.list) ?? [];
  const equipment = useQuery(api.equipment.list) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const manuals = useQuery(api.manuals.list) ?? [];

  const removeModel = useMutation(api.equipmentModels.remove);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Cada apertura estrena diálogo (la `key` de abajo): el formulario se rellena
  // al montarse con el modelo que toca, sin quedar con lo que se escribió la
  // vez anterior.
  const [dialogSession, setDialogSession] = useState(0);
  const [editingModel, setEditingModel] = useState<EquipmentModelDoc | null>(null);
  const [deletingModel, setDeletingModel] = useState<EquipmentModelDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mapeos de conteo de uso por modelo
  const usageStats = useMemo(() => {
    const equipCount = new Map<Id<"equipmentModels">, number>();
    for (const eq of equipment) {
      if (eq.modelId) {
        equipCount.set(eq.modelId, (equipCount.get(eq.modelId) ?? 0) + 1);
      }
    }

    const partsCount = new Map<Id<"equipmentModels">, number>();
    for (const p of parts) {
      for (const mId of p.compatibleModels ?? []) {
        partsCount.set(mId, (partsCount.get(mId) ?? 0) + 1);
      }
    }

    const manualsCount = new Map<Id<"equipmentModels">, number>();
    for (const m of manuals) {
      if (m.modelId) {
        manualsCount.set(m.modelId, (manualsCount.get(m.modelId) ?? 0) + 1);
      }
    }

    return { equipCount, partsCount, manualsCount };
  }, [equipment, parts, manuals]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => {
      const brand = (m.brand ?? "").toLowerCase();
      const model = m.model.toLowerCase();
      const name = m.name.toLowerCase();
      const category = (m.category ?? "").toLowerCase();
      return (
        brand.includes(q) ||
        model.includes(q) ||
        name.includes(q) ||
        category.includes(q)
      );
    });
  }, [models, search]);

  const handleOpenCreate = () => {
    setEditingModel(null);
    setDialogSession((session) => session + 1);
    setDialogOpen(true);
  };

  const handleOpenEdit = (m: EquipmentModelDoc) => {
    setEditingModel(m);
    setDialogSession((session) => session + 1);
    setDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingModel) return;
    setIsDeleting(true);
    try {
      await removeModel({ id: deletingModel._id });
      toast.success(`Modelo «${deletingModel.model}» eliminado del catálogo`);
      setDeletingModel(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const deletingEquipCount = deletingModel
    ? usageStats.equipCount.get(deletingModel._id) ?? 0
    : 0;
  const deletingManualCount = deletingModel
    ? usageStats.manualsCount.get(deletingModel._id) ?? 0
    : 0;
  const cannotDeleteReason =
    deletingEquipCount > 0
      ? `Hay ${deletingEquipCount} equipo(s) en inventario con este modelo. Para eliminar el modelo, reasigna o retira primero los equipos.`
      : deletingManualCount > 0
        ? `Hay ${deletingManualCount} manual(es) asignados a este modelo. Para eliminar el modelo, reasigna o elimina primero dichos manuales.`
        : null;

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <span>Catálogo maestro de modelos de equipos</span>
          </CardTitle>
          <CardDescription>
            Gestiona la ficha técnica de cada modelo. Los repuestos compatibles y
            manuales se vinculan a estos modelos para compartirse entre todos los
            equipos físicos correspondientes.
          </CardDescription>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreate}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-4" />
          <span>Nuevo modelo</span>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Buscador y estadísticas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por marca, modelo o designación..."
              className="pl-8 text-xs h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {models.length} modelos registrados
          </span>
        </div>

        {/* Listado de modelos */}
        {filteredModels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground space-y-2">
            <Cpu className="mx-auto size-8 text-muted-foreground/60" />
            <p className="font-medium text-foreground">
              {search
                ? "No se encontraron modelos que coincidan con la búsqueda."
                : "No hay modelos registrados en el catálogo maestro."}
            </p>
            <p>
              Puedes registrar un nuevo modelo pulsando en «Nuevo modelo» o al
              dar de alta repuestos y manuales.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((item) => {
              const eqCount = usageStats.equipCount.get(item._id) ?? 0;
              const spCount = usageStats.partsCount.get(item._id) ?? 0;
              const manCount = usageStats.manualsCount.get(item._id) ?? 0;

              return (
                <div
                  key={item._id}
                  className="flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3.5 hover:border-primary/40 hover:shadow-xs transition-all gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.brand && (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {item.brand}
                          </span>
                        )}
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {item.model}
                        </h4>
                      </div>
                      {item.category && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                          {item.category}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.name}
                    </p>

                    {item.defaultMaintenanceIntervalDays !== undefined && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                        <Wrench className="size-3 text-signal" />
                        <span>Prev. cada {item.defaultMaintenanceIntervalDays} días</span>
                      </div>
                    )}
                  </div>

                  {/* Insignias de uso y acciones */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        title={`${eqCount} equipo(s) físico(s) en taller`}
                        className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                          eqCount > 0 ? "border-primary/40 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        <Cpu className="size-3" />
                        <span>{eqCount}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        title={`${spCount} repuesto(s) compatible(s)`}
                        className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                          spCount > 0 ? "border-amber-500/40 text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        <Package className="size-3" />
                        <span>{spCount}</span>
                      </Badge>

                      <Badge
                        variant="outline"
                        title={`${manCount} manual(es) vinculado(s)`}
                        className={`text-[10px] px-1.5 py-0.5 gap-1 font-mono ${
                          manCount > 0 ? "border-blue-500/40 text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                        }`}
                      >
                        <BookOpen className="size-3" />
                        <span>{manCount}</span>
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(item)}
                        title={`Editar modelo ${item.model}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingModel(item)}
                        title={`Eliminar modelo ${item.model}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Diálogo de alta / edición */}
      <EquipmentModelDialog
        key={dialogSession}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        model={editingModel}
      />

      {/* Confirmación de eliminación */}
      <AlertDialog
        open={deletingModel !== null}
        onOpenChange={(open) => !open && setDeletingModel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cannotDeleteReason
                ? "No se puede eliminar el modelo"
                : `¿Eliminar el modelo «${deletingModel?.model}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cannotDeleteReason ? (
                <span className="text-destructive font-medium block">
                  {cannotDeleteReason}
                </span>
              ) : (
                <span>
                  Esta acción eliminará la ficha técnica del modelo «{deletingModel?.model}» del catálogo maestro.
                  Si existen repuestos compatibles que citan este modelo, quedarán desvinculados automáticamente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {cannotDeleteReason ? "Cerrar" : "Cancelar"}
            </AlertDialogCancel>
            {!cannotDeleteReason && (
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Eliminando..." : "Eliminar modelo"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
