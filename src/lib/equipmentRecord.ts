/**
 * La ficha de un equipo como documento: lo que se descarga para adjuntar a un
 * correo, para el expediente de la máquina o para imprimir.
 *
 * Se compone aquí, fuera del componente, para poder probarla sin navegador —es
 * texto en Markdown, como la ficha de un manual y el parte de una incidencia— y
 * el maquetador del taller (`reportPdf`) la pone en hojas A4. Lleva lo que la
 * ficha enseña: la identificación del equipo con su garantía y su revisión, la
 * nota del taller, sus manuales —los asignados a la unidad y los que son del
 * modelo—, el historial de intervenciones con la nota de cada una y sus
 * peticiones de repuestos con lo que pidió cada solicitante.
 *
 * Los manuales, las intervenciones y las peticiones se citan, no se adjuntan:
 * van con lo justo para cotejarlos con lo que se abre desde la ficha (el nombre
 * del archivo, su tamaño, la fecha, quién la hizo y qué se pidió). El documento
 * entero sale de lo que se le pasa, así que quien exporta ve en el papel
 * exactamente lo que veía en la ficha.
 */

import { heading, table } from "./markdown";
import {
  MANUAL_KIND_META,
  normalizeManualText,
  type ManualKind,
} from "./manuals";
import { richDocToMarkdown } from "./richDoc";
import {
  MAINTENANCE_META,
  PRIORITY_META,
  STATUS_META,
  equipmentLabel,
  formatDate,
  formatDateTime,
  formatFileSize,
  nextReview,
  type MaintenanceKind,
  type Priority,
  type RequestStatus,
} from "./workshop";

/** Lo que la ficha de un equipo sabe y entra en el documento. */
export interface EquipmentRecordInput {
  /** Código de inventario del equipo; puede faltar en una ficha antigua. */
  code?: string | null;
  name: string;
  model: string;
  brand?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  supplier?: string | null;
  purchaseDate?: number | null;
  warrantyEndDate?: number | null;
  decommissionDate?: number | null;
  maintenanceIntervalDays?: number | null;
  /** La nota del equipo, tal cual sale del editor (documento de `richDoc`). */
  description?: string | null;
}

/** Un manual del equipo, con lo justo para citarlo en el documento. */
export interface EquipmentRecordManual {
  title: string;
  kind: ManualKind;
  type: string;
  brand?: string | null;
  model?: string | null;
  fileName?: string | null;
  size?: number | null;
}

/** Una línea de lo que se pide: el repuesto y cuánto. */
export interface EquipmentRecordLine {
  code: string;
  name: string;
  quantity: number;
}

/**
 * Una petición de repuestos del equipo. Se guarda tal y como sale de la cola
 * —los mismos campos que enseña la ficha— para que el documento pueda citarla
 * sin que nadie los traduzca por el camino.
 */
export interface EquipmentRecordRequest {
  /** Referencia con la que se pide y se sigue: «PED-0042». */
  reference: string;
  status: RequestStatus;
  priority: Priority;
  requesterName: string;
  /** Área o equipo de quien la pide, si lo dejó dicho. */
  requesterTeam?: string | null;
  /** Los repuestos pedidos, línea a línea. */
  lines?: readonly EquipmentRecordLine[];
  /** El texto libre del solicitante (documento de `richDoc`). */
  description?: string | null;
  createdAt: number;
}

/** Una intervención del historial del equipo. */
export interface EquipmentRecordIntervention {
  kind: MaintenanceKind;
  title: string;
  /** La nota de la intervención, tal cual sale del editor. */
  description?: string | null;
  performedAt: number;
  technician?: string | null;
  /** Referencia de la petición vinculada, si la lleva. */
  requestReference?: string | null;
}

