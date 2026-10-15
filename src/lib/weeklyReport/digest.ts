import { AUTO_ARCHIVE_BY } from "../archive";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  STATUS_META,
  liveNotes,
  workWithoutTraceDays,
  type RequestStatus,
} from "../workshop";
import {
  MAX_WORKERS,
  weeklyReportWindow,
  type WeeklyArchivedLine,
  type WeeklyClosedLine,
  type WeeklyDigest,
  type WeeklyIncident,
  type WeeklyRequest,
  type WeeklyTraceLine,
  type WeeklyWindow,
} from "./types";

/** ¿La marca cae dentro de la semana que se resume? */
export function within(
  at: number | undefined | null,
  window: WeeklyWindow,
): boolean {
  return at !== undefined && at !== null && at >= window.from && at <= window.to;
}

/** Cuándo quedó en su estado actual (el último paso del historial con ese estado). */
export function lastStatusAt(incident: WeeklyIncident): number | undefined {
  for (let index = incident.history.length - 1; index >= 0; index -= 1) {
    if (incident.history[index].status === incident.status) {
      return incident.history[index].at;
    }
  }
  return incident.closedAt;
}

/** «Cámara de estudio · HDC-3500», o cadena vacía si no se sabe el equipo. */
export function equipmentLabelOf(incident: WeeklyIncident): string {
  return [incident.equipmentKind, incident.model]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
}

/**
 * Digest de la semana: se calcula sobre los documentos ya cargados (el backend
 * le pasa las colas vivas y el archivo, que son las que traen las marcas de
 * tiempo que hacen falta).
 */
export function weeklyDigest(input: {
  incidents: readonly WeeklyIncident[];
  requests: readonly WeeklyRequest[];
  now?: number;
  marginDays?: number;
}): WeeklyDigest {
  const now = input.now ?? Date.now();
  const window = weeklyReportWindow(now);
  // El mismo margen que el aviso del panel: lo que el resumen llama «sin
  // constancia» es exactamente lo que el aviso señala en la pantalla.
  const marginDays = input.marginDays ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;

  let statusChanges = 0;
  let notes = 0;
  let documents = 0;
  let incidentsTouched = 0;
  let resolved = 0;
  let unresolved = 0;
  const closed: WeeklyClosedLine[] = [];
  const movements = new Map<string, number>();

  const tally = (name: string | undefined) => {
    const clean = name?.trim();
    if (!clean) return;
    movements.set(clean, (movements.get(clean) ?? 0) + 1);
  };

  for (const incident of input.incidents) {
    const changes = incident.history.filter((entry) => within(entry.at, window));
    const written = liveNotes(incident.lifecycleNotes).filter((note) =>
      within(note.at, window),
    );
    const attached = (incident.documents ?? []).filter((document) =>
      within(document.createdAt, window),
    );

    statusChanges += changes.length;
    notes += written.length;
    documents += attached.length;
    for (const entry of changes) tally(entry.by);
    for (const note of written) tally(note.author);

    const closedInWindow = within(lastStatusAt(incident), window);
    if (closedInWindow && incident.status === "resolved") resolved += 1;
    if (closedInWindow && incident.status === "unresolved") unresolved += 1;
    if (closedInWindow) {
      closed.push({
        reference: incident.reference,
        equipment: equipmentLabelOf(incident),
        status: incident.status,
        at: lastStatusAt(incident) ?? incident.closedAt ?? now,
        by: incident.assigneeName,
      });
    }

    const touched =
      within(incident.reportedAt, window) ||
      changes.length > 0 ||
      written.length > 0 ||
      attached.length > 0;
    if (touched) incidentsTouched += 1;
  }

  const withoutTrace: WeeklyTraceLine[] = input.incidents
    .flatMap((incident) => {
      const days = workWithoutTraceDays(
        {
          status: incident.status,
          history: incident.history,
          assigneeId: incident.assigneeId,
          workshopAssigneeId: incident.workshopAssigneeId,
          lifecycleNotes: incident.lifecycleNotes,
        },
        now,
        marginDays,
      );
      if (days === null) return [];
      return [
        {
          reference: incident.reference,
          status: incident.status,
          assignee: incident.assigneeName ?? incident.workshopAssigneeName,
          days,
        },
      ];
    })
    .sort((a, b) => b.days - a.days);

  let requestsDecided = 0;
  let requestsIssued = 0;
  const movedRequests = new Map<RequestStatus, number>();
  for (const request of input.requests) {
    if (within(request.decidedAt, window)) requestsDecided += 1;
    if (within(request.issuedAt, window)) requestsIssued += 1;
    const moved =
      within(request.decidedAt, window) ||
      within(request.issuedAt, window) ||
      within(request.returnedAt, window);
    if (moved) {
      movedRequests.set(
        request.status,
        (movedRequests.get(request.status) ?? 0) + 1,
      );
    }
  }

  const requestsByStatus = [...movedRequests.entries()]
    .map(([status, count]) => ({
      status,
      label: STATUS_META[status]?.label ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

  const archivedItems: WeeklyArchivedLine[] = [
    ...input.incidents.flatMap((incident) =>
      within(incident.archivedAt, window)
        ? [
            {
              kind: "incident" as const,
              reference: incident.reference,
              at: incident.archivedAt ?? now,
              by: incident.archivedBy,
              automatic: incident.archivedBy === AUTO_ARCHIVE_BY,
            },
          ]
        : [],
    ),
    ...input.requests.flatMap((request) =>
      within(request.archivedAt, window)
        ? [
            {
              kind: "request" as const,
              reference: request.reference,
              at: request.archivedAt ?? now,
              by: request.archivedBy,
              automatic: request.archivedBy === AUTO_ARCHIVE_BY,
            },
          ]
        : [],
    ),
  ].sort((a, b) => b.at - a.at);

  const workers = [...movements.entries()]
    .map(([name, count]) => ({ name, movements: count }))
    .sort(
      (a, b) => b.movements - a.movements || a.name.localeCompare(b.name, "es"),
    )
    .slice(0, MAX_WORKERS);

  return {
    window,
    marginDays,
    worked: {
      incidentsTouched,
      statusChanges,
      notes,
      documents,
      resolved,
      unresolved,
      requestsDecided,
      requestsIssued,
      requestsByStatus,
      closed: closed.sort((a, b) => b.at - a.at),
      workers,
    },
    withoutTrace,
    archived: {
      incidents: archivedItems.filter((item) => item.kind === "incident")
        .length,
      requests: archivedItems.filter((item) => item.kind === "request").length,
      total: archivedItems.length,
      automatic: archivedItems.filter((item) => item.automatic).length,
      byHand: archivedItems.filter((item) => !item.automatic).length,
      items: archivedItems,
    },
  };
}
