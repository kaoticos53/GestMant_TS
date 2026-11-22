import type { AiToolDefinition, AiToolModule } from "./types";

export const ALL_AI_TOOL_MODULES: readonly AiToolModule[] = [
  "equipment",
  "incidents",
  "requests",
  "purchasing",
  "parts",
  "manuals",
];

export const AI_TOOL_MODULE_LABELS: Record<AiToolModule, string> = {
  equipment: "Equipos y mantenimientos",
  incidents: "Incidencias",
  requests: "Peticiones de repuestos",
  purchasing: "Compras y recepciones",
  parts: "Inventario de repuestos",
  manuals: "Manuales técnicos",
};

export type UserModuleCapabilities = Record<AiToolModule, boolean>;

export const AI_WORKSHOP_TOOLS: readonly AiToolDefinition[] = [
  {
    type: "function",
    module: "core",
    function: {
      name: "get_workshop_stats",
      description:
        "Devuelve contadores generales reales del taller (equipos, incidencias abiertas/totales, repuestos bajo mínimo, peticiones y órdenes de compra).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    module: "equipment",
    function: {
      name: "search_equipment",
      description:
        "Busca equipos del inventario por código (EQ-XXX), marca, modelo, número de serie o ubicación.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto de búsqueda (código, modelo, marca, serie o ubicación).",
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "equipment",
    function: {
      name: "get_equipment_history",
      description:
        "Obtiene la ficha de un equipo concreto, sus registros de mantenimiento preventivo y sus incidencias asociadas.",
      parameters: {
        type: "object",
        properties: {
          codeOrModel: {
            type: "string",
            description: "Código interno del equipo (ej. EQ-001), número de serie o modelo.",
          },
        },
        required: ["codeOrModel"],
      },
    },
  },
  {
    type: "function",
    module: "incidents",
    function: {
      name: "search_incidents",
      description:
        "Busca incidencias del taller filtrando por referencia (INC-XXXX), estado o texto descriptivo/modelo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Referencia, modelo, serie o palabras clave.",
          },
          onlyOpen: {
            type: "string",
            description: "Si es 'true', devuelve únicamente incidencias abiertas o en curso.",
            enum: ["true", "false"],
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "parts",
    function: {
      name: "search_spare_parts",
      description:
        "Consulta el inventario de repuestos por código, nombre, categoría o si están bajo stock mínimo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Código, nombre, categoría o ubicación.",
          },
          lowStockOnly: {
            type: "string",
            description: "Si es 'true', filtra solo repuestos con stock <= minStock.",
            enum: ["true", "false"],
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "requests",
    function: {
      name: "search_part_requests",
      description:
        "Consulta peticiones de repuestos (PET-XXXX) por referencia, estado, solicitante o equipo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Referencia, solicitante, pieza o equipo.",
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "purchasing",
    function: {
      name: "search_purchase_orders",
      description:
        "Consulta órdenes de compra (OC-XXXX), solicitudes de compra y recepciones por proveedor, referencia o estado.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Referencia OC-XXXX, proveedor o estado.",
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "manuals",
    function: {
      name: "search_manuals",
      description:
        "Busca manuales técnicos registrados en el taller por título, categoría, modelo o descripción.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Título, categoría o modelo de equipo.",
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "core",
    function: {
      name: "search_workshop_memory",
      description:
        "Búsqueda rápida y compacta en la memoria unificada del taller (incidencias, equipos, repuestos, manuales, hechos aprendidos y tus correos) con expansión de sinónimos. Úsala primero para ahorrar tokens.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Síntoma, código, modelo, número de serie o tema a buscar.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    module: "core",
    function: {
      name: "search_mailbox",
      description:
        "Busca en tus correos personales de Zimbra (asunto, remitente, extracto, etiquetas como requests/incidents/equipment/purchasing y cuerpos cacheados).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto del asunto, remitente o contenido.",
          },
          tag: {
            type: "string",
            description: "Etiqueta opcional: requests, incidents, equipment, purchasing, external_sat, manuals, informative.",
          },
        },
      },
    },
  },
  {
    type: "function",
    module: "core",
    function: {
      name: "search_movements",
      description:
        "Consulta movimientos recientes de stock de repuestos y traslados/bajas de equipos.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Código, nombre de repuesto/equipo, usuario o motivo.",
          },
        },
      },
    },
  },
];

/**
 * Filtra las herramientas disponibles intersectando los módulos habilitados en
 * Ajustes de IA con las capacidades reales CASL del usuario que pregunta.
 */
export function resolveAllowedAiTools(
  enabledModules: readonly AiToolModule[],
  capabilities: UserModuleCapabilities,
): AiToolDefinition[] {
  const enabledSet = new Set<AiToolModule>(enabledModules);
  return AI_WORKSHOP_TOOLS.filter((tool) => {
    if (tool.module === "core") return true;
    return enabledSet.has(tool.module) && capabilities[tool.module];
  });
}
