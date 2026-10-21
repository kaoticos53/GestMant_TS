import type { Doc } from "../convex/_generated/dataModel";
import {
  isPurchaseRequestAwaitingDelivery,
  isPurchaseRequestUntreated,
} from "./purchaseFlow";
import { canBuyForRequest } from "./requestFlow";
import { escapeCsvCell } from "./export";

/**
 * Compras: la copia que lee la pantalla y las cuentas que hace.
 *
 * Los estados del backend viven en el esquema; aquí están sus etiquetas y los
 * dos cálculos que la pantalla necesita una y otra vez —cómo se agrupa lo que
 * espera por proveedor y cuánto de una orden ha llegado—, fuera de los
 * componentes para poder probarlos sin navegador (mismo criterio que
 * `browse.ts`, `chatPanel.ts` o `sidebar.ts`).
 */

export type PurchaseRequestStatus =
  "pending" | "ordered" | "received" | "cancelled";

export type PurchaseOrderStatus =
  "pending" | "partial" | "completed" | "cancelled";

export type PurchaseRequestDoc = Doc<"purchaseRequests">;
export type PurchaseOrderDoc = Doc<"purchaseOrders">;
export type PurchaseOrderLine = PurchaseOrderDoc["lines"][number];

export const PURCHASE_REQUEST_STATUS_META: Record<
  PurchaseRequestStatus,
  { label: string; badgeClassName: string }
> = {
  pending: {
    label: "Sin tratar",
    badgeClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  },
  ordered: {
    label: "Pedido al proveedor",
    badgeClassName: "border-sky-600/25 bg-sky-600/10 text-sky-700",
  },
  received: {
    label: "Recibido",
    badgeClassName: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
  },
  cancelled: {
    label: "Retirada",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export const PURCHASE_ORDER_STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; description: string; badgeClassName: string }
> = {
  pending: {
    label: "Pendiente",
    description: "Enviada al proveedor; todavía no ha llegado nada",
    badgeClassName: "border-sky-600/25 bg-sky-600/10 text-sky-700",
  },
  partial: {
    label: "Parcial",
    description: "Ha llegado parte del material",
    badgeClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  },
  completed: {
    label: "Completada",
    description: "Ha llegado todo lo que se pidió",
    badgeClassName: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
  },
  cancelled: {
    label: "Anulada",
    description: "Sus peticiones de compra han vuelto a la cola",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/** Por qué se compra: es lo que se lee en la ficha de la compra. */
export const PURCHASE_REASON_META: Record<
  PurchaseRequestDoc["reason"],
  string
> = {
  noStock: "No hay existencias suficientes",
  newPart: "Repuesto nuevo: no estaba en el almacén",
  other: "Otro motivo",
};

/** Lo que le falta a un artículo de una orden por llegar. */
export function pendingQuantity(line: PurchaseOrderLine): number {
  return Math.max(0, line.quantity - line.receivedQuantity);
}

/** Cuánto lleva recibido una orden, sumando sus artículos. */
export function orderTotals(order: PurchaseOrderDoc) {
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const received = order.lines.reduce(
    (sum, line) => sum + Math.min(line.receivedQuantity, line.quantity),
    0,
  );
  const pending = Math.max(0, quantity - received);
  return {
    quantity,
    received,
    pending,
    /** 0..1, para la barra de progreso. Sin artículos no se pinta nada. */
    ratio: quantity === 0 ? 0 : Math.min(1, received / quantity),
  };
}

export interface SupplierGroup {
  supplier: string;
  items: PurchaseRequestDoc[];
  /** Cuántas unidades se compran en total dentro del grupo. */
  quantity: number;
  /** Cuántas peticiones de repuesto distintas esperan detrás del grupo. */
  requests: number;
}

/**
 * Lo que espera a que alguien monte la orden, agrupado por proveedor. Solo
 * entran las peticiones de compra **sin tratar**: lo que ya está en una orden o
 * ha llegado no se compra otra vez. Dentro de cada grupo, lo más antiguo
 * primero: es lo que lleva más tiempo parado.
 */
export function groupBySupplier(
  requests: PurchaseRequestDoc[],
): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const row of requests) {
    // Solo lo sin tratar: lo que ya está en una orden o ha llegado no se compra
    // otra vez (`lib/purchaseFlow`).
    if (!isPurchaseRequestUntreated(row.status)) continue;
    const group = groups.get(row.supplier) ?? {
      supplier: row.supplier,
      items: [],
      quantity: 0,
      requests: 0,
    };
    group.items.push(row);
    group.quantity += row.quantity;
    groups.set(row.supplier, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.createdAt - b.createdAt),
      requests: new Set(group.items.map((row) => row.requestReference)).size,
    }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier, "es"));
}

