import type { AiResultTable } from "./types";

function str(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Sí" : "No";
  return String(val);
}

/**
 * Convierte el resultado crudo de una herramienta de listado de `workshopTools`
 * en una tabla estructurada para mostrarla en la ventana principal.
 */
export function buildToolResultTable(
  toolName: string,
  data: unknown,
): AiResultTable | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const items = data.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
  );
  if (items.length === 0) return null;

  switch (toolName) {
    case "search_incidents":
      return {
        kind: "incidents",
        title: `Incidencias (${items.length})`,
        columns: [
          { key: "reference", label: "Referencia" },
          { key: "status", label: "Estado" },
          { key: "reportedAt", label: "Fecha" },
          { key: "model", label: "Equipo / Modelo" },
          { key: "description", label: "Descripción" },
        ],
        rows: items.map((row) => ({
          ref: typeof row.reference === "string" ? row.reference : undefined,
          cells: {
            reference: str(row.reference),
            status: str(row.status),
            reportedAt: str(row.reportedAt),
            model: str(row.model),
            description: str(row.description),
          },
        })),
      };

    case "search_equipment":
      return {
        kind: "equipment",
        title: `Equipos (${items.length})`,
        columns: [
          { key: "code", label: "Código" },
          { key: "name", label: "Nombre" },
          { key: "brand", label: "Marca" },
          { key: "model", label: "Modelo" },
          { key: "location", label: "Ubicación" },
        ],
        rows: items.map((row) => ({
          ref: typeof row.code === "string" ? row.code : str(row.model),
          cells: {
            code: str(row.code),
            name: str(row.name),
            brand: str(row.brand),
            model: str(row.model),
            location: str(row.location),
          },
        })),
      };

    case "search_spare_parts":
      return {
        kind: "parts",
        title: `Repuestos (${items.length})`,
        columns: [
          { key: "code", label: "Código" },
          { key: "name", label: "Nombre" },
          { key: "category", label: "Categoría" },
          { key: "stock", label: "Stock" },
          { key: "minStock", label: "Mínimo" },
          { key: "location", label: "Ubicación" },
        ],
        rows: items.map((row) => ({
          ref: typeof row.code === "string" ? row.code : undefined,
          cells: {
            code: str(row.code),
            name: str(row.name),
            category: str(row.category),
            stock: `${str(row.stock)} ${row.unit ? str(row.unit) : ""}`.trim(),
            minStock: str(row.minStock),
            location: str(row.location),
          },
        })),
      };

    case "search_part_requests":
      return {
        kind: "requests",
        title: `Peticiones de repuesto (${items.length})`,
        columns: [
          { key: "reference", label: "Referencia" },
          { key: "status", label: "Estado" },
          { key: "priority", label: "Prioridad" },
          { key: "requesterName", label: "Solicitante" },
          { key: "equipment", label: "Equipo" },
        ],
        rows: items.map((row) => ({
          ref: typeof row.reference === "string" ? row.reference : undefined,
          cells: {
            reference: str(row.reference),
            status: str(row.status),
            priority: str(row.priority),
            requesterName: str(row.requesterName),
            equipment: str(row.equipment),
          },
        })),
      };

    case "search_purchase_orders":
      return {
        kind: "purchasing",
        title: `Órdenes de compra (${items.length})`,
        columns: [
          { key: "reference", label: "Referencia" },
          { key: "status", label: "Estado" },
          { key: "supplier", label: "Proveedor" },
          { key: "itemsCount", label: "Líneas" },
        ],
        rows: items.map((row) => ({
          ref: typeof row.reference === "string" ? row.reference : undefined,
          cells: {
            reference: str(row.reference),
            status: str(row.status),
            supplier: str(row.supplier),
            itemsCount: str(row.itemsCount),
          },
        })),
      };

    case "search_manuals":
      return {
        kind: "manuals",
        title: `Manuales (${items.length})`,
        columns: [
          { key: "title", label: "Título" },
          { key: "type", label: "Tipo" },
          { key: "brand", label: "Marca" },
          { key: "model", label: "Modelo" },
        ],
        rows: items.map((row) => ({
          id: typeof row.id === "string" ? row.id : undefined,
          ref: typeof row.title === "string" ? row.title : undefined,
          cells: {
            title: str(row.title),
            type: str(row.type),
            brand: str(row.brand),
            model: str(row.model),
          },
        })),
      };

    default:
      return null;
  }
}
