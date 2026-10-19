import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Label } from "@/components/ui/label";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { matchesQuery } from "@/lib/browse";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { cn } from "@/lib/utils";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { richDocToPlainText, richDocToStore } from "@/lib/richDoc";
import { sortRows } from "@/lib/tableSort";
import {
  PART_CATEGORIES,
  STOCK_META,
  equipmentLabel,
  formatCurrency,
  getErrorMessage,
  stockState,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import {
  CircleAlert,
  FileDown,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PartDoc = Doc<"spareParts">;
type EquipmentDoc = Doc<"equipment">;

/**
 * Cuántos equipos enseña a la vez la búsqueda de compatibles. El taller puede
 * tener miles —por eso no se pinta un botón por equipo—: se enseña lo primero
 * que coincide y quien busca afina si el suyo no está entre los primeros.
 */
const COMPATIBLE_RESULTS = 6;

export function InventoryView({
  canManage = false,
  currentUserId = null,
  initialSearch = "",
  initialLowStockOnly = false,
}: {
  /** Solo responsable de repuestos/admin escriben en el catálogo (fail-closed). */
  canManage?: boolean;
  /** Quién mira: su orden de la tabla se recuerda aparte del de los demás. */
  currentUserId?: string | null;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
  /** Abre la tabla mostrando solo lo que está por debajo del mínimo
   * (lo elige la tarjeta «Repuestos con stock bajo» del resumen). */
  initialLowStockOnly?: boolean;
}) {
  // El catálogo lo carga el módulo, y con él los equipos: son los que dan la
  // compatibilidad de cada repuesto y el filtro por modelo. El backend no
  // contesta a quien no puede verlos, así que esto degrada a vacío.
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
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
    if (filterModel && !part.compatibleWith?.includes(filterModel._id))
      return false;
    if (lowStockOnly && stockState(part.stock, part.minStock) === "ok")
      return false;
    if (!query) return true;
    // La descripción se busca por su texto: el formato del editor no pinta
    // nada en un filtro.
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

  // El orden que elige quien mira, recordado para su próxima visita: mirar el
  // almacén por stock bajo no es cosa de un rato. Sin columna elegida, el
  // catálogo se queda como llega del servidor (por nombre).
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

  // El área de la tabla, para contar las filas que caben en su alto, y la lista
  // partida en páginas con esas filas: sin paginar, el pie con el recuento queda
  // a dos pantallas de la primera fila. El filtro forma parte de la firma, así
  // que afinar la búsqueda vuelve a la primera página en vez de dejar al que
  // busca en la cuarta de otra lista. Se exporta `rows` —lo filtrado y
  // ordenado—, no lo que se ve de una vez.
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

  /** Descarga en CSV exactamente lo que se ve filtrado en la tabla. */
  const handleExport = () => {
    const compatibleLabels = (part: PartDoc) =>
      (part.compatibleWith ?? [])
        .map((id) => equipment.find((item) => item._id === id))
        .filter((item): item is EquipmentDoc => Boolean(item))
        .map(equipmentLabel)
        .join(" | ");

    const header = [
      "Código",
      "Nombre",
      "Descripción",
      "Categoría",
      "Unidad",
      "Stock",
      "Stock mínimo",
      "Estado",
      "Ubicación",
      "Proveedor",
      "Nº de parte",
      "Precio unitario",
      "Compatibles",
      "Ficha del proveedor",
    ];
    // Se exporta lo que se está viendo, en el orden que se está viendo: los
    // filtros ya mandan, y el orden por columna también.
    const exportRows = rows.map((part) => [
      part.code,
      part.name,
      richDocToPlainText(part.description),
      part.category,
      part.unit,
      part.stock,
      part.minStock,
      STOCK_META[stockState(part.stock, part.minStock)].label,
      part.location ?? "",
      part.supplier ?? "",
      part.partNumber ?? "",
      part.unitPrice ?? "",
      compatibleLabels(part),
      part.purchaseUrl ?? "",
    ]);
    downloadCsv(csvFilename("repuestos"), toCsv(header, exportRows));
    toast.success(`Catálogo exportado: ${exportRows.length} repuestos`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código, nombre, ubicación o proveedor"
                className="pl-9"
                aria-label="Buscar repuesto"
              />
            </div>
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

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
                  {visible.map((part) => {
                    const state = stockState(part.stock, part.minStock);
                    const meta = STOCK_META[state];
                    return (
                      <TableRow key={part._id} className="hover:bg-muted/40">
                        <TableCell className="max-w-[16rem]">
                          <span className="block font-mono text-xs text-muted-foreground">
                            {part.code}
                            {part.partNumber ? ` · ${part.partNumber}` : ""}
                          </span>
                          <span className="block truncate font-medium">
                            {part.name}
                          </span>
                          {part.description && (
                            // La nota del repuesto se lee aquí, en pequeño: la ficha
                            // del catálogo no tiene otra pantalla donde mostrarla.
                            <RichText
                              value={part.description}
                              className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground"
                            />
                          )}
                          {part.compatibleWith &&
                            part.compatibleWith.length > 0 && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {part.compatibleWith
                                  .map(
                                    (id) =>
                                      equipment.find((item) => item._id === id)
                                        ?.model,
                                  )
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          {part.location && (
                            <span className="block text-xs text-muted-foreground lg:hidden">
                              Ubicación {part.location}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {part.category}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {part.location || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold tabular-nums">
                              {part.stock}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                {part.unit}
                              </span>
                            </span>
                            <Badge
                              variant="outline"
                              className={meta.badgeClassName}
                            >
                              {meta.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                          {part.minStock}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-right tabular-nums text-muted-foreground">
                          {part.unitPrice && part.unitPrice > 0
                            ? formatCurrency(part.unitPrice)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleQuickAdjust(part, -1)}
                                disabled={part.stock <= 0}
                                aria-label={`Quitar una unidad de ${part.code}`}
                              >
                                <Minus className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleQuickAdjust(part, 1)}
                                aria-label={`Añadir una unidad de ${part.code}`}
                              >
                                <Plus className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setFormTarget({ part })}
                                aria-label={`Editar ${part.code}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setStockTarget(part)}
                                aria-label={`Ajustar stock de ${part.code}`}
                              >
                                <SlidersHorizontal className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(part)}
                                aria-label={`Borrar ${part.code}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
          equipment={equipment}
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

/* ------------------------------------------------------------------ */
/* Alta / edición de repuesto                                          */
/* ------------------------------------------------------------------ */

function PartFormDialog({
  part,
  equipment,
  onClose,
}: {
  part: PartDoc | null;
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const create = useMutation(api.spareParts.create);
  const update = useMutation(api.spareParts.update);
  const catalogLocations = useQuery(api.catalogs.list, { kind: "partLocation" }) ?? [];
  const catalogSuppliers = useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogCategories = useQuery(api.catalogs.list, { kind: "partCategory" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const isEdit = part !== null;
  const [code, setCode] = useState(part?.code ?? "");
  const [name, setName] = useState(part?.name ?? "");
  const [description, setDescription] = useState(part?.description ?? "");
  const [category, setCategory] = useState(
    part?.category ?? (PART_CATEGORIES[0] as string),
  );
  const [unit, setUnit] = useState(part?.unit ?? "ud");
  const [stockText, setStockText] = useState(String(part?.stock ?? 0));
  const [minStockText, setMinStockText] = useState(String(part?.minStock ?? 0));
  const [location, setLocation] = useState(part?.location ?? "");
  const [supplier, setSupplier] = useState(part?.supplier ?? "");
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? "");
  const [priceText, setPriceText] = useState(
    part?.unitPrice ? String(part.unitPrice) : "",
  );
  const [purchaseUrl, setPurchaseUrl] = useState(part?.purchaseUrl ?? "");
  const [compatibleIds, setCompatibleIds] = useState<string[]>(
    part?.compatibleWith ?? [],
  );
  // Los compatibles se buscan y se añaden de uno en uno: con miles de equipos no
  // se puede pintar un botón por equipo, así que lo que se ve son los que ya se
  // han añadido y la búsqueda ofrece solo los primeros que coinciden.
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  /** Los equipos ya añadidos, en el orden en que se añadieron. */
  const compatibles = compatibleIds
    .map((id) => equipment.find((item) => item._id === id))
    .filter((item): item is EquipmentDoc => item !== undefined);

  /** Lo que coincide con la búsqueda y todavía no está añadido. */
  const buscando = equipmentQuery.trim() !== "";
  const encontrados = buscando
    ? equipment.filter(
        (item) =>
          !compatibleIds.includes(item._id) &&
          matchesQuery(
            [equipmentLabel(item), item.code, item.model],
            equipmentQuery,
          ),
      )
    : [];
  const coincidencias = encontrados.slice(0, COMPATIBLE_RESULTS);

  /** Añade un equipo: pasa de la búsqueda a la lista de compatibles. */
  const addCompatible = (id: string) => {
    setCompatibleIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };

  /** Quita un equipo: vuelve a ofrecerse en la búsqueda. */
  const removeCompatible = (id: string) => {
    setCompatibleIds((current) => current.filter((item) => item !== id));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!code.trim()) {
      setError("El código es obligatorio.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const stock = parseNumber(stockText, -1);
    const minStock = parseNumber(minStockText, -1);
    const price = parseNumber(priceText, 0);
    if (stock < 0 || minStock < 0) {
      setError("El stock y el stock mínimo deben ser números positivos.");
      return;
    }
    if (price < 0) {
      setError("El precio no puede ser negativo.");
      return;
    }

    setBusy(true);
    try {
      // Lo que se ve añadido es lo que se guarda.
      const compatibleWith = compatibles.map((item) => item._id);
      // El editor entrega ya el documento en bloques; al editar, vaciarlo deja
      // la ficha sin descripción, como hasta ahora.
      const descriptionToSend = richDocToStore(description);
      if (isEdit && part) {
        await update({
          id: part._id,
          code: code.trim(),
          name: name.trim(),
          description: descriptionToSend ?? "",
          category,
          unit: unit.trim() || "ud",
          stock,
          minStock,
          location: location.trim(),
          supplier: supplier.trim(),
          partNumber: partNumber.trim(),
          unitPrice: price,
          purchaseUrl: purchaseUrl.trim(),
          compatibleWith,
        });
        toast.success(`${code.trim().toUpperCase()} actualizado`);
      } else {
        await create({
          code: code.trim(),
          name: name.trim(),
          ...(descriptionToSend ? { description: descriptionToSend } : {}),
          category,
          unit: unit.trim() || "ud",
          stock,
          minStock,
          location: location.trim(),
          supplier: supplier.trim(),
          partNumber: partNumber.trim(),
          unitPrice: price,
          purchaseUrl: purchaseUrl.trim(),
          compatibleWith,
        });
        toast.success(`${code.trim().toUpperCase()} añadido al catálogo`);
      }

      // Registro transparente en catálogos maestros
      if (location.trim()) {
        void ensureCatalogItem({ kind: "partLocation", name: location.trim() }).catch(() => {});
      }
      if (supplier.trim()) {
        void ensureCatalogItem({ kind: "supplier", name: supplier.trim() }).catch(() => {});
      }
      if (category.trim()) {
        void ensureCatalogItem({ kind: "partCategory", name: category.trim() }).catch(() => {});
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar repuesto" : "Nuevo repuesto"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del repuesto en el catálogo."
              : "Añade un repuesto al catálogo del taller."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="part-code">Código *</Label>
            <Input
              id="part-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ALI-24015"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-name">Nombre *</Label>
            <Input
              id="part-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fuente de alimentación 24 V 150 W"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-category">Categoría</Label>
            <AutocompleteInput
              id="part-category"
              value={category}
              onChange={setCategory}
              items={[
                ...PART_CATEGORIES.map((cat) => ({ name: cat })),
                ...catalogCategories,
              ]}
              kind="partCategory"
              placeholder="p. ej. Electrónica, Conectividad..."
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-unit">Unidad</Label>
            <Input
              id="part-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="ud"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-stock">Stock actual</Label>
            <Input
              id="part-stock"
              type="number"
              min={0}
              value={stockText}
              onChange={(event) => setStockText(event.target.value)}
              className="tabular-nums"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-min">Stock mínimo</Label>
            <Input
              id="part-min"
              type="number"
              min={0}
              value={minStockText}
              onChange={(event) => setMinStockText(event.target.value)}
              className="tabular-nums"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-location">Ubicación</Label>
            <AutocompleteInput
              id="part-location"
              value={location}
              onChange={setLocation}
              items={catalogLocations}
              kind="location"
              placeholder="B-03"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-supplier">Proveedor</Label>
            <AutocompleteInput
              id="part-supplier"
              value={supplier}
              onChange={setSupplier}
              items={catalogSuppliers}
              kind="supplier"
              placeholder="Mean Well"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-number">Nº de parte</Label>
            <Input
              id="part-number"
              value={partNumber}
              onChange={(event) => setPartNumber(event.target.value)}
              placeholder="NDR-150-24"
              className="font-mono"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-price">Precio unitario (€)</Label>
            <Input
              id="part-price"
              inputMode="decimal"
              value={priceText}
              onChange={(event) => setPriceText(event.target.value)}
              placeholder="2,35"
              className="tabular-nums"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="part-url">Ficha del proveedor</Label>
            <Input
              id="part-url"
              value={purchaseUrl}
              onChange={(event) => setPurchaseUrl(event.target.value)}
              placeholder="https://..."
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="part-compatible-search">
              Compatible con (equipos del taller)
            </Label>
            {equipment.length === 0 ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Todavía no hay equipos en el inventario: da de alta los equipos
                en la pestaña «Equipos» para poder filtrar por ellos.
              </p>
            ) : (
              <div className="grid gap-2">
                <Input
                  id="part-compatible-search"
                  value={equipmentQuery}
                  onChange={(event) => setEquipmentQuery(event.target.value)}
                  placeholder="Buscar equipo por nombre, modelo o código"
                  autoComplete="off"
                  disabled={busy}
                />
                {coincidencias.length > 0 && (
                  <ul
                    aria-label="Equipos que coinciden"
                    className="rounded-lg border border-border/70 bg-card"
                  >
                    {coincidencias.map((item) => (
                      <li key={item._id}>
                        <button
                          type="button"
                          onClick={() => addCompatible(item._id)}
                          disabled={busy}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                        >
                          <span className="truncate text-foreground">
                            {equipmentLabel(item)}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                            <span className="font-mono">{item.code}</span>
                            <Plus className="size-3.5" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {encontrados.length > coincidencias.length && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Coinciden {encontrados.length} equipos: afina la búsqueda
                    para llegar a los que no salen aquí.
                  </p>
                )}
                {buscando && encontrados.length === 0 && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Ningún equipo coincide con «{equipmentQuery.trim()}».
                  </p>
                )}
                {compatibles.length === 0 ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Ningún equipo compatible todavía: búscalo arriba y añádelo.
                    Lo que añadas es lo que verás aquí, y lo que se guarde.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {compatibles.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => removeCompatible(item._id)}
                        disabled={busy}
                        title="Quitar de compatibles"
                        aria-label={`Quitar ${equipmentLabel(item)}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal/10 px-3 py-1 text-xs font-medium text-signal transition-colors hover:border-destructive/40 hover:text-destructive"
                      >
                        {equipmentLabel(item)}
                        <X className="size-3.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="part-description">Descripción</Label>
            <RichTextEditor
              id="part-description"
              value={description}
              onChange={setDescription}
              placeholder="Especificaciones, nº de parte, compatibilidad..."
              disabled={busy}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy
              ? "Guardando..."
              : isEdit
                ? "Guardar cambios"
                : "Añadir repuesto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Ajuste de stock a un valor concreto                                 */
/* ------------------------------------------------------------------ */

function StockDialog({
  part,
  onClose,
}: {
  part: PartDoc;
  onClose: () => void;
}) {
  const adjustStock = useMutation(api.spareParts.adjustStock);
  const [value, setValue] = useState(String(part.stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const target = Number(value.replace(",", "."));
    if (!Number.isFinite(target) || target < 0) {
      setError("Introduce un número positivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adjustStock({
        id: part._id,
        delta: Math.round(target) - part.stock,
      });
      toast.success(
        `Stock de ${part.code}: ${Math.round(target)} ${part.unit}`,
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {part.code} · {part.name} — hay {part.stock} {part.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="stock-target">Nuevo stock ({part.unit})</Label>
          <Input
            id="stock-target"
            type="number"
            min={0}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="tabular-nums"
            disabled={busy}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? "Guardando..." : "Guardar stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
