import { AUTO_ARCHIVE_BY } from "../archive";
import { formatDateTime, INCIDENT_STATUS_META } from "../workshop";
import {
  MAX_DETAIL_LINES,
  type WeeklyDigest,
  type WeeklyEmail,
} from "./types";

/** Escapa lo que va dentro del HTML del correo. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** «5 incidencias», con el singular bien puesto. */
export function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** «3 días», «1 día». */
export function daysPhrase(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export function workedLines(digest: WeeklyDigest): string[] {
  const { worked } = digest;
  if (
    worked.incidentsTouched === 0 &&
    worked.requestsDecided === 0 &&
    worked.requestsIssued === 0
  ) {
    return [
      "Semana sin movimientos registrados: ni incidencias tocadas ni peticiones decididas.",
    ];
  }
  const lines = [
    `- Incidencias con movimiento: ${worked.incidentsTouched} ` +
      `(${count(worked.statusChanges, "cambio de estado", "cambios de estado")}, ` +
      `${count(worked.notes, "nota", "notas")}, ${count(worked.documents, "documento", "documentos")})`,
    `- Cerradas: ${worked.resolved} con resolución · ${worked.unresolved} sin resolución`,
    `- Peticiones decididas: ${worked.requestsDecided} · entregadas: ${worked.requestsIssued}`,
  ];
  if (worked.requestsByStatus.length > 0) {
    lines.push(
      `- Peticiones que se movieron: ${worked.requestsByStatus
        .map((item) => `${item.count} ${item.label.toLowerCase()}`)
        .join(" · ")}`,
    );
  }
  if (worked.workers.length > 0) {
    lines.push(
      `- Quién movió el taller: ${worked.workers
        .map((worker) => `${worker.name} (${worker.movements})`)
        .join(", ")}`,
    );
  }
  for (const item of worked.closed.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference}${item.equipment ? ` (${item.equipment})` : ""} · ${
        INCIDENT_STATUS_META[item.status].label
      }${item.by ? ` — ${item.by}` : ""}`,
    );
  }
  if (worked.closed.length > MAX_DETAIL_LINES) {
    lines.push(
      `  · y ${worked.closed.length - MAX_DETAIL_LINES} más cerradas.`,
    );
  }
  return lines;
}

export function traceLines(digest: WeeklyDigest): string[] {
  if (digest.withoutTrace.length === 0) {
    return [
      `Nada: no hay trabajo que lleve ${daysPhrase(
        digest.marginDays,
      )} o más en curso sin constancia.`,
    ];
  }
  const lines = [
    `${count(
      digest.withoutTrace.length,
      "incidencia lleva",
      "incidencias llevan",
    )} ${daysPhrase(digest.marginDays)} o más en curso sin que su técnico anote nada:`,
  ];
  for (const item of digest.withoutTrace.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference} · ${INCIDENT_STATUS_META[item.status].label}${
        item.assignee ? ` · ${item.assignee}` : ""
      } · ${count(item.days, "día", "días")} en curso`,
    );
  }
  if (digest.withoutTrace.length > MAX_DETAIL_LINES) {
    lines.push(
      `  · y ${digest.withoutTrace.length - MAX_DETAIL_LINES} más esperando en la cola.`,
    );
  }
  return lines;
}

export function archivedLines(digest: WeeklyDigest): string[] {
  const { archived } = digest;
  if (archived.total === 0) {
    return ["Sin fichas nuevas en el archivo esta semana."];
  }
  const lines = [
    `- ${count(archived.total, "ficha", "fichas")} al archivo: ` +
      `${count(archived.incidents, "incidencia", "incidencias")} y ` +
      `${count(archived.requests, "petición", "peticiones")}` +
      ` (${archived.automatic} automáticas, ${archived.byHand} a mano)`,
  ];
  for (const item of archived.items.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference} · ${formatDateTime(item.at)} · ${
        item.automatic ? AUTO_ARCHIVE_BY : item.by || "a mano"
      }`,
    );
  }
  if (archived.items.length > MAX_DETAIL_LINES) {
    lines.push(`  · y ${archived.items.length - MAX_DETAIL_LINES} más.`);
  }
  return lines;
}

/** Enlace sencillo a la app, si se conoce su dirección pública. */
export function appLink(appUrl?: string | null): string | null {
  const url = appUrl?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

/**
 * El correo tal y como sale: asunto, texto plano y HTML. El texto es el cuerpo
 * de verdad (se lee en cualquier cliente) y el HTML solo lo maqueta.
 */
export function renderWeeklyReport(
  digest: WeeklyDigest,
  options: { appUrl?: string | null; recipients?: readonly string[] } = {},
): WeeklyEmail {
  const subject = `Resumen semanal del taller · ${digest.window.label}`;
  const sections: { title: string; lines: string[] }[] = [
    { title: "Lo que se trabajó", lines: workedLines(digest) },
    { title: "Sin constancia", lines: traceLines(digest) },
    { title: "Archivado", lines: archivedLines(digest) },
  ];

  const link = appLink(options.appUrl);
  const footer = [
    "Pulso Taller · Repuestos de equipo audiovisual",
    "Resumen generado automáticamente; recoge solo lo registrado en la aplicación.",
    link ? `Panel del taller: ${link}` : null,
  ].filter((line): line is string => line !== null);

  const text = [
    "RESUMEN SEMANAL DEL TALLER",
    digest.window.label,
    "",
    ...sections.flatMap((section) => [
      section.title.toUpperCase(),
      ...section.lines,
      "",
    ]),
    ...footer,
    "",
  ].join("\n");

  const html = [
    `<h1 style="font-size:18px;margin:0 0 4px">Resumen semanal del taller</h1>`,
    `<p style="margin:0 0 16px;color:#555">${escapeHtml(digest.window.label)}</p>`,
    ...sections.map(
      (section) =>
        `<h2 style="font-size:15px;margin:16px 0 6px">${escapeHtml(
          section.title,
        )}</h2>\n<ul style="margin:0;padding-left:18px">\n${section.lines
          .map((line) => {
            const bullet = line.startsWith("- ");
            const text2 = bullet ? line.slice(2) : line;
            return `<li style="margin:2px 0">${escapeHtml(text2)}</li>`;
          })
          .join("\n")}\n</ul>`,
    ),
    `<p style="margin:16px 0 0;color:#555;font-size:12px">${footer
      .map(escapeHtml)
      .join("<br>")}</p>`,
  ].join("\n");

  return { subject, text, html };
}
