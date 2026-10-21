import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CircleAlert,
  FileDown,
  Package,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { api } from "@/convex/_generated/api";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { richDocToPlainText } from "@/lib/richDoc";
import { sortRows } from "@/lib/tableSort";
import { cn } from "@/lib/utils";
import {
  PART_CATEGORIES,
  equipmentLabel,
  getErrorMessage,
  stockState,
} from "@/lib/workshop";

import { PartRow } from "./inventory/components/PartRow";
import { PartFormDialog } from "./inventory/dialogs/PartFormDialog";
import { StockDialog } from "./inventory/dialogs/StockDialog";
import { exportInventoryCsv } from "./inventory/helpers";
import type { InventoryViewProps, PartDoc } from "./inventory/types";

export type { InventoryViewProps } from "./inventory/types";

export function InventoryView({
  canManage = false,
  currentUserId = null,
  initialSearch = "",
  initialLowStockOnly = false,
}: InventoryViewProps) {
  // El catálogo lo carga el módulo, y con él los equipos: son los que dan la
  // compatibilidad de cada repuesto y el filtro por modelo. El backend no
  // contesta a quien no puede verlos, así que esto degrada a vacío.
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const adjustStock = useMutation(api.spareParts.adjustStock);
  const removePart = useMutation(api.spareParts.remove);

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const [formTarget, setFormTarget] = useState<{ part: PartDoc | null } | null>(
    null,
  );
  const [stockTarget, setStockTarget] = useState<PartDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartDoc | null>(null);

  const query = search.trim().toLowerCase();
  const filterModel = equipment.find((item) => item._id === equipmentFilter);
  // Mismo criterio que el resumen (agotado y bajo mínimo cuentan como bajos).
  const lowStockCount = parts.filter(
    (part) => stockState(part.stock, part.minStock) !== "ok",
  ).length;

  const filtered = parts.filter((part) => {
    if (category !== "all" && part.category !== category) return false;
    if (filterModel) {
      const resolvedModelId =
        filterModel.modelId ??
        catalogModels.find(
          (m) =>
            m.model.trim().toLowerCase() === filterModel.model.trim().toLowerCase(),
        )?._id;
      if (!resolvedModelId || !part.compatibleModels?.includes(resolvedModelId)) {
        return false;
      }
    }
    if (lowStockOnly && stockState(part.stock, part.minStock) === "ok")
      return false;
    if (!query) return true;
    return [
      part.code,
      part.name,
      richDocToPlainText(part.description),
      part.location ?? "",
      part.supplier ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });

  /**
   * Las columnas que se pueden ordenar: la etiqueta que enseña la cabecera y de
   * dónde sale lo que ordena esa columna.
   */
  const columns = {
    part: { label: "Repuesto", value: (part: PartDoc) => part.name },
    category: { label: "Categoría", value: (part: PartDoc) => part.category },
    location: {
      label: "Ubicación",
      value: (part: PartDoc) => part.location ?? "",
    },
    stock: { label: "Stock", value: (part: PartDoc) => part.stock },
    minStock: { label: "Mínimo", value: (part: PartDoc) => part.minStock },
    price: {
      label: "Precio",
      value: (part: PartDoc) => part.unitPrice ?? null,
    },
  } as const;

  const [sort, setSort] = useTableSort({
    table: "inventory",
    columns,
    userId: currentUserId,
  });

  const rows = sortRows(
    filtered,
    (part, column) => columns[column].value(part),
    sort,
  );

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: `${search}|${category}|${equipmentFilter}|${lowStockOnly}`,
  });
  const visible = rows.slice(paging.from - 1, paging.to);
  const filtering =
    search.trim() !== "" ||
    category !== "all" ||
    equipmentFilter !== "all" ||
    lowStockOnly;

  const handleQuickAdjust = async (part: PartDoc, delta: number) => {
    try {
      await adjustStock({ id: part._id, delta });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (part: PartDoc) => {
    try {
      await removePart({ id: part._id });
      toast.success(`${part.code} borrado del catálogo`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    const exportedCount = exportInventoryCsv(rows, catalogModels);
    toast.success(`Catálogo exportado: ${exportedCount} repuestos`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por código, nombre, ubicación o proveedor"
          searchAriaLabel="Buscar repuesto"
          hasActiveFilters={filtering}
          onResetFilters={() => {
            setSearch("");
            setCategory("all");
            setEquipmentFilter("all");
            setLowStockOnly(false);
          }}
          resetFiltersLabel="Limpiar filtros"
          filters={
            <>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label="Filtrar por categoría"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {PART_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                <SelectTrigger
                  className="w-full sm:w-52"
                  aria-label="Filtrar por equipo"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los equipos</SelectItem>
                  {equipment.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {equipmentLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={() => setLowStockOnly((value) => !value)}
                aria-pressed={lowStockOnly}
                title="Muestra solo los repuestos por debajo del stock mínimo"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  lowStockOnly
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                    : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <CircleAlert className="size-4" />
                Solo stock bajo
                <span className="text-xs tabular-nums opacity-70">
                  {lowStockCount}
                </span>
              </button>
            </>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleExport}
                disabled={filtered.length === 0}
                title="Descarga en CSV los repuestos que se ven filtrados"
              >
                <FileDown className="size-4" />
                Exportar CSV ({filtered.length})
              </Button>
              {canManage && (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setFormTarget({ part: null })}
                >
                  <Plus className="size-4" />
                  Nuevo repuesto
                </Button>
              )}
            </>
          }
        />

        {parts.length === 0 ? (
          <div className="p-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
              <Package className="size-5" />
            </span>
            <p className="mt-4 text-base font-semibold tracking-tight">
              El catálogo está vacío
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Da de alta el primer repuesto con su código, ubicación y stock
              mínimo para empezar a controlar el almacén.
            </p>
            {canManage && (
              <Button
                type="button"
                className="mt-5 gap-2"
                onClick={() => setFormTarget({ part: null })}
              >
                <Plus className="size-4" />
                Nuevo repuesto
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-semibold tracking-tight">
              Sin resultados
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              No hay repuestos que coincidan con «{search || category}».
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setEquipmentFilter("all");
                setLowStockOnly(false);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <TableSortBar
              columns={columns}
              sort={sort}
              onSortChange={setSort}
            />
            <ListArea ref={areaRef} resetKey={paging.page}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <SortableTableHead
                      column="part"
                      label="Repuesto"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="category"
                      label="Categoría"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHead
                      column="location"
                      label="Ubicación"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHead
                      column="stock"
                      label="Stock"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="minStock"
                      label="Mínimo"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="hidden sm:table-cell text-right"
                    />
                    <SortableTableHead
                      column="price"
                      label="Precio"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="hidden xl:table-cell text-right"
                    />
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((part) => (
                    <PartRow
                      key={part._id}
                      part={part}
                      canManage={canManage}
                      catalogModels={catalogModels}
                      onQuickAdjust={handleQuickAdjust}
                      onEdit={(p) => setFormTarget({ part: p })}
                      onStockAdjust={setStockTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            </ListArea>
          </>
        )}

        {filtered.length > 0 && (
          <TablePagination
            paging={paging}
            singular="repuesto"
            plural="repuestos"
            detail={filtering ? `${parts.length} en el catálogo` : undefined}
          />
        )}
      </div>

      {formTarget && (
        <PartFormDialog
          key={formTarget.part?._id ?? "new"}
          part={formTarget.part}
          catalogModels={catalogModels}
          onClose={() => setFormTarget(null)}
        />
      )}

      {stockTarget && (
        <StockDialog part={stockTarget} onClose={() => setStockTarget(null)} />
      )}

      {deleteTarget && (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar {deleteTarget.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se quitará del catálogo ({deleteTarget.code}). Las peticiones
                históricas conservan su código y su nombre.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => handleDelete(deleteTarget)}
              >
                Borrar repuesto
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
