import { useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/TableSort";
import type { TableSort } from "@/lib/tableSort";
import {
  PURCHASE_HISTORY_COLUMNS,
  buildPurchaseHistoryRows,
  filterPurchaseHistoryRows,
  historyRowsToCsv,
  historyRowsToTsv,
  selectedCellsToTsv,
  sortPurchaseHistoryRows,
  type PurchaseHistoryColumn,
  type PurchaseHistoryFilters,
  type PurchaseOrderDoc,
} from "@/lib/purchasing";
import type { ReceptionDoc } from "../types";

export interface HistorySectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
}

/** Histórico en formato tabla tipo Excel / Hoja de cálculo */
export function HistorySection({ orders, receptions }: HistorySectionProps) {
  // Filtros
  const [filters, setFilters] = useState<PurchaseHistoryFilters>({
    query: "",
    pedido: "",
    solicitud: "",
    proveedor: "todos",
    descripcion: "",
    observaciones: "",
    estado: "todos",
    fechaTipo: "pedido",
    fechaDesde: "",
    fechaHasta: "",
  });
  const [filtrosAvanzadosAbiertos, setFiltrosAvanzadosAbiertos] = useState(false);

  // Ordenación
  const [sort, setSort] = useState<TableSort<PurchaseHistoryColumn> | null>(null);

  // Selección de celdas (formato "rowId:columnKey")
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const [copiado, setCopiado] = useState(false);

  const allRows = useMemo(
    () => buildPurchaseHistoryRows(orders, receptions),
    [orders, receptions],
  );

  const proveedores = useMemo(() => {
    const list = [...new Set(allRows.map((r) => r.supplier).filter(Boolean))];
    return list.sort((a, b) => a.localeCompare(b, "es"));
  }, [allRows]);

  // Contar cuántos filtros avanzados están activos
  const filtrosActivosCount = useMemo(() => {
    let count = 0;
    if (filters.pedido?.trim()) count++;
    if (filters.solicitud?.trim()) count++;
    if (filters.proveedor && filters.proveedor !== "todos") count++;
    if (filters.descripcion?.trim()) count++;
    if (filters.observaciones?.trim()) count++;
    if (filters.estado && filters.estado !== "todos") count++;
    if (filters.fechaDesde) count++;
    if (filters.fechaHasta) count++;
    return count;
  }, [filters]);

  const limpiarFiltros = () => {
    setFilters({
      query: "",
      pedido: "",
      solicitud: "",
      proveedor: "todos",
      descripcion: "",
      observaciones: "",
      estado: "todos",
      fechaTipo: "pedido",
      fechaDesde: "",
      fechaHasta: "",
    });
  };

  // Filtrado y ordenación
  const filteredAndSortedRows = useMemo(() => {
    const filtered = filterPurchaseHistoryRows(allRows, filters);
    return sortPurchaseHistoryRows(filtered, sort);
  }, [allRows, filters, sort]);

  // Manejo de selección de celdas
  const columnasLista: PurchaseHistoryColumn[] = [
    "orderReference",
    "solicitudeCode",
    "position",
    "description",
    "quantity",
    "receivedQuantity",
    "supplier",
    "observations",
    "pendingQuantity",
    "orderedDate",
    "receivedDate",
  ];

  const toggleCelda = (rowId: string, colKey: PurchaseHistoryColumn) => {
    const key = `${rowId}:${colKey}`;
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleFila = (rowId: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      const rowKeys = columnasLista.map((c) => `${rowId}:${c}`);
      const todasMarcadas = rowKeys.every((k) => next.has(k));
      if (todasMarcadas) {
        rowKeys.forEach((k) => next.delete(k));
      } else {
        rowKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const toggleTodas = () => {
    if (selectedCells.size > 0) {
      setSelectedCells(new Set());
    } else {
      const allKeys = new Set<string>();
      for (const row of filteredAndSortedRows) {
        for (const col of columnasLista) {
          allKeys.add(`${row.id}:${col}`);
        }
      }
      setSelectedCells(allKeys);
    }
  };

  const copiarPortapapeles = async () => {
    if (filteredAndSortedRows.length === 0) {
      toast.error("No hay datos para copiar");
      return;
    }

    try {
      let tsv = "";
      let mensaje = "";

      if (selectedCells.size > 0) {
        tsv = selectedCellsToTsv(filteredAndSortedRows, selectedCells);
        mensaje = `${selectedCells.size} celda${selectedCells.size === 1 ? "" : "s"} señalada${selectedCells.size === 1 ? "" : "s"} copiada${selectedCells.size === 1 ? "" : "s"} al portapapeles`;
      } else {
        tsv = historyRowsToTsv(filteredAndSortedRows);
        mensaje = `Toda la tabla visible (${filteredAndSortedRows.length} fila${filteredAndSortedRows.length === 1 ? "" : "s"}) copiada al portapapeles`;
      }

      await navigator.clipboard.writeText(tsv);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success(mensaje, {
        description:
          "Pégalas directamente en Excel con Ctrl + V para pegarlas en sus celdas correspondientes.",
      });
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const descargarCsv = () => {
    if (filteredAndSortedRows.length === 0) {
      toast.error("No hay filas para exportar");
      return;
    }
    const csv = historyRowsToCsv(filteredAndSortedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_compras_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo CSV generado para Excel");
  };

  if (allRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-xs">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <FileSpreadsheet className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          No hay compras en el histórico
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          A medida que crees órdenes de compra y les asignes códigos de solicitud,
          se irán registrando aquí en formato tipo hoja de cálculo listo para copiar o exportar.
        </p>
      </div>
    );
  }

  const todasLasFilasSeleccionadas =
    filteredAndSortedRows.length > 0 &&
    filteredAndSortedRows.every((r) =>
      columnasLista.every((c) => selectedCells.has(`${r.id}:${c}`)),
    );

  return (
    <div className="grid gap-4">
      {/* Barra de herramientas principal */}
      <Card>
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query ?? ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, query: e.target.value }))
                  }
                  placeholder="Buscar en todos los campos..."
                  className="h-9 pl-8 text-sm"
                />
              </div>

              {proveedores.length > 1 && (
                <select
                  value={filters.proveedor ?? "todos"}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      proveedor: e.target.value,
                    }))
                  }
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="todos">Todos los proveedores</option>
                  {proveedores.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}

              <Button
                type="button"
                variant={filtrosAvanzadosAbiertos || filtrosActivosCount > 0 ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setFiltrosAvanzadosAbiertos((prev) => !prev)}
              >
                <SlidersHorizontal className="size-4" />
                Filtros avanzados
                {filtrosActivosCount > 0 && (
                  <Badge variant="default" className="size-5 rounded-full p-0 text-[10px] justify-center">
                    {filtrosActivosCount}
                  </Badge>
                )}
              </Button>

              {filtrosActivosCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                  onClick={limpiarFiltros}
                >
                  <X className="size-3.5" />
                  Limpiar filtros
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCells.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setSelectedCells(new Set())}
                >
                  <X className="size-3.5" />
                  Deseleccionar ({selectedCells.size})
                </Button>
              )}

              <Button
                type="button"
                variant={selectedCells.size > 0 ? "default" : "secondary"}
                size="sm"
                className="gap-2"
                onClick={() => void copiarPortapapeles()}
              >
                {copiado ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiado
                  ? "¡Copiado a Excel!"
                  : selectedCells.size > 0
                    ? `Copiar selección (${selectedCells.size} celdas)`
                    : `Copiar visibles (${filteredAndSortedRows.length} filas)`}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={descargarCsv}
              >
                <Download className="size-4" />
                CSV
              </Button>
            </div>
          </div>

          {/* Panel Desplegable de Filtros Avanzados y Fechas */}
          {filtrosAvanzadosAbiertos && (
            <div className="mt-2 grid gap-4 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <Filter className="size-3.5" />
                  Filtros por campos específicos y fechas
                </span>
                {filtrosActivosCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={limpiarFiltros}
                  >
                    Restablecer todos
                  </Button>
                )}
              </div>

              {/* Rango de fechas */}
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Filtrar fecha por:
                  </label>
                  <select
                    value={filters.fechaTipo ?? "pedido"}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fechaTipo: e.target.value as "pedido" | "recepcion" | "ambas",
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="pedido">Fecha de pedido (F. PEDIDO)</option>
                    <option value="recepcion">Fecha de recepción (F. RECEP.)</option>
                    <option value="ambas">Cualquiera de las dos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Fecha Desde:
                  </label>
                  <Input
                    type="date"
                    value={filters.fechaDesde ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fechaDesde: e.target.value,
                      }))
                    }
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Fecha Hasta:
                  </label>
                  <Input
                    type="date"
                    value={filters.fechaHasta ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fechaHasta: e.target.value,
                      }))
                    }
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              {/* Campos específicos */}
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Nº Pedido:
                  </label>
                  <Input
                    value={filters.pedido ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        pedido: e.target.value,
                      }))
                    }
                    placeholder="Ej. OC-0001"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Nº Solicitud:
                  </label>
                  <Input
                    value={filters.solicitud ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        solicitud: e.target.value,
                      }))
                    }
                    placeholder="Ej. 10034573"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Descripción / Repuesto:
                  </label>
                  <Input
                    value={filters.descripcion ?? ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        descripcion: e.target.value,
                      }))
                    }
                    placeholder="Nombre o código"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Estado de entrega:
                  </label>
                  <select
                    value={filters.estado ?? "todos"}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        estado: e.target.value as "todos" | "pendientes" | "recibidos" | "parciales",
                      }))
                    }
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="pendientes">Pendientes (con piezas por recibir)</option>
                    <option value="recibidos">Completados (todo recibido)</option>
                    <option value="parciales">Recibidos parcialmente</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla interactiva estilo Excel / Base de Datos */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="max-h-[70vh] overflow-auto select-none">
          <Table className="border-collapse text-xs">
            <TableHeader className="sticky top-0 z-10 bg-primary/95 text-white backdrop-blur-xs">
              <TableRow className="border-b border-primary/20 hover:bg-transparent">
                {/* Checkbox de selección global */}
                <TableHead className="w-[40px] px-2 text-center text-white">
                  <button
                    type="button"
                    onClick={toggleTodas}
                    title={
                      todasLasFilasSeleccionadas
                        ? "Deseleccionar todas las celdas"
                        : "Seleccionar todas las celdas"
                    }
                    className="flex size-full items-center justify-center text-white hover:opacity-80"
                  >
                    {todasLasFilasSeleccionadas ? (
                      <CheckSquare className="size-4 text-white" />
                    ) : (
                      <Square className="size-4 text-white opacity-70" />
                    )}
                  </button>
                </TableHead>

                <SortableTableHead
                  column="orderReference"
                  label={PURCHASE_HISTORY_COLUMNS.orderReference.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[95px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="solicitudeCode"
                  label={PURCHASE_HISTORY_COLUMNS.solicitudeCode.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[115px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="position"
                  label={PURCHASE_HISTORY_COLUMNS.position.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[75px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="description"
                  label={PURCHASE_HISTORY_COLUMNS.description.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="min-w-[220px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="quantity"
                  label={PURCHASE_HISTORY_COLUMNS.quantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="receivedQuantity"
                  label={PURCHASE_HISTORY_COLUMNS.receivedQuantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="supplier"
                  label={PURCHASE_HISTORY_COLUMNS.supplier.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[130px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="observations"
                  label={PURCHASE_HISTORY_COLUMNS.observations.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="min-w-[150px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="pendingQuantity"
                  label={PURCHASE_HISTORY_COLUMNS.pendingQuantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="orderedDate"
                  label={PURCHASE_HISTORY_COLUMNS.orderedDate.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[100px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="receivedDate"
                  label={PURCHASE_HISTORY_COLUMNS.receivedDate.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[100px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60 font-sans">
              {filteredAndSortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No se encontraron líneas con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedRows.map((row) => {
                  const completado = row.pendingQuantity === 0;
                  const filaSeleccionada = columnasLista.every((c) =>
                    selectedCells.has(`${row.id}:${c}`),
                  );

                  const renderCelda = (
                    col: PurchaseHistoryColumn,
                    content: React.ReactNode,
                    className: string = "",
                    title?: string,
                  ) => {
                    const isSelected = selectedCells.has(`${row.id}:${col}`);
                    return (
                      <TableCell
                        key={col}
                        onClick={() => toggleCelda(row.id, col)}
                        title={title ?? "Haz clic para señalar/deseleccionar esta celda"}
                        className={`cursor-pointer transition-colors select-text ${className} ${
                          isSelected
                            ? "bg-primary/20 text-foreground font-semibold ring-2 ring-primary ring-inset shadow-xs"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        {content}
                      </TableCell>
                    );
                  };

                  return (
                    <TableRow
                      key={row.id}
                      className={`border-b border-border/40 transition-colors ${
                        filaSeleccionada
                          ? "bg-primary/10"
                          : "even:bg-muted/15 hover:bg-muted/30"
                      }`}
                    >
                      {/* Checkbox selector de fila */}
                      <TableCell className="w-[40px] px-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleFila(row.id)}
                          title={
                            filaSeleccionada
                              ? "Deseleccionar esta fila"
                              : "Seleccionar todas las celdas de esta fila"
                          }
                          className="flex size-full items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          {filaSeleccionada ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 opacity-50" />
                          )}
                        </button>
                      </TableCell>

                      {renderCelda(
                        "orderReference",
                        row.orderReference,
                        "font-mono font-semibold text-foreground",
                      )}
                      {renderCelda(
                        "solicitudeCode",
                        row.solicitudeCode ? (
                          <span className="font-bold text-foreground">
                            {row.solicitudeCode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">—</span>
                        ),
                      )}
                      {renderCelda(
                        "position",
                        row.position,
                        "text-right font-semibold text-foreground",
                      )}
                      {renderCelda(
                        "description",
                        <span className="block max-w-[280px] truncate">
                          {row.description}
                        </span>,
                        "text-foreground",
                        row.description,
                      )}
                      {renderCelda(
                        "quantity",
                        row.quantity,
                        "text-right font-bold text-foreground",
                      )}
                      {renderCelda(
                        "receivedQuantity",
                        row.receivedQuantity,
                        "text-right font-bold text-foreground",
                      )}
                      {renderCelda(
                        "supplier",
                        row.supplier,
                        "text-muted-foreground",
                      )}
                      {renderCelda(
                        "observations",
                        <span className="block max-w-[200px] truncate">
                          {row.observations || "—"}
                        </span>,
                        "text-muted-foreground",
                        row.observations,
                      )}
                      {renderCelda(
                        "pendingQuantity",
                        row.pendingQuantity,
                        `text-right font-semibold ${
                          completado
                            ? "text-muted-foreground/60"
                            : "font-bold text-amber-600 dark:text-amber-400"
                        }`,
                      )}
                      {renderCelda(
                        "orderedDate",
                        row.orderedDate,
                        "text-muted-foreground",
                      )}
                      {renderCelda(
                        "receivedDate",
                        row.receivedDate || "—",
                        "font-medium text-foreground",
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Mostrando <strong>{filteredAndSortedRows.length}</strong> de{" "}
            <strong>{allRows.length}</strong> líneas de compra
            {selectedCells.size > 0 && (
              <span className="ml-2 font-medium text-primary">
                ({selectedCells.size} celdas señaladas)
              </span>
            )}
          </span>
          <span className="italic">
            💡 Haz clic en cualquier celda para señalarla o usa la casilla de la izquierda para filas enteras. Pulsa en las cabeceras para ordenar.
          </span>
        </div>
      </Card>
    </div>
  );
}