export interface EquipmentRecordOptions {
  /** Manuales asignados a la unidad y los de su marca y modelo. */
  manuals?: {
    assigned: readonly EquipmentRecordManual[];
    byModel: readonly EquipmentRecordManual[];
  };
  /** Intervenciones del equipo; el documento las ordena de la última atrás. */
  interventions?: readonly EquipmentRecordIntervention[];
  /** Peticiones del equipo; también van de la última a la primera. */
  requests?: readonly EquipmentRecordRequest[];
  /** Cuándo se genera la ficha (por defecto, ahora). */
  now?: number;
}

/** Título → trozo de nombre de archivo: minúsculas, sin acentos ni signos. */
function slug(title: string): string {
  return (
    normalizeManualText(title)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // Un nombre largo no puede dejar un archivo interminable; si el corte deja
      // un guion suelto al final, se quita.
      .slice(0, 60)
      .replace(/-+$/, "") || "equipo"
  );
}

/**
 * El nombre del documento, con la fecha dentro para que dos descargas del mismo
 * equipo no se pisen ni se confundan en una carpeta:
 * `ficha-equipo-camara-de-estudio-hdc-3500-2026-10-10.pdf`.
 */
export function equipmentRecordPdfFilename(
  name: string,
  now: number = Date.now(),
): string {
  const day = new Date(now).toISOString().slice(0, 10);
  return `ficha-equipo-${slug(name)}-${day}.pdf`;
}

/** Viñeta de la ficha, solo si el valor está. */
function bullet(
  label: string,
  value: string | undefined | null,
): string | null {
  return value === undefined || value === null || value === ""
    ? null
    : `- **${label}:** ${value}`;
}

/**
 * El estado de la garantía: se cuenta desde la fecha de generación del
 * documento, que es la que lee quien lo abre (`now`, no el reloj de dentro).
 */
function warrantyLine(
  equipment: EquipmentRecordInput,
  now: number,
): string | null {
  const end = equipment.warrantyEndDate ?? null;
  if (end === null) return null;
  return end >= now
    ? `En garantía hasta el ${formatDate(end)}`
    : `Garantía caducada el ${formatDate(end)}`;
}

/**
 * El plan preventivo, como se lee en la ficha: cada cuánto toca, cuándo es la
 * próxima y si está vencida. La fecha de vencimiento sale de `nextReview` —la
 * misma que enseña la ficha— y el estado se decide contra el `now` del
 * documento, no contra el reloj de quien lo mira.
 */
function maintenanceLine(
  equipment: EquipmentRecordInput,
  interventions: readonly EquipmentRecordIntervention[],
  now: number,
): string {
  const interval = equipment.maintenanceIntervalDays ?? null;
  if (!interval || interval <= 0) {
    return `- **Plan de mantenimiento:** sin plan preventivo.`;
  }
  const review = nextReview(
    [...interventions],
    interval,
    equipment.purchaseDate,
  );
  if (review.dueAt === null) {
    return `- **Plan de mantenimiento:** cada ${interval} días · sin primera revisión registrada`;
  }
  const state = review.dueAt < now ? "vencida" : "al día";
  return `- **Plan de mantenimiento:** cada ${interval} días · próxima revisión ${formatDate(
    review.dueAt,
  )} (${state})`;
}

