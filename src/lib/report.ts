/**
 * El parte de una incidencia: el documento completo que se puede sacar de la
 * aplicación (una intervención que se manda por correo, un expediente que se
 * archiva o un lote que pide el cliente).
 *
 * Se compone aquí, fuera del componente, para poder probarlo sin navegador. Es
 * texto en Markdown —se lee en cualquier editor y se imprime o se convierte a
 * PDF sin más— con el mismo vocabulario que la ficha («Adjuntó «Acta.pdf»») y
 * termina con el rastro de auditoría de documentos, que es la parte que no
 * existe en ningún otro sitio: lo que se retiró ya no está en el expediente,
 * pero quién lo quitó y cuándo sigue contado.
 *
 * Las notas del cuaderno llevan su propia sección de correcciones —con lo
 * añadido y lo quitado marcados— porque el informe se entrega fuera: quien lo
 * lee no tiene la ficha delante para desplegar el historial.
 *
 * El formato de una nota se conserva: las del cuaderno y las de los documentos
 * del expediente van en su propio bloque, traducidas a Markdown con sus
 * negritas, sus listas y sus fotos (`richDocToMarkdown`). Solo se aplana lo que
 * tiene que ir dentro de una celda —el historial de estados y el rastro de
 * auditoría, que son texto de una línea—, porque una tabla de Markdown no
 * admite bloques dentro.
 */

import {
  auditActionCount,
  dayRange,
  describeAuditRange,
  endOfDay,
  summarizeAudit,
  type AuditRange,
} from "./audit";
import { startOfDay } from "./browse";
import { heading, table } from "./markdown";
import {
  escapeMarkdown,
  richDocToMarkdown,
  richDocToPlainText,
} from "./richDoc";
import { describeBlockCounts } from "./richDocDiff";
import { describeDiff, type DiffPart } from "./textDiff";
import {
  INCIDENT_STATUS_META,
  SEVERITY_META,
  documentTrailLabel,
  formatDate,
  formatDateTime,
  liveNotes,
  noteRestoration,
  noteVersionChanges,
  type DocumentTrailAction,
  type IncidentSeverity,
  type IncidentStatus,
} from "./workshop";

/** Lo que el informe necesita de una incidencia (no todo el documento). */
export interface ReportIncident {
  reference: string;
  reporterName: string;
  reporterRole?: string;
  location?: string;
  equipmentKind?: string;
  model?: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
  severity?: IncidentSeverity;
  status: IncidentStatus;
  assigneeName?: string;
  workshopAssigneeName?: string;
  closedAt?: number;
  notes?: string;
  archivedAt?: number;
  documents?: {
    name: string;
    note?: string;
    author?: string;
    createdAt: number;
  }[];
  lifecycleNotes?: {
    note: string;
    author: string;
    at: number;
    editedAt?: number;
    /**
     * Lo que la nota decía antes de cada corrección, de la primera a la
     * última: con esto se reconstruye el historial de cambios de la sección
     * «Correcciones de las notas».
     */
    versions?: readonly { note: string; at: number }[];
    /** Última vez que la nota se devolvió a una versión anterior. */
    restoredAt?: number;
    restoredBy?: string;
    restoredVersion?: number;
    /** Retirada del cuaderno: no entra en el informe (sí en la ficha). */
    deletedAt?: number;
  }[];
  history: {
    status: IncidentStatus;
    at: number;
    by?: string;
    note?: string;
  }[];
}

/** Un movimiento del rastro de auditoría (lo que devuelve `documentTrail`). */
export interface ReportTrailEntry {
  action: DocumentTrailAction;
  name: string;
  previousName?: string;
  by: string;
  byId: string;
  incidentId: string;
  at: number;
}

export interface IncidentReportInput {
  incident: ReportIncident;
  /** Equipo del inventario al que está vinculada, con su nombre visible. */
  equipmentName?: string;
  /**
   * Rastro de auditoría de documentos. Se omite si quien exporta no puede
   * verlo (el expediente lo lee quien coordina la incidencia): el informe
   * enseña exactamente lo que esa persona ve en la ficha.
   */
  trail?: readonly ReportTrailEntry[];
  /** Quién descarga el informe. */
  exportedBy: string;
  now?: number;
  /**
   * Nivel del título dentro del archivo. El informe suelto va al 1 (un archivo,
   * un informe); dentro del lote de un periodo va al 2, porque el archivo lleva
   * un solo título y cada incidencia es un apartado suyo.
   */
  level?: number;
}