/**
 * Las peticiones de repuesto que siguen sin material: las que tienen alguna
 * línea que el almacén no cubre. Es la lista desde la que el responsable genera
 * las peticiones de compra, así que se mira el catálogo que hay ahora mismo.
 */
export function requestsMissingStock(
  requests: Doc<"partRequests">[],
  parts: Pick<Doc<"spareParts">, "_id" | "stock">[],
  purchaseRequests: PurchaseRequestDoc[],
) {
  const stock = new Map(parts.map((part) => [part._id, part.stock]));
  const covered = new Set(
    purchaseRequests
      .filter(isPurchaseRequestAwaitingDelivery)
      .map((row) => `${row.requestId}:${row.sparePartId}`),
  );
  return requests
    .filter(
      (request) =>
        request.archivedAt === undefined && canBuyForRequest(request.status),
    )
    .map((request) => {
      const missing = request.lines.filter((line) => {
        const hay = stock.get(line.sparePartId) ?? 0;
        return (
          line.quantity > hay &&
          !covered.has(`${request._id}:${line.sparePartId}`)
        );
      });
      return { request, missing };
    })
    .filter((row) => row.missing.length > 0)
    .sort((a, b) => a.request.createdAt - b.request.createdAt);
}

/** «2 peticiones · 3 artículos · 5 ud»: el resumen de un grupo de proveedor. */
export function groupSummary(group: SupplierGroup): string {
  const peticiones =
    group.requests === 1 ? "1 petición" : `${group.requests} peticiones`;
  const articulos =
    group.items.length === 1 ? "1 artículo" : `${group.items.length} artículos`;
  return `${peticiones} · ${articulos} · ${group.quantity} ud`;
}

/* ------------------------------------------------------------------ */
/* Histórico en formato tabla tipo Excel / Hoja de cálculo            */
/* ------------------------------------------------------------------ */

/** Formatea una fecha como DD/MM/YYYY para la tabla de histórico. */
export function formatNumericDate(timestamp?: number | null): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface PurchaseHistoryRow {
  id: string;
  orderId: string;
  orderReference: string; // PEDIDO
  solicitudeCode: string; // SOLICITUD
  position: number; // POSICIÓN (10, 20, 30...)
  description: string; // DESCRIPCIÓN
  quantity: number; // UNIDADES
  receivedQuantity: number; // RECIBIDO
  supplier: string; // PROVEEDOR
  observations: string; // OBSERVACIONES
  pendingQuantity: number; // PENDIENTE
  orderedDate: string; // F. PEDIDO (DD/MM/YYYY)
  receivedDate: string; // F. RECEP. (DD/MM/YYYY)
}

/**
 * Compone las filas para el histórico con el formato idéntico al documento Excel
 * de compras: cada línea de orden con su posición, descripción, cantidades,
 * proveedor, notas y fechas.
 */
export function buildPurchaseHistoryRows(
  orders: PurchaseOrderDoc[],
  receptions: Pick<Doc<"receptions">, "orderId" | "receivedAt" | "lines">[],
): PurchaseHistoryRow[] {
  const sortedOrders = [...orders].sort((a, b) => b.orderedAt - a.orderedAt);
  const rows: PurchaseHistoryRow[] = [];

  for (const order of sortedOrders) {
    const orderReceptions = receptions.filter((r) => r.orderId === order._id);

    order.lines.forEach((line, index) => {
      const position = (index + 1) * 10;

      let receivedDate = "";
      if (line.receivedQuantity > 0) {
        const matchingReceptions = orderReceptions.filter((r) =>
          r.lines.some((rl) => rl.sparePartId === line.sparePartId),
        );
        if (matchingReceptions.length > 0) {
          const latestAt = Math.max(
            ...matchingReceptions.map((r) => r.receivedAt),
          );
          receivedDate = formatNumericDate(latestAt);
        }
      }

      const pending = Math.max(0, line.quantity - line.receivedQuantity);
      const observations = line.note?.trim() || order.notes?.trim() || "";
      const description = `${line.code} - ${line.name}`;

      rows.push({
        id: `${order._id}-${line.purchaseRequestId}-${index}`,
        orderId: order._id,
        orderReference: order.reference,
        solicitudeCode: order.solicitudeCode ?? "",
        position,
        description,
        quantity: line.quantity,
        receivedQuantity: line.receivedQuantity,
        supplier: order.supplier,
        observations,
        pendingQuantity: pending,
        orderedDate: formatNumericDate(order.orderedAt),
        receivedDate,
      });
    });
  }

  return rows;
}