/** La identificación del equipo, en el orden en que se lee en la ficha. */
function identityBlock(
  equipment: EquipmentRecordInput,
  interventions: readonly EquipmentRecordIntervention[],
  now: number,
): string {
  const brandModel = [equipment.brand, equipment.model]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  const lines = [
    bullet("Marca y modelo", brandModel),
    bullet("Nº de serie", equipment.serialNumber),
    bullet("Ubicación", equipment.location),
    equipment.decommissionDate
      ? `- **Estado:** De baja desde el ${formatDate(equipment.decommissionDate)}`
      : "- **Estado:** En servicio",
    bullet("Garantía", warrantyLine(equipment, now)),
    bullet("Proveedor", equipment.supplier),
    bullet(
      "Fecha de alta",
      equipment.purchaseDate ? formatDate(equipment.purchaseDate) : null,
    ),
    maintenanceLine(equipment, interventions, now),
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

/** La nota del taller del equipo, con su formato; o el aviso de que no la lleva. */
function descriptionBlock(equipment: EquipmentRecordInput): string {
  const markdown = richDocToMarkdown(equipment.description)?.trim();
  return markdown || "Este equipo no lleva descripción.";
}

/** Un manual citado: su forma, su tipo, su archivo y de qué modelo es. */
function manualLine(manual: EquipmentRecordManual): string {
  const meta = MANUAL_KIND_META[manual.kind];
  const brandModel = [manual.brand, manual.model]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  const fileName = manual.fileName?.trim();
  // De un manual se cita el archivo, no su nota: la nota es larga y aquí solo
  // hace falta poder cotejar qué documento es y desde dónde se abre.
  const file =
    manual.kind !== "file"
      ? ""
      : fileName
        ? ` · ${fileName}${manual.size ? ` (${formatFileSize(manual.size)})` : ""}`
        : " · archivo ya no disponible en el almacén";
  return `- **${manual.title}** · ${manual.type} · ${meta.label}${file}${
    brandModel ? ` · ${brandModel}` : ""
  }`;
}

/** Los manuales del equipo: primero los suyos y después los del modelo. */
function manualsBlock(
  manuals: EquipmentRecordOptions["manuals"],
  level: number,
): string {
  const assigned = manuals?.assigned ?? [];
  const byModel = manuals?.byModel ?? [];
  if (assigned.length === 0 && byModel.length === 0) {
    return [heading(level, "Manuales"), "Este equipo no tiene manuales."].join(
      "\n\n",
    );
  }
  const blocks: string[] = [heading(level, "Manuales")];
  if (assigned.length > 0) {
    blocks.push(
      heading(level + 1, "Asignados a esta unidad"),
      "",
      assigned.map(manualLine).join("\n"),
    );
  }
  if (byModel.length > 0) {
    blocks.push(
      heading(level + 1, "Del modelo"),
      "",
      byModel.map(manualLine).join("\n"),
      "",
      "Los manuales del modelo valen para cualquier equipo de ese modelo, no solo para este.",
    );
  }
  return blocks.join("\n\n");
}

/** El texto de una nota con formato para una celda: sin bloques dentro. */
function notesOf(entry: EquipmentRecordIntervention): string | undefined {
  const markdown = richDocToMarkdown(entry.description)?.trim();
  return markdown === "" ? undefined : markdown;
}

/**
 * El historial de intervenciones: la tabla con lo que pasó y, debajo, la nota
 * de cada una —las notas son lo que se lee cuando el equipo vuelve al taller, y
 * en una tabla no caben—. Va de la última intervención atrás, como la ficha.
 */
function interventionsBlock(
  interventions: readonly EquipmentRecordIntervention[],
  level: number,
): string {
  const blocks: string[] = [heading(level, "Historial de intervenciones")];
  if (interventions.length === 0) {
    blocks.push("Sin intervenciones registradas.");
    return blocks.join("\n\n");
  }

  const ordered = [...interventions].sort(
    (a, b) => b.performedAt - a.performedAt,
  );
  blocks.push(
    "",
    table(
      ["Fecha", "Tipo", "Intervención", "Técnico", "Petición"],
      ordered.map((entry) => [
        formatDate(entry.performedAt),
        MAINTENANCE_META[entry.kind].label,
        entry.title,
        entry.technician || "—",
        entry.requestReference ? `Petición ${entry.requestReference}` : "—",
      ]),
    ),
  );

  const withNotes = ordered.filter((entry) => notesOf(entry) !== undefined);
  if (withNotes.length > 0) {
    blocks.push("", heading(level + 1, "Notas de las intervenciones"));
    for (const entry of withNotes) {
      // Cada nota es un bloque: el título en negrita, una línea en blanco y el
      // texto con su formato, tal y como se escribió.
      blocks.push(
        "",
        `**${formatDate(entry.performedAt)} · ${
          MAINTENANCE_META[entry.kind].label
        } · ${entry.title}**`,
        "",
        notesOf(entry) ?? "",
      );
    }
  }
  return blocks.join("\n");
}

/** Un repuesto pedido, como se lee en la cola: código, nombre y cuánto. */
function lineLabel(line: EquipmentRecordLine): string {
  return `${line.code} ${line.name} x${line.quantity}`;
}

/**
 * Lo que escribió quien pidió, con su formato: es donde está el porqué de la
 * petición, que en una tabla no cabe.
 */
function requestText(request: EquipmentRecordRequest): string | undefined {
  const markdown = richDocToMarkdown(request.description)?.trim();
  return markdown === "" ? undefined : markdown;
}

/**
 * Las peticiones del equipo: la tabla con lo que se pidió —referencia, cuándo,
 * en qué punto está, con qué prisa y quién la pidió— y, debajo, el repuesto de
 * cada una y lo que escribió su solicitante.
 *
 * El repuesto y el texto van fuera de la tabla a propósito: son los dos datos
 * largos, y dentro de una tabla de cinco columnas se reparten en renglones de
 * dos letras. El orden es el de la cola —de la última a la primera—, para que lo
 * que sigue en marcha se lea arriba.
 */
function requestsBlock(
  requests: readonly EquipmentRecordRequest[],
  level: number,
): string {
  const blocks: string[] = [heading(level, "Peticiones")];
  if (requests.length === 0) {
    blocks.push("Este equipo no tiene peticiones registradas.");
    return blocks.join("\n\n");
  }

  const ordered = [...requests].sort((a, b) => b.createdAt - a.createdAt);
  blocks.push(
    "",
    table(
      ["Fecha", "Petición", "Estado", "Prioridad", "Solicitante"],
      ordered.map((request) => [
        formatDate(request.createdAt),
        request.reference,
        STATUS_META[request.status].label,
        PRIORITY_META[request.priority].label,
        request.requesterTeam
          ? `${request.requesterName} · ${request.requesterTeam}`
          : request.requesterName,
      ]),
    ),
  );

  const detailed = ordered.filter(
    (request) =>
      (request.lines ?? []).length > 0 || requestText(request) !== undefined,
  );
  if (detailed.length > 0) {
    blocks.push("", heading(level + 1, "Qué se pide"));
    for (const request of detailed) {
      blocks.push(
        "",
        `**${request.reference} · ${STATUS_META[request.status].label}**`,
      );
      const lines = request.lines ?? [];
      if (lines.length > 0) {
        blocks.push("", lines.map((line) => `- ${lineLabel(line)}`).join("\n"));
      }
      const text = requestText(request);
      if (text !== undefined) blocks.push("", text);
    }
  }
  return blocks.join("\n");
}

/**
 * La ficha del equipo, lista para convertir a PDF o guardar como Markdown. Se
 * compone con lo que se le pasa: quien exporta ve en el documento exactamente lo
 * que ve en la ficha.
 */
export function equipmentRecord(
  equipment: EquipmentRecordInput,
  options: EquipmentRecordOptions = {},
): string {
  const now = options.now ?? Date.now();
  const interventions = options.interventions ?? [];
  // El código distingue dos unidades del mismo modelo; si la ficha no lo tiene,
  // el título se queda con lo que se lee (nombre y modelo).
  const code = equipment.code?.trim();
  const blocks: string[] = [
    [
      heading(
        1,
        code
          ? `${equipmentLabel(equipment)} (${code})`
          : equipmentLabel(equipment),
      ),
      "",
      `Ficha del equipo generada el ${formatDateTime(now)} desde el taller.`,
      "",
      identityBlock(equipment, interventions, now),
    ].join("\n"),
    heading(2, "Descripción"),
    descriptionBlock(equipment),
    manualsBlock(options.manuals, 2),
    interventionsBlock(interventions, 2),
    requestsBlock(options.requests ?? [], 2),
  ];
  // Sin cierre a propósito: el pie de cada hoja ya dice de qué equipo es y de
  // qué taller sale, y un colofón suelto se lleva el historial a una segunda
  // hoja casi en blanco cuando el listado llena la primera.
  return `${blocks.join("\n\n")}\n`;
}