/** Viñeta de una lista de datos, solo si el valor está. */
function bullet(label: string, value: string | undefined): string | null {
  return value === undefined || value === ""
    ? null
    : `- **${label}:** ${value}`;
}

/**
 * El texto de un campo con formato para una celda del informe: las tablas de
 * Markdown no admiten bloques dentro, así que aquí queda lo que se lee, con los
 * párrafos y las listas línea a línea. Una nota de siempre (texto plano) sale
 * exactamente como estaba: la conversión solo toca lo que trae formato.
 */
function plainText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : richDocToPlainText(value);
}

/**
 * El texto de un apartado suelto —la avería descrita, el cierre del técnico—,
 * donde sí caben los bloques: el documento se pasa a Markdown tal cual, con sus
 * listas, sus citas y sus imágenes. Es lo que hace que el parte que se imprime
 * o se convierte a PDF conserve la forma en que se escribió.
 */
function markdown(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = richDocToMarkdown(value);
  return text === "" ? undefined : text;
}

/** Título del informe: referencia y equipo, como en la ficha. */
function reportTitle(incident: ReportIncident): string {
  const equipment = [incident.equipmentKind, incident.model]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  return `Incidencia ${incident.reference}${equipment ? ` · ${equipment}` : ""}`;
}

function identityBlock(
  incident: ReportIncident,
  equipmentName: string | undefined,
): string {
  const status = INCIDENT_STATUS_META[incident.status];
  const equipment = [incident.equipmentKind, incident.model]
    .filter(Boolean)
    .join(" ");
  // Si el equipo del inventario se llama igual que lo descrito, una sola línea
  // lo dice todo: repetirla dos veces solo hace ruido en el parte.
  const sameEquipment =
    equipmentName !== undefined && equipmentName === equipment;
  const lines = [
    bullet("Estado", `${status.label} — ${status.description}`),
    bullet(
      "Gravedad",
      incident.severity ? SEVERITY_META[incident.severity].label : undefined,
    ),
    bullet(
      "Notificada",
      `${formatDateTime(incident.reportedAt)} por ${incident.reporterName}${
        incident.reporterRole ? ` (${incident.reporterRole})` : ""
      }`,
    ),
    bullet("Ubicación", incident.location),
    bullet("Equipo", equipment || undefined),
    bullet("Nº de serie", incident.serialNumber),
    sameEquipment
      ? bullet("Equipo del inventario", "el mismo del expediente")
      : bullet("Equipo del inventario", equipmentName),
    bullet(
      "Técnico",
      incident.assigneeName ??
        (incident.status === "reported" ? "Sin asignar todavía" : "—"),
    ),
    bullet("Entrada a taller", incident.workshopAssigneeName),
    bullet(
      "Cerrada",
      incident.closedAt
        ? `${formatDateTime(incident.closedAt)} · ${
            incident.status === "resolved" ? "con resolución" : "sin resolución"
          }`
        : undefined,
    ),
    bullet(
      "Archivada",
      incident.archivedAt ? formatDate(incident.archivedAt) : undefined,
    ),
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

function historyBlock(incident: ReportIncident, level: number): string {
  return [
    heading(level, "Historial de estados"),
    "",
    table(
      ["Fecha y hora", "Estado", "Quién", "Nota"],
      incident.history.map((entry) => [
        formatDateTime(entry.at),
        INCIDENT_STATUS_META[entry.status].label,
        entry.by,
        plainText(entry.note),
      ]),
    ),
  ].join("\n");
}

/** Una nota del cuaderno tal y como la ve el informe. */
type ReportNote = NonNullable<ReportIncident["lifecycleNotes"]>[number];

/**
 * Una nota del cuaderno: su firma —cuándo y quién— en su propia línea y debajo
 * el texto tal y como se escribió, con sus negritas, sus listas y sus fotos.
 *
 * Antes iba en una celda de tabla —cómoda para una columna de texto, pero ahí
 * no cabe nada más—, así que el parte aplastaba la nota justo al entregarse
 * fuera, que es cuando más se lee. Una tabla no admite bloques dentro, así que
 * la nota va fuera de ella: primero quién la firma, después lo que dice.
 */
function noteEntryBlock(entry: ReportNote): string {
  return [
    `**${formatDateTime(entry.at)} · ${escapeMarkdown(entry.author)}**${
      entry.editedAt ? ` (corregida el ${formatDateTime(entry.editedAt)})` : ""
    }`,
    "",
    markdown(entry.note) ?? "",
  ].join("\n");
}

function notesBlock(incident: ReportIncident, level: number): string {
  // El informe es lo que se entrega fuera: lleva el cuaderno tal y como está,
  // sin las notas que alguien retiró (esas siguen recuperables en la ficha).
  // Cada nota es un bloque, así que entre una y otra va una línea en blanco: si
  // no, la firma de la siguiente se leería pegada al final de la anterior.
  const notes = liveNotes(incident.lifecycleNotes);
  return [
    heading(level, "Notas del cuaderno de vida"),
    "",
    notes.length === 0
      ? "_Todavía no hay notas en el ciclo de vida._"
      : notes.map(noteEntryBlock).join("\n\n"),
  ].join("\n");
}

/**
 * Marca un trozo del diff: tachado lo que se quitó, en negrita lo que se
 * añadió. El hueco que rodea al trozo se queda fuera de las marcas —`**texto**`
 * con un espacio pegado por dentro no prende en Markdown— y un trozo que solo
 * fuera huecos se deja tal cual: marcar un espacio no enseña nada.
 */
function markPart(kind: DiffPart["kind"], text: string): string {
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const trail = text.match(/\s*$/)?.[0] ?? "";
  const core = text.slice(lead.length, text.length - trail.length);
  if (core === "") return text;
  return kind === "removed"
    ? `${lead}~~${core}~~${trail}`
    : `${lead}**${core}**${trail}`;
}

/**
 * El texto de una corrección con sus marcas, como se lee en la ficha: lo que
 * se quitó tachado y lo que se añadió en negrita. Los saltos de línea de la
 * nota se conservan sangrados, para no romper la viñeta que los contiene.
 */
function markedDiff(parts: readonly DiffPart[]): string {
  return parts
    .map((part) =>
      part.kind === "same" ? part.text : markPart(part.kind, part.text),
    )
    .join("")
    .replace(/\n/g, "\n  ");
}

/**
 * Correcciones de las notas: sección propia para las notas que cambiaron. Cada
 * una se anuncia con su autor y su fecha —las notas del cuaderno ya están
 * listadas más arriba— y debajo van sus correcciones, de la más reciente a la
 * más antigua, con lo que añadió y lo que quitó cada una. Es el historial que
 * enseña la ficha, pero por escrito: el informe se entrega fuera y quien lo lee
 * no puede desplegarlo. Las notas retiradas no entran, igual que en el cuaderno
 * y en su tabla.
 *
 * Una nota que se devolvió a una versión anterior lo dice aquí, con quién lo
 * hizo y cuándo: en el papel no se puede ver el botón, y «esto se escribió así»
 * es distinto de «esto se volvió a poner tal y como estaba».
 */
function notesChangesBlock(incident: ReportIncident, level: number): string {
  const corrected = liveNotes(incident.lifecycleNotes).filter(
    (entry) => (entry.versions ?? []).length > 0,
  );

  // Cada nota es un bloque: entre una y otra va una línea en blanco, porque en
  // Markdown una línea pegada detrás de una viñeta se lee como continuación de
  // esa viñeta y el título de la nota siguiente se perdería dentro.
  const body = corrected.map((entry) => {
    const changes = noteVersionChanges(entry);
    const restoration = noteRestoration(entry);
    const title = `**Nota de ${entry.author} · ${formatDateTime(entry.at)}** — ${
      changes.length === 1 ? "1 corrección" : `${changes.length} correcciones`
    }${
      restoration
        ? ` · restaurada por ${restoration.by} el ${formatDateTime(restoration.at)}`
        : ""
    }`;
    const lines = changes.map((change) => {
      // Un párrafo o una lista que apareció entero no es lo mismo que una frase
      // retocada: si el cambio fue por bloques, el informe lo dice.
      const blocks = describeBlockCounts(change);
      return `- **${formatDateTime(change.at)}** · ${describeDiff(change)}${
        blocks ? ` · ${blocks}` : ""
      }${
        restoration && restoration.version === change.index
          ? " · versión restaurada"
          : ""
      }\n  ${markedDiff(change.parts)}`;
    });
    return [title, "", ...lines].join("\n");
  });

  return [
    heading(level, "Correcciones de las notas"),
    "",
    corrected.length === 0
      ? "_No se ha corregido ninguna nota del cuaderno._"
      : body.join("\n\n"),
  ].join("\n");
}

/**
 * Los documentos del expediente, cada uno con su nota. La nota la escribió quien
 * adjuntó el documento con el mismo editor que las del cuaderno, así que va
 * igual: fuera de la tabla, con su formato. De cada documento se dice cuándo
 * entró, cómo se llama, quién lo adjuntó y qué contaba su nota.
 */
function documentsBlock(incident: ReportIncident, level: number): string {
  const documents = incident.documents ?? [];
  const entries = documents.map((document) => {
    const note = markdown(document.note);
    return [
      `**${formatDate(document.createdAt)} · ${escapeMarkdown(document.name)}**${
        document.author ? ` — ${escapeMarkdown(document.author)}` : ""
      }`,
      ...(note ? ["", note] : []),
    ].join("\n");
  });
  return [
    heading(level, "Documentos adjuntos"),
    "",
    entries.length === 0
      ? "_No hay documentos en el expediente._"
      : entries.join("\n\n"),
  ].join("\n");
}

/**
 * Rastro de auditoría: el resumen del tramo y el detalle de cada movimiento.
 * Es la sección que se omite cuando quien exporta no puede ver el expediente.
 */
function trailBlock(trail: readonly ReportTrailEntry[], level: number): string {
  const summary = summarizeAudit(trail);
  const breakdown = (["attached", "edited", "removed"] as const)
    .filter((action) => summary.byAction[action] > 0)
    .map((action) => auditActionCount(action, summary.byAction[action]));

  return [
    heading(level, "Rastro de auditoría de documentos"),
    "",
    trail.length === 0
      ? "_Todavía no se ha movido ningún documento del expediente._"
      : [
          `${summary.total} ${
            summary.total === 1 ? "movimiento" : "movimientos"
          } · ${breakdown.join(" · ")}`,
          "",
          table(
            ["Fecha y hora", "Movimiento", "Quién"],
            trail.map((entry) => [
              formatDateTime(entry.at),
              documentTrailLabel(entry),
              entry.by,
            ]),
          ),
          "",
          "Un documento retirado ya no está en el expediente; su movimiento es la única constancia de quién lo quitó y cuándo.",
        ].join("\n"),
  ].join("\n");
}

/**
 * Informe completo de una incidencia, listo para descargar. Se compone con las
 * piezas que ve quien lo exporta: con el rastro de auditoría si puede leer el
 * expediente, sin él si no.
 */
export function incidentReport(input: IncidentReportInput): string {
  const { incident, trail, exportedBy } = input;
  const now = input.now ?? Date.now();
  // `level` es el del título; los apartados van uno por debajo, para que el
  // informe suelto empiece en «#» con sus secciones en «##» y el lote de un
  // periodo ponga cada incidencia en «##» con las suyas en «###».
  const level = input.level ?? 1;
  const section = level + 1;

  const blocks: string[] = [
    [
      heading(level, reportTitle(incident)),
      "",
      `Parte generado el ${formatDateTime(now)} por ${exportedBy}.`,
      "",
      identityBlock(incident, input.equipmentName),
    ].join("\n"),
    heading(section, "Avería descrita"),
    // Lo que se describió se escribió con el editor: el parte lo pasa a
    // Markdown, así que conserva sus párrafos, sus listas y sus imágenes.
    markdown(incident.description)?.trim() ?? "",
  ];

  if (incident.closedAt !== undefined || incident.notes) {
    blocks.push(
      heading(section, "Cierre y notas del técnico"),
      "",
      [
        markdown(incident.notes)?.trim(),
        incident.closedAt !== undefined && !incident.notes
          ? `Cerrada el ${formatDateTime(incident.closedAt)}.`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  blocks.push(
    historyBlock(incident, section),
    notesBlock(incident, section),
    notesChangesBlock(incident, section),
    documentsBlock(incident, section),
  );
  if (trail !== undefined) blocks.push(trailBlock(trail, section));

  blocks.push(
    "---",
    `Fuente: Pulso Taller · Repuestos de equipo audiovisual · ${incident.reference}`,
  );

  return `${blocks.join("\n\n")}\n`;
}

/**
 * El nombre del parte, con la extensión que le toque. La fecha de hoy va dentro
 * para que dos descargas del mismo día no se pisen.
 */
function reportFilename(
  reference: string,
  now: number,
  extension: string,
): string {
  const safe = reference
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  return `parte-${safe}-${new Date(now).toISOString().slice(0, 10)}.${extension}`;
}

/** Nombre del parte en Markdown: `parte-INC-0038-2026-10-08.md`. */
export function incidentReportFilename(
  reference: string,
  now: number = Date.now(),
): string {
  return reportFilename(reference, now, "md");
}

/** El mismo parte en PDF: `parte-INC-0038-2026-10-08.pdf`. */
export function incidentReportPdfFilename(
  reference: string,
  now: number = Date.now(),
): string {
  return reportFilename(reference, now, "pdf");
}

/**
 * El parte entregable, con sus fotos dentro: `parte-INC-0038-2026-10-08.zip`.
 */
export function incidentReportPackageFilename(
  reference: string,
  now: number = Date.now(),
): string {
  return reportFilename(reference, now, "zip");
}

/** Tipo MIME del informe: texto Markdown, legible tal cual. */
export const REPORT_MIME = "text/markdown;charset=utf-8";

/* ------------------------------------------------------------------ */
/* Lote de informes de un periodo                                      */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Un tramo de fechas ya resuelto: `null` en un extremo = sin tope. */
export type ReportRange = AuditRange;

/** Por qué fecha entra una incidencia en el lote. */
export type ReportPeriodBasis = "reported" | "closed";

export const REPORT_PERIOD_BASES: {
  id: ReportPeriodBasis;
  label: string;
  /** Cómo se cuenta en el propio archivo: «su fecha de notificación». */
  phrase: string;
}[] = [
  { id: "reported", label: "Notificación", phrase: "su fecha de notificación" },
  { id: "closed", label: "Cierre", phrase: "su fecha de cierre" },
];

/**
 * ¿Entra esta incidencia en el lote? Por la fecha de notificación —lo que se
 * recibió en el periodo— o por la de cierre —lo que se terminó en él—. Una
 * incidencia sin cerrar no entra por la segunda puerta: no habría nada que
 * contar de su cierre.
 */
export function inReportPeriod(
  incident: ReportIncident,
  range: ReportRange,
  basis: ReportPeriodBasis,
): boolean {
  const at = basis === "closed" ? incident.closedAt : incident.reportedAt;
  if (at === undefined) return false;
  if (range.from !== null && at < range.from) return false;
  if (range.to !== null && at > range.to) return false;
  return true;
}

/** Atajos de periodo pensados para entregar el trabajo de un mes. */
export type ReportPeriodId =
  | "thisMonth"
  | "lastMonth"
  | "last30"
  | "all"
  | "custom";

export const REPORT_PERIODS: {
  id: Exclude<ReportPeriodId, "custom">;
  label: string;
}[] = [
  { id: "thisMonth", label: "Este mes" },
  { id: "lastMonth", label: "Mes pasado" },
  { id: "last30", label: "Últimos 30 días" },
  { id: "all", label: "Todo" },
];

/** El día 1 de este mes a las 00:00. */
function startOfMonth(now: number): number {
  const first = new Date(now);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  return first.getTime();
}

/** Rango de un atajo: «Este mes» llega hasta hoy, no hasta el día 30 por venir. */
export function reportPeriodRange(
  preset: Exclude<ReportPeriodId, "custom">,
  now: number = Date.now(),
): ReportRange {
  if (preset === "thisMonth") {
    return { from: startOfMonth(now), to: endOfDay(now) };
  }
  if (preset === "lastMonth") {
    const previousEnd = startOfMonth(now) - 1;
    const previousStart = new Date(previousEnd);
    previousStart.setDate(1);
    previousStart.setHours(0, 0, 0, 0);
    return { from: previousStart.getTime(), to: previousEnd };
  }
  if (preset === "last30") {
    return { from: startOfDay(now) - 29 * DAY_MS, to: endOfDay(now) };
  }
  return { from: null, to: null };
}

/** Qué atajo corresponde a un rango (o «custom» si no es ninguno). */
export function reportPeriodOf(
  range: ReportRange,
  now: number = Date.now(),
): ReportPeriodId {
  for (const preset of REPORT_PERIODS) {
    const expected = reportPeriodRange(preset.id, now);
    if (expected.from === range.from && expected.to === range.to) {
      return preset.id;
    }
  }
  return "custom";
}

/** Rango efectivo de las dos fechas escritas a mano en el diálogo. */
export function reportRange(from: string, to: string): ReportRange {
  return dayRange(from, to);
}

/**
 * Mes natural completo (día 1 al último) → «2026-09»; `null` si el tramo no es
 * un mes entero (o no tiene los dos extremos). Sirve para nombrar el archivo y
 * para titularlo con el mes en vez de con un tramo de dos fechas.
 */
function fullMonth(range: ReportRange): string | null {
  if (range.from === null || range.to === null) return null;
  const start = new Date(range.from);
  const end = new Date(range.to);
  if (start.getDate() !== 1) return null;
  if (
    start.getMonth() !== end.getMonth() ||
    start.getFullYear() !== end.getFullYear()
  ) {
    return null;
  }
  const lastDay = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  if (end.getDate() !== lastDay) return null;
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
}

/** Día en formato `AAAA-MM-DD` (el del nombre del archivo), en hora local. */
function dayStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Nombre del archivo del lote: `informes-2026-09.md` para un mes natural,
 * `informes-2026-09-01-a-2026-09-30.md` para cualquier otro tramo.
 */
export function incidentsReportFilename(
  range: ReportRange,
  now: number = Date.now(),
): string {
  const month = fullMonth(range);
  if (month !== null) return `informes-${month}.md`;
  if (range.from !== null && range.to !== null) {
    return `informes-${dayStamp(range.from)}-a-${dayStamp(range.to)}.md`;
  }
  if (range.from !== null) return `informes-desde-${dayStamp(range.from)}.md`;
  if (range.to !== null) return `informes-hasta-${dayStamp(range.to)}.md`;
  return `informes-todo-${dayStamp(now)}.md`;
}

/** Cómo se llama el periodo en el título: «septiembre de 2026» o el tramo. */
export function reportPeriodTitle(
  range: ReportRange,
  now: number = Date.now(),
): string {
  if (range.from === null && range.to === null) return "todo el historial";
  const month = fullMonth(range);
  if (month !== null) {
    const [year, monthNumber] = month.split("-");
    return new Date(
      Number(year),
      Number(monthNumber) - 1,
      1,
    ).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }
  return describeAuditRange(range, now);
}

/** Un informe dentro del lote: la incidencia y lo que se sabe de su expediente. */
export interface BatchReportEntry {
  incident: ReportIncident;
  equipmentName?: string;
  /** Rastro de auditoría, si quien exporta puede leer el expediente. */
  trail?: readonly ReportTrailEntry[];
}

export interface IncidentsReportInput {
  /** Las incidencias del periodo, ya filtradas por quien llama. */
  entries: readonly BatchReportEntry[];
  range: ReportRange;
  basis: ReportPeriodBasis;
  exportedBy: string;
  now?: number;
}

/** «3 resueltas», contando como se dice cada estado en la aplicación. */
function statusCounts(entries: readonly BatchReportEntry[]): string[] {
  const counts = new Map<IncidentStatus, number>();
  for (const entry of entries) {
    counts.set(
      entry.incident.status,
      (counts.get(entry.incident.status) ?? 0) + 1,
    );
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        INCIDENT_STATUS_ORDER.indexOf(a[0]) -
        INCIDENT_STATUS_ORDER.indexOf(b[0]),
    )
    .map(
      ([status, count]) =>
        `${count} ${INCIDENT_STATUS_META[status].label.toLowerCase()}`,
    );
}

/** Orden de avance del flujo, para desgloses estables. */
const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  "reported",
  "assigned",
  "workshop",
  "resolved",
  "unresolved",
];

/**
 * Lote de informes de un periodo en un solo archivo, para entregar: un título
 * con el periodo, el resumen de lo que entra, un índice y, detrás, el informe
 * completo de cada incidencia —el mismo que se descarga de su ficha— como
 * apartado del archivo. Las incidencias van en orden cronológico de
 * notificación, que es como se lee un parte de un mes.
 */
export function incidentsReport(input: IncidentsReportInput): string {
  const now = input.now ?? Date.now();
  const ordered = [...input.entries].sort(
    (a, b) => a.incident.reportedAt - b.incident.reportedAt,
  );
  const basis =
    REPORT_PERIOD_BASES.find((option) => option.id === input.basis) ??
    REPORT_PERIOD_BASES[0];

  const index = table(
    ["Referencia", "Estado", "Notificada", "Cerrada", "Técnico", "Equipo"],
    ordered.map((entry) => [
      entry.incident.reference,
      INCIDENT_STATUS_META[entry.incident.status].label,
      formatDate(entry.incident.reportedAt),
      entry.incident.closedAt ? formatDate(entry.incident.closedAt) : undefined,
      entry.incident.assigneeName,
      entry.equipmentName ??
        [entry.incident.equipmentKind, entry.incident.model]
          .filter(Boolean)
          .join(" "),
    ]),
  );

  const head = [
    `# Informes de incidencias · ${reportPeriodTitle(input.range, now)}`,
    "",
    `Lote generado el ${formatDateTime(now)} por ${input.exportedBy}.`,
    "",
    [
      bullet("Periodo", describeAuditRange(input.range, now)),
      bullet("Entran por", basis.phrase),
      bullet(
        ordered.length === 1 ? "Incidencia" : "Incidencias",
        ordered.length === 0
          ? "ninguna en este periodo"
          : `${ordered.length} · ${statusCounts(ordered).join(" · ")}`,
      ),
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  ].join("\n");

  if (ordered.length === 0) {
    // Un lote sin incidencias sigue siendo un archivo entregable: dice lo que
    // le falta en vez de salir vacío o con media página de título.
    return `${[
      head,
      "## Índice",
      "_No entró ninguna incidencia en este periodo._",
      "---",
      "Fuente: Pulso Taller · Repuestos de equipo audiovisual · sin incidencias en el periodo",
    ].join("\n\n")}\n`;
  }

  const blocks = [head, "## Índice", index, "---"];
  ordered.forEach((entry, position) => {
    // Una raya entre informes: cada parte se lee solo, y entregado en papel se
    // ve dónde acaba uno y empieza el siguiente.
    if (position > 0) blocks.push("---");
    blocks.push(
      incidentReport({
        incident: entry.incident,
        equipmentName: entry.equipmentName,
        trail: entry.trail,
        exportedBy: input.exportedBy,
        now,
        level: 2,
      }).trimEnd(),
    );
  });

  return `${blocks.join("\n\n")}\n`;
}

/**
 * Cuánto entra por estado («3 resueltas», «1 en taller»), en orden de flujo:
 * el desglose que encabeza el lote y el que enseña el diálogo antes de
 * descargarlo.
 */
export function reportStatusCounts(
  incidents: readonly ReportIncident[],
): string[] {
  return statusCounts(incidents.map((incident) => ({ incident })));
}