export const PURCHASE_HISTORY_HEADERS = [
  "PEDIDO",
  "SOLICITUD",
  "POSICIÓN",
  "DESCRIPCIÓN",
  "UNIDADES",
  "RECIBIDO",
  "PROVEEDOR",
  "OBSERVACIONES",
  "PENDIENTE",
  "F. PEDIDO",
  "F. RECEP.",
] as const;

/**
 * Convierte las filas a formato TSV (valores separados por tabulador)
 * listo para copiar al portapapeles y pegar de forma nativa en celdas de Excel.
 */
export function historyRowsToTsv(
  rows: PurchaseHistoryRow[],
  includeHeaders: boolean = true,
): string {
  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(PURCHASE_HISTORY_HEADERS.join("\t"));
  }

  for (const row of rows) {
    lines.push(
      [
        row.orderReference,
        row.solicitudeCode,
        row.position,
        row.description,
        row.quantity,
        row.receivedQuantity,
        row.supplier,
        row.observations,
        row.pendingQuantity,
        row.orderedDate,
        row.receivedDate,
      ]
        .map((val) => String(val ?? "").replace(/[\t\r\n]/g, " "))
        .join("\t"),
    );
  }

  return lines.join("\n");
}

/**
 * Genera el contenido CSV con delimitador punto y coma y BOM UTF-8
 * para máxima compatibilidad al abrir en Excel en español / Europa.
 */
export function historyRowsToCsv(rows: PurchaseHistoryRow[]): string {
  const lines = [
    PURCHASE_HISTORY_HEADERS.map(escapeCsvCell).join(";"),
    ...rows.map((row) =>
      [
        row.orderReference,
        row.solicitudeCode,
        row.position,
        row.description,
        row.quantity,
        row.receivedQuantity,
        row.supplier,
        row.observations,
        row.pendingQuantity,
        row.orderedDate,
        row.receivedDate,
      ]
        .map(escapeCsvCell)
        .join(";"),
    ),
  ];

  return "\uFEFF" + lines.join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Ordenación y filtros avanzados del Histórico                       */
/* ------------------------------------------------------------------ */

/** Parsea una fecha DD/MM/YYYY a timestamp unix para comparaciones. */
export function parseNumericDate(dateStr?: string | null): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date.getTime();
}

export type PurchaseHistoryColumn =
  | "orderReference"
  | "solicitudeCode"
  | "position"
  | "description"
  | "quantity"
  | "receivedQuantity"
  | "supplier"
  | "observations"
  | "pendingQuantity"
  | "orderedDate"
  | "receivedDate";

export const PURCHASE_HISTORY_COLUMNS: Record<
  PurchaseHistoryColumn,
  { label: string; align?: "left" | "right" }
> = {
  orderReference: { label: "PEDIDO" },
  solicitudeCode: { label: "SOLICITUD" },
  position: { label: "POSICIÓN", align: "right" },
  description: { label: "DESCRIPCIÓN" },
  quantity: { label: "UNIDADES", align: "right" },
  receivedQuantity: { label: "RECIBIDO", align: "right" },
  supplier: { label: "PROVEEDOR" },
  observations: { label: "OBSERVACIONES" },
  pendingQuantity: { label: "PENDIENTE", align: "right" },
  orderedDate: { label: "F. PEDIDO" },
  receivedDate: { label: "F. RECEP." },
};

export function sortPurchaseHistoryRows(
  rows: PurchaseHistoryRow[],
  sort: { column: PurchaseHistoryColumn; direction: "asc" | "desc" } | null,
): PurchaseHistoryRow[] {
  if (!sort) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sort.column) {
      case "position":
      case "quantity":
      case "receivedQuantity":
      case "pendingQuantity":
        return (a[sort.column] - b[sort.column]) * factor;

      case "orderedDate":
      case "receivedDate": {
        const timeA =
          parseNumericDate(a[sort.column]) ??
          (sort.direction === "asc" ? Infinity : -Infinity);
        const timeB =
          parseNumericDate(b[sort.column]) ??
          (sort.direction === "asc" ? Infinity : -Infinity);
        return (timeA - timeB) * factor;
      }

      case "orderReference":
      case "solicitudeCode":
      case "description":
      case "supplier":
      case "observations":
      default:
        return (
          a[sort.column].localeCompare(b[sort.column], "es", {
            numeric: true,
            sensitivity: "base",
          }) * factor
        );
    }
  });
}

