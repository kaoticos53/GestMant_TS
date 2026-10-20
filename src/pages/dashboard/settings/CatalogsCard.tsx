import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOG_KIND_LABELS,
  CatalogKind,
  normalizeCatalogString,
} from "@/lib/catalogs";
import { getErrorMessage } from "@/lib/workshop";
import {
  BookOpen,
  GitMerge,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function CatalogsCard() {
  const [selectedKind, setSelectedKind] = useState<CatalogKind>("brand");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<{
    id: Id<"catalogs">;
    name: string;
  } | null>(null);
  const [mergingItem, setMergingItem] = useState<{
    id: Id<"catalogs">;
    name: string;
  } | null>(null);
  const [targetMergeId, setTargetMergeId] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"catalogs"> | null>(null);

  const rawItems = useQuery(api.catalogs.list, { kind: selectedKind }) ?? [];
  const ensureItem = useMutation(api.catalogs.ensureItem);
  const updateItem = useMutation(api.catalogs.update);
  const removeItem = useMutation(api.catalogs.remove);
  const mergeDuplicates = useMutation(api.catalogs.mergeDuplicates);
  const migrateLegacy = useMutation(api.catalogs.migrateLegacyLocations);

  useEffect(() => {
    void migrateLegacy().catch(() => {});
  }, [migrateLegacy]);

  const meta = CATALOG_KIND_LABELS[selectedKind];

  const filteredItems = useMemo(() => {
    const q = normalizeCatalogString(search);
    if (!q) return rawItems;
    return rawItems.filter((item) =>
      normalizeCatalogString(item.name).includes(q),
    );
  }, [rawItems, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newItemName.trim();
    if (!clean) return;
    try {
      await ensureItem({ kind: selectedKind, name: clean });
      toast.success(`${meta.singular} añadida al catálogo`);
      setNewItemName("");
      setIsAddingNew(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleUpdate = async () => {
    if (!editingItem || !editingItem.name.trim()) return;
    try {
      await updateItem({ id: editingItem.id, name: editingItem.name.trim() });
      toast.success(`${meta.singular} actualizada`);
      setEditingItem(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: Id<"catalogs">) => {
    try {
      await removeItem({ id });
      toast.success(`${meta.singular} eliminada del catálogo`);
      setDeletingId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMerge = async () => {
    if (!mergingItem || !targetMergeId) return;
    try {
      await mergeDuplicates({
        sourceId: mergingItem.id,
        targetId: targetMergeId as Id<"catalogs">,
      });
      toast.success("Elementos fusionados correctamente");
      setMergingItem(null);
      setTargetMergeId("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-signal/10 text-signal">
              <BookOpen className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base sm:text-lg">
                Catálogos Maestros y Autocompletado
              </CardTitle>
              <CardDescription>
                Valores normalizados para autocompletar marcas, ubicaciones,
                proveedores, puestos y categorías, evitando erratas y duplicados.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>Añadir {meta.singular.toLowerCase()}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Selector de Catálogo */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          {(Object.keys(CATALOG_KIND_LABELS) as CatalogKind[]).map((kind) => {
            const isSelected = selectedKind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setSelectedKind(kind);
                  setSearch("");
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-signal text-signal-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {CATALOG_KIND_LABELS[kind].label}
              </button>
            );
          })}
        </div>

        {/* Buscador y estadísticas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar en ${meta.label.toLowerCase()}...`}
              className="pl-8 text-xs h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {rawItems.length} {meta.label.toLowerCase()} registradas
          </span>
        </div>

        {/* Listado de elementos */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
            {search ? "No se encontraron coincidencias." : `No hay ${meta.label.toLowerCase()} todavía.`}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {item.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {item.normalized}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Editar nombre"
                    onClick={() => setEditingItem({ id: item._id, name: item.name })}
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Fusionar duplicado"
                    onClick={() => setMergingItem({ id: item._id, name: item.name })}
                  >
                    <GitMerge className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    title="Eliminar"
                    onClick={() => setDeletingId(item._id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Diálogo Añadir Nuevo */}
      {isAddingNew && (
        <Dialog open onOpenChange={(open) => !open && setIsAddingNew(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva {meta.singular.toLowerCase()}</DialogTitle>
              <DialogDescription>
                Añade una opción canónica al catálogo maestro.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="new-cat-name">Nombre</Label>
                <Input
                  id="new-cat-name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={meta.placeholder}
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingNew(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo Editar */}
      {editingItem && (
        <Dialog open onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar {meta.singular.toLowerCase()}</DialogTitle>
              <DialogDescription>
                Actualiza el nombre oficial.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-cat-name">Nombre canónico</Label>
                <Input
                  id="edit-cat-name"
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingItem(null)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleUpdate}>
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo Fusionar Duplicados */}
      {mergingItem && (
        <Dialog open onOpenChange={(open) => !open && setMergingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Fusionar duplicado</DialogTitle>
              <DialogDescription>
                Reemplaza todas las apariciones de &quot;{mergingItem.name}&quot; por
                otro elemento canónico y elimina este duplicado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Elemento canónico de destino</Label>
                <Select
                  value={targetMergeId}
                  onValueChange={setTargetMergeId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona el valor correcto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rawItems
                      .filter((i) => i._id !== mergingItem.id)
                      .map((opt) => (
                        <SelectItem key={opt._id} value={opt._id}>
                          {opt.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMergingItem(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={!targetMergeId}
                onClick={handleMerge}
              >
                Fusionar y corregir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo Confirmar Borrado */}
      {deletingId && (
        <Dialog open onOpenChange={(open) => !open && setDeletingId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>¿Eliminar del catálogo?</DialogTitle>
              <DialogDescription>
                Se quitará esta sugerencia del autocompletado. Los registros que
                ya contengan este valor no se modificarán.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingId(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDelete(deletingId)}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
