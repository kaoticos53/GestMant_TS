import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Doc } from "@/convex/_generated/dataModel";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import {
  MANUAL_FILE_FORMAT,
  MANUAL_KIND_META,
  MANUAL_TYPES,
  canDeleteManual,
  canEditManual,
  filterManuals,
  manualBrands,
  manualFileName,
  manualModels,
} from "@/lib/manuals";
import { richDocToPlainText } from "@/lib/richDoc";
import { equipmentLabel, formatDate, formatFileSize } from "@/lib/workshop";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import { ManualDeleteDialog } from "./ManualDeleteDialog";
import { ManualDetailSheet } from "./ManualDetailSheet";
import { ManualFormDialog } from "./ManualFormDialog";
import {
  BookOpen,
  Download,
  Eye,
  FileDown,
  FileUp,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EquipmentDoc = Doc<"equipment">;

/**
 * Un movimiento del historial con la dirección de su versión, si la guarda: es
 * con lo que se sigue descargando el PDF que se sustituyó.
 */
export type ManualChangeDoc = NonNullable<Doc<"manuals">["history"]>[number] & {
  url: string | null;
};

/** Una fila de la lista: el manual guardado, su archivo y su historial. */
export type ManualDoc = Omit<Doc<"manuals">, "history"> & {
  url: string | null;
  history: ManualChangeDoc[];
};

/** Valor del filtro de equipo que busca los manuales sin equipo asignado. */
const NO_EQUIPMENT = "__none__";

/**
 * Módulo de manuales: la documentación del taller, clasificada por tipo, marca
 * y modelo.
 *
 * Lo que hay aquí es la consulta —filtrar, abrir y descargar— y, para quien
 * puede, el alta, la edición y el borrado. Los manuales son de dos formas: el
 * archivo que se sube (PDF) y la nota que escribe un técnico, que se lee en la
 * ficha. Un manual puede estar asignado a un equipo del inventario o ser de un
 * modelo sin equipo concreto, y ningún de los dos casos es un problema: hay
 * manuales sin equipo y equipos sin manuales.
 */
export function ManualsView({
  manuals: manualsProp,
  equipment: equipmentProp,
  canManage = false,
  currentUserId = null,
  initialSearch = "",
}: {
  manuals: ManualDoc[];
  equipment: EquipmentDoc[];
  /** Solo responsable/admin suben, cambian y borran manuales (fail-closed). */
  canManage?: boolean;
  /** Quién mira: es lo que permite corregir su propia nota del taller. */
  currentUserId?: string | null;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
}) {
  // Tolerancia a módulos desactualizados en caliente (los props pueden faltar)
  const manuals = manualsProp ?? [];
  const equipment = equipmentProp ?? [];

  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [model, setModel] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [formTarget, setFormTarget] = useState<{
    manual: ManualDoc | null;
  } | null>(null);
  const [detail, setDetail] = useState<ManualDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualDoc | null>(null);

  const brands = manualBrands(manuals);
  const models = manualModels(manuals, brand === "all" ? undefined : brand);
  const withoutEquipment = equipmentFilter === NO_EQUIPMENT;
  const base = filterManuals(manuals, {
    query: search,
    type: type === "all" ? undefined : type,
    brand: brand === "all" ? undefined : brand,
    model: model === "all" ? undefined : model,
    equipmentId:
      equipmentFilter === "all" || withoutEquipment
        ? undefined
        : equipmentFilter,
  });
  // «Sin equipo asignado» es un filtro de la lista, no una búsqueda por id:
  // son los manuales que no apuntan a ningún equipo del inventario.
  const filtered = withoutEquipment
    ? base.filter((manual) => !manual.equipmentId)
    : base;

  const rights = { manage: canManage, userId: currentUserId };
  const equipmentOf = (manual: ManualDoc) =>
    equipment.find((item) => item._id === manual.equipmentId);

  /**
   * Las columnas que se pueden ordenar: la etiqueta que enseña la cabecera y de
   * dónde sale lo que ordena esa columna.
   */
  const columns = {
    manual: { label: "Manual", value: (manual: ManualDoc) => manual.title },
    type: { label: "Tipo", value: (manual: ManualDoc) => manual.type },
    brandModel: {
      label: "Marca y modelo",
      value: (manual: ManualDoc) =>
        [manual.brand, manual.model].filter(Boolean).join(" · "),
    },
    equipment: {
      label: "Equipo",
      value: (manual: ManualDoc) => {
        const linked = equipmentOf(manual);
        return linked ? equipmentLabel(linked) : "";
      },
    },
    updated: {
      label: "Actualizado",
      value: (manual: ManualDoc) => manual.updatedAt,
    },
  } as const;

  // El orden que elige quien mira, recordado para su próxima visita: sin nada
  // elegido, la lista se queda como llega (lo último que se tocó, primero).
  const [sort, setSort] = useTableSort({
    table: "manuals",
    columns,
    userId: currentUserId,
  });
  const rows = sortRows(
    filtered,
    (manual, column) => columns[column].value(manual),
    sort,
  );

  // El área de la tabla, para contar las filas que caben en su alto, y la lista
  // partida en páginas con esas filas: sin paginar, el pie con el recuento queda
  // a dos pantallas de la primera fila. Los filtros forman parte de la firma, así
  // que afinarlos vuelve a la primera página. El CSV se lleva `rows` —lo filtrado
  // y ordenado—, no solo la página.
  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: `${search}|${type}|${brand}|${model}|${equipmentFilter}`,
  });
  const visible = rows.slice(paging.from - 1, paging.to);

  /** Descarga en CSV lo que se ve en la tabla: los filtros y su orden. */
  const handleExport = () => {
    const header = [
      "Título",
      "Forma",
      "Tipo",
      "Marca",
      "Modelo",
      "Equipo",
      "Archivo",
      "Tamaño",
      "Autor",
      "Actualizado",
      "Nota",
    ];
    const exportRows = rows.map((manual) => [
      manual.title,
      MANUAL_KIND_META[manual.kind].label,
      manual.type,
      manual.brand ?? "",
      manual.model ?? "",
      equipmentOf(manual) ? equipmentLabel(equipmentOf(manual)!) : "",
      manualFileName(manual) ?? "",
      manual.size ? formatFileSize(manual.size) : "",
      manual.author ?? "",
      formatDate(manual.updatedAt),
      richDocToPlainText(manual.notes),
    ]);
    downloadCsv(csvFilename("manuales"), toCsv(header, exportRows));
    toast.success(`Manuales exportados: ${exportRows.length}`);
  };

  /** Deja el filtro en blanco (los selects no se pueden quedar sin valor). */
  const clearFilters = () => {
    setSearch("");
    setType("all");
    setBrand("all");
    setModel("all");
    setEquipmentFilter("all");
  };

  const filtering =
    search.trim() !== "" ||
    type !== "all" ||
    brand !== "all" ||
    model !== "all" ||
    equipmentFilter !== "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4">
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título, marca, modelo o nota"
                className="pl-9"
                aria-label="Buscar manual"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
              >
                <FileDown className="size-4" />
                CSV
              </Button>
              {canManage && (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setFormTarget({ manual: null })}
                >
                  <FileUp className="size-4" />
                  Subir manual
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Filtrar por tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {MANUAL_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={brand}
              onValueChange={(value) => {
                setBrand(value);
                setModel("all");
              }}
            >
              <SelectTrigger aria-label="Filtrar por marca">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brands.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger aria-label="Filtrar por modelo">
                <SelectValue placeholder="Modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los modelos</SelectItem>
                {models.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger aria-label="Filtrar por equipo">
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier equipo</SelectItem>
                <SelectItem value={NO_EQUIPMENT}>
                  Sin equipo asignado
                </SelectItem>
                {equipment.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {equipmentLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {manuals.length === 0 ? (
          <div className="p-10 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
              <BookOpen className="size-5" />
            </span>
            <p className="mt-4 text-base font-semibold tracking-tight">
              Todavía no hay manuales
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Sube el manual de un equipo en {MANUAL_FILE_FORMAT} o escribe una
              nota del taller con lo que conviene saber de un modelo. Tanto vale
              un manual de un modelo suelto como el de un equipo concreto.
            </p>
            {canManage && (
              <Button
                type="button"
                className="mt-5 gap-2"
                onClick={() => setFormTarget({ manual: null })}
              >
                <FileUp className="size-4" />
                Subir manual
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-semibold tracking-tight">
              Sin resultados
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Ningún manual coincide con los filtros de la lista.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={clearFilters}
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
                      column="manual"
                      label="Manual"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="type"
                      label="Tipo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHead
                      column="brandModel"
                      label="Marca y modelo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHead
                      column="equipment"
                      label="Equipo"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <SortableTableHead
                      column="updated"
                      label="Actualizado"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((manual) => {
                    const meta = MANUAL_KIND_META[manual.kind];
                    const linked = equipmentOf(manual);
                    return (
                      <TableRow key={manual._id} className="hover:bg-muted/40">
                        <TableCell className="max-w-[20rem]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={meta.badgeClassName}
                            >
                              {meta.label}
                            </Badge>
                            <span className="block truncate font-medium">
                              {manual.title}
                            </span>
                          </div>
                          <span className="block truncate text-xs text-muted-foreground">
                            {manual.kind === "file"
                              ? `${manualFileName(manual) ?? "Archivo"} · ${
                                  manual.size
                                    ? formatFileSize(manual.size)
                                    : "—"
                                }`
                              : manual.author
                                ? `Nota de ${manual.author}`
                                : "Nota del taller"}
                          </span>
                          <span className="block text-xs text-muted-foreground lg:hidden">
                            {manual.type}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {manual.type}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {[manual.brand, manual.model]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-muted-foreground">
                          {linked ? equipmentLabel(linked) : "—"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-muted-foreground">
                          {formatDate(manual.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Abrir ${manual.title}`}
                              onClick={() => setDetail(manual)}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {manual.kind === "file" && manual.url && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="size-8"
                              >
                                <a
                                  href={manual.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Descargar ${manual.title}`}
                                  title={`Abrir o descargar ${manualFileName(manual) ?? "el archivo"}`}
                                >
                                  <Download className="size-4" />
                                </a>
                              </Button>
                            )}
                            {canEditManual(manual, rights) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Editar ${manual.title}`}
                                onClick={() => setFormTarget({ manual })}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {canDeleteManual(manual, rights) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Borrar ${manual.title}`}
                                onClick={() => setDeleteTarget(manual)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
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
            singular="manual"
            plural="manuales"
            detail={filtering ? `${manuals.length} en el módulo` : undefined}
          />
        )}
      </div>

      {detail && (
        <ManualDetailSheet
          manual={detail}
          equipment={equipment}
          onClose={() => setDetail(null)}
        />
      )}

      {formTarget && (
        <ManualFormDialog
          key={formTarget.manual?._id ?? "nuevo"}
          manual={formTarget.manual}
          equipment={equipment}
          canManage={canManage}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deleteTarget && (
        <ManualDeleteDialog
          manual={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setDetail(null)}
        />
      )}
    </div>
  );
}