export interface PurchaseHistoryFilters {
  query?: string;
  pedido?: string;
  solicitud?: string;
  proveedor?: string;
  descripcion?: string;
  observaciones?: string;
  estado?: "todos" | "pendientes" | "recibidos" | "parciales";
  fechaTipo?: "pedido" | "recepcion" | "ambas";
  fechaDesde?: string; // YYYY-MM-DD
  fechaHasta?: string; // YYYY-MM-DD
}

export function filterPurchaseHistoryRows(
  rows: PurchaseHistoryRow[],
  filters: PurchaseHistoryFilters,
): PurchaseHistoryRow[] {
  return rows.filter((row) => {
    // Búsqueda general
    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase().trim();
      const match =
        row.orderReference.toLowerCase().includes(q) ||
        row.solicitudeCode.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.supplier.toLowerCase().includes(q) ||
        row.observations.toLowerCase().includes(q) ||
        String(row.position).includes(q);
      if (!match) return false;
    }

    // Filtros por campo específico
    if (
      filters.pedido?.trim() &&
      !row.orderReference
        .toLowerCase()
        .includes(filters.pedido.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filters.solicitud?.trim() &&
      !row.solicitudeCode
        .toLowerCase()
        .includes(filters.solicitud.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filters.proveedor &&
      filters.proveedor !== "todos" &&
      row.supplier.toLowerCase() !== filters.proveedor.toLowerCase()
    ) {
      return false;
    }
    if (
      filters.descripcion?.trim() &&
      !row.description
        .toLowerCase()
        .includes(filters.descripcion.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filters.observaciones?.trim() &&
      !row.observations
        .toLowerCase()
        .includes(filters.observaciones.toLowerCase().trim())
    ) {
      return false;
    }

    // Filtro de estado
    if (filters.estado === "pendientes" && row.pendingQuantity <= 0) {
      return false;
    }
    if (filters.estado === "recibidos" && row.pendingQuantity > 0) {
      return false;
    }
    if (
      filters.estado === "parciales" &&
      !(row.receivedQuantity > 0 && row.pendingQuantity > 0)
    ) {
      return false;
    }

    // Filtro por rango de fechas
    if (filters.fechaDesde || filters.fechaHasta) {
      const tipo = filters.fechaTipo ?? "pedido";
      const desde = filters.fechaDesde
        ? new Date(`${filters.fechaDesde}T00:00:00`).getTime()
        : -Infinity;
      const hasta = filters.fechaHasta
        ? new Date(`${filters.fechaHasta}T23:59:59.999`).getTime()
        : Infinity;

      const timePedido = parseNumericDate(row.orderedDate);
      const timeRecep = parseNumericDate(row.receivedDate);

      if (tipo === "pedido") {
        if (timePedido === null) return false;
        if (timePedido < desde || timePedido > hasta) return false;
      } else if (tipo === "recepcion") {
        if (timeRecep === null) return false;
        if (timeRecep < desde || timeRecep > hasta) return false;
      } else {
        // ambas
        const pedidoOk =
          timePedido !== null && timePedido >= desde && timePedido <= hasta;
        const recepOk =
          timeRecep !== null && timeRecep >= desde && timeRecep <= hasta;
        if (!pedidoOk && !recepOk) return false;
      }
    }

    return true;
  });
}

/**
 * Convierte exactamente las celdas seleccionadas a formato TSV (tabulado)
 * listo para pegar en Excel, conservando la cuadrícula relativa seleccionada.
 */
export function selectedCellsToTsv(
  rows: PurchaseHistoryRow[],
  selectedCellKeys: Set<string>,
): string {
  if (selectedCellKeys.size === 0) return "";

  const colKeys: PurchaseHistoryColumn[] = [
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

  // Identificar columnas involucradas en la selección
  const activeCols = colKeys.filter((col) =>
    rows.some((row) => selectedCellKeys.has(`${row.id}:${col}`)),
  );

  // Filas involucradas en la selección (en orden actual)
  const activeRows = rows.filter((row) =>
    activeCols.some((col) => selectedCellKeys.has(`${row.id}:${col}`)),
  );

  const lines: string[] = [];
  for (const row of activeRows) {
    const rowValues = activeCols.map((col) => {
      if (selectedCellKeys.has(`${row.id}:${col}`)) {
        return String(row[col] ?? "").replace(/[\t\r\n]/g, " ");
      }
      return "";
    });
    lines.push(rowValues.join("\t"));
  }

  return lines.join("\n");
}


