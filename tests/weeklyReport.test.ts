import { describe, expect, test } from "vitest";
import { AUTO_ARCHIVE_BY } from "../src/lib/archive";
import {
  DEFAULT_WEEKLY_REPORT_ROLES,
  MAX_DETAIL_LINES,
  WEEK_MS,
  renderWeeklyReport,
  utcWeekday,
  weeklyDigest,
  weeklyRecipients,
  weeklyReportKey,
  weeklyReportWindow,
  weekdayLabel,
  type WeeklyIncident,
  type WeeklyRequest,
} from "../src/lib/weeklyReport";

const DAY = 24 * 60 * 60 * 1000;
/** Jueves 8 de octubre de 2026, 12:00 UTC: el «ahora» de todas las pruebas. */
const AHORA = Date.UTC(2026, 9, 8, 12, 0, 0);

/** Incidencia mínima; cada prueba retoca lo que le importa. */
function incident(overrides: Partial<WeeklyIncident> = {}): WeeklyIncident {
  return {
    reference: "INC-0001",
    status: "assigned",
    equipmentKind: "Cámara de estudio",
    model: "HDC-3500",
    reportedAt: AHORA - 2 * DAY,
    history: [{ status: "reported", at: AHORA - 2 * DAY, by: "Laura Peña" }],
    ...overrides,
  };
}

/** Petición mínima. */
function request(overrides: Partial<WeeklyRequest> = {}): WeeklyRequest {
  return {
    reference: "PET-0001",
    status: "pending",
    requesterName: "Sandra Ruiz",
    createdAt: AHORA - 3 * DAY,
    ...overrides,
  };
}

describe("weeklyReportWindow — la semana que se resume", () => {
  test("cubre los últimos siete días y se rotula con sus fechas", () => {
    const window = weeklyReportWindow(AHORA);
    expect(window.to).toBe(AHORA);
    expect(window.from).toBe(AHORA - WEEK_MS);
    expect(window.label).toBe("01 oct 2026 – 08 oct 2026");
  });

  test("la clave de la semana es el día en que arranca la ventana", () => {
    expect(weeklyReportKey(AHORA)).toBe("week-2026-10-01");
    // Reenviar el mismo día cae en la misma fila; al día siguiente, en otra.
    expect(weeklyReportKey(AHORA + DAY)).toBe("week-2026-10-02");
  });
});

describe("utcWeekday — el día del envío", () => {
  test("numera como el selector (lunes 1 … domingo 7)", () => {
    expect(utcWeekday(Date.UTC(2026, 9, 5, 7))).toBe(1); // lunes
    expect(utcWeekday(Date.UTC(2026, 9, 8, 12))).toBe(4); // jueves
    expect(utcWeekday(Date.UTC(2026, 9, 11, 7))).toBe(7); // domingo
  });

  test("nombra los días en castellano y no se inventa los raros", () => {
    expect(weekdayLabel(1)).toBe("Lunes");
    expect(weekdayLabel(7)).toBe("Domingo");
    expect(weekdayLabel(9)).toBe("Día 9");
  });
});

describe("weeklyDigest — lo que se trabajó", () => {
  test("cuenta incidencias con movimiento, cambios de estado, notas y documentos", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          history: [
            { status: "reported", at: AHORA - 2 * DAY, by: "Laura Peña" },
            { status: "assigned", at: AHORA - DAY, by: "Elena Vidal" },
          ],
          lifecycleNotes: [
            { note: "En pruebas.", author: "Iván Torres", at: AHORA - DAY },
          ],
          documents: [{ name: "Acta.pdf", author: "Elena Vidal", createdAt: AHORA }],
        }),
        // Sin nada dentro de la semana: ni tocada ni contada.
        incident({
          reference: "INC-0002",
          reportedAt: AHORA - 20 * DAY,
          history: [{ status: "reported", at: AHORA - 20 * DAY, by: "Laura Peña" }],
        }),
      ],
      requests: [],
    });

    expect(digest.worked.incidentsTouched).toBe(1);
    expect(digest.worked.statusChanges).toBe(2);
    expect(digest.worked.notes).toBe(1);
    expect(digest.worked.documents).toBe(1);
  });

  test("las cerradas son las que cerraron dentro de la semana", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          reference: "INC-0010",
          status: "resolved",
          history: [
            { status: "reported", at: AHORA - 9 * DAY, by: "Laura Peña" },
            { status: "resolved", at: AHORA - DAY, by: "Iván Torres" },
          ],
        }),
        // Cerrada antes de la semana: no cuenta como cerrada esta vez.
        incident({
          reference: "INC-0011",
          status: "unresolved",
          history: [
            { status: "reported", at: AHORA - 30 * DAY, by: "Laura Peña" },
            { status: "unresolved", at: AHORA - 10 * DAY, by: "Iván Torres" },
          ],
        }),
      ],
      requests: [],
    });

    expect(digest.worked.resolved).toBe(1);
    expect(digest.worked.unresolved).toBe(0);
    expect(digest.worked.closed.map((item) => item.reference)).toEqual([
      "INC-0010",
    ]);
    expect(digest.worked.closed[0].equipment).toBe("Cámara de estudio · HDC-3500");
    expect(digest.worked.closed[0].by).toBeUndefined();
  });

  test("el borde de la ventana: justo al empezar entra, un segundo antes no", () => {
    const from = weeklyReportWindow(AHORA).from;
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          reference: "Dentro",
          history: [{ status: "reported", at: from, by: "Laura Peña" }],
        }),
        incident({
          reference: "Fuera",
          history: [{ status: "reported", at: from - 1, by: "Laura Peña" }],
          reportedAt: from - 1,
        }),
      ],
      requests: [],
    });

    expect(digest.worked.statusChanges).toBe(1);
    expect(digest.worked.incidentsTouched).toBe(1);
  });

  test("una nota retirada del cuaderno no cuenta como trabajo", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          reportedAt: AHORA - 20 * DAY,
          history: [{ status: "reported", at: AHORA - 20 * DAY, by: "Laura Peña" }],
          lifecycleNotes: [
            {
              note: "Se anuló.",
              author: "Iván Torres",
              at: AHORA - DAY,
              deletedAt: AHORA - DAY / 2,
            },
          ],
        }),
      ],
      requests: [],
    });

    expect(digest.worked.notes).toBe(0);
    expect(digest.worked.incidentsTouched).toBe(0);
  });

  test("quién movió el taller: cambios de estado y notas firmadas, de más a menos", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          history: [
            { status: "reported", at: AHORA - 2 * DAY, by: "Laura Peña" },
            { status: "assigned", at: AHORA - DAY, by: "Elena Vidal" },
            { status: "workshop", at: AHORA - DAY / 2, by: "Elena Vidal" },
          ],
          lifecycleNotes: [
            { note: "Al taller.", author: "Elena Vidal", at: AHORA - DAY / 3 },
            { note: "Visto.", author: "Iván Torres", at: AHORA - DAY / 4 },
          ],
        }),
      ],
      requests: [],
    });

    expect(digest.worked.workers).toEqual([
      { name: "Elena Vidal", movements: 3 },
      { name: "Iván Torres", movements: 1 },
      { name: "Laura Peña", movements: 1 },
    ]);
  });

  test("las peticiones se cuentan por decisión, entrega y estado en que quedaron", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [],
      requests: [
        request({
          reference: "PET-0010",
          status: "approved",
          decidedAt: AHORA - DAY,
          decidedBy: "Elena Vidal",
        }),
        request({
          reference: "PET-0011",
          status: "issued",
          decidedAt: AHORA - 2 * DAY,
          issuedAt: AHORA - DAY,
        }),
        request({
          reference: "PET-0012",
          status: "rejected",
          decidedAt: AHORA - 3 * DAY,
        }),
        // Sigue pendiente: no se movió esta semana.
        request({ reference: "PET-0013", status: "pending" }),
      ],
    });

    expect(digest.worked.requestsDecided).toBe(3);
    expect(digest.worked.requestsIssued).toBe(1);
    expect(digest.worked.requestsByStatus).toEqual([
      { status: "approved", label: "Aprobada", count: 1 },
      { status: "issued", label: "Entregada", count: 1 },
      { status: "rejected", label: "Rechazada", count: 1 },
    ]);
  });
});

describe("weeklyDigest — lo que quedó sin constancia", () => {
  /** En curso desde hace `dias`, sin ninguna nota. */
  const enCurso = (dias: number) =>
    incident({
      status: "assigned",
      assigneeId: "tecnico",
      assigneeName: "Iván Torres",
      history: [
        { status: "reported", at: AHORA - (dias + 1) * DAY, by: "Laura Peña" },
        { status: "assigned", at: AHORA - dias * DAY, by: "Elena Vidal" },
      ],
    });

  test("usa el margen que le pasa el backend (el del aviso del panel)", () => {
    const incidents = [enCurso(4), enCurso(9)];
    const estrecho = weeklyDigest({ now: AHORA, incidents, requests: [], marginDays: 3 });
    expect(estrecho.withoutTrace.map((item) => item.days)).toEqual([9, 4]);

    const ancho = weeklyDigest({ now: AHORA, incidents, requests: [], marginDays: 10 });
    expect(ancho.withoutTrace).toEqual([]);
    expect(ancho.marginDays).toBe(10);
  });

  test("la que tiene nota del técnico queda fuera, y se enseña lo más parado primero", () => {
    const conNota = enCurso(9);
    conNota.lifecycleNotes = [
      { note: "Ya estoy con ella.", author: "Iván Torres", authorId: "tecnico", at: AHORA - DAY },
    ];

    const digest = weeklyDigest({
      now: AHORA,
      incidents: [conNota, enCurso(5), enCurso(7)],
      requests: [],
      marginDays: 3,
    });

    expect(digest.withoutTrace.map((item) => item.reference)).toEqual([
      "INC-0001",
      "INC-0001",
    ]);
    expect(digest.withoutTrace.map((item) => item.days)).toEqual([7, 5]);
    expect(digest.withoutTrace[0].assignee).toBe("Iván Torres");
    expect(digest.withoutTrace[0].status).toBe("assigned");
  });
});

describe("weeklyDigest — lo que se archivó", () => {
  test("separa lo automático de lo que movió alguien a mano", () => {
    const digest = weeklyDigest({
      now: AHORA,
      incidents: [
        incident({
          reference: "INC-0020",
          status: "resolved",
          archivedAt: AHORA - DAY,
          archivedBy: AUTO_ARCHIVE_BY,
        }),
        incident({
          reference: "INC-0021",
          status: "resolved",
          archivedAt: AHORA - 2 * DAY,
          archivedBy: "Elena Vidal",
        }),
        // Archivada la semana pasada: no entra.
        incident({
          reference: "INC-0022",
          archivedAt: AHORA - 20 * DAY,
          archivedBy: AUTO_ARCHIVE_BY,
        }),
      ],
      requests: [
        request({
          reference: "PET-0030",
          status: "approved",
          archivedAt: AHORA - DAY / 2,
          archivedBy: AUTO_ARCHIVE_BY,
        }),
      ],
    });

    expect(digest.archived.total).toBe(3);
    expect(digest.archived.incidents).toBe(2);
    expect(digest.archived.requests).toBe(1);
    expect(digest.archived.automatic).toBe(2);
    expect(digest.archived.byHand).toBe(1);
    // De lo más reciente a lo más antiguo, mezclando las dos colas.
    expect(digest.archived.items.map((item) => item.reference)).toEqual([
      "PET-0030",
      "INC-0020",
      "INC-0021",
    ]);
    expect(digest.archived.items[0].automatic).toBe(true);
    expect(digest.archived.items[2].automatic).toBe(false);
  });
});

describe("weeklyRecipients — a qué correos va", () => {
  const gente = [
    { name: "Elena Vidal", email: "coord@taller.es", role: "manager" },
    { name: "Ada Admin", email: "admin@taller.es", role: "admin" },
    { name: "Ada Admin", email: "ADMIN@taller.es", role: "admin" },
    { name: "Iván Torres", email: "tecnico@taller.es", role: "technician" },
    { name: "Diego Herrera", email: "baja@taller.es", role: "manager", active: false },
    { name: "Invitado", email: "invitado@taller.es", role: "manager", isAnonymous: true },
    { name: "Sin correo", role: "manager" },
  ];

  test("solo los roles elegidos, en activo, sin invitados y sin repetidos", () => {
    expect(weeklyRecipients(gente, DEFAULT_WEEKLY_REPORT_ROLES)).toEqual([
      "coord@taller.es",
      "admin@taller.es",
    ]);
  });

  test("añadir el técnico a mano también le llega", () => {
    expect(weeklyRecipients(gente, ["technician"])).toEqual([
      "tecnico@taller.es",
    ]);
    expect(weeklyRecipients(gente, [])).toEqual([]);
  });
});

describe("renderWeeklyReport — el correo", () => {
  const digest = weeklyDigest({
    now: AHORA,
    marginDays: 3,
    incidents: [
      incident({ reference: "INC-0090", reportedAt: AHORA - DAY }),
      incident({
        reference: "INC-0091",
        status: "assigned",
        assigneeId: "tecnico",
        assigneeName: "Iván Torres",
        equipmentKind: "Router <script>",
        history: [
          { status: "reported", at: AHORA - 9 * DAY, by: "Laura Peña" },
          { status: "assigned", at: AHORA - 8 * DAY, by: "Elena Vidal" },
        ],
      }),
      incident({
        reference: "INC-0092",
        status: "resolved",
        equipmentKind: "Trípode <script>alert(1)</script>",
        model: "546B",
        archivedAt: AHORA - DAY / 2,
        archivedBy: AUTO_ARCHIVE_BY,
        history: [
          { status: "reported", at: AHORA - 6 * DAY, by: "Laura Peña" },
          { status: "resolved", at: AHORA - DAY, by: "Iván Torres" },
        ],
      }),
    ],
    requests: [
      request({ reference: "PET-0090", status: "approved", decidedAt: AHORA - DAY }),
    ],
  });
  const email = renderWeeklyReport(digest, { appUrl: "http://localhost:5173/" });

  test("el asunto lleva la semana", () => {
    expect(email.subject).toBe(
      "Resumen semanal del taller · 01 oct 2026 – 08 oct 2026",
    );
  });

  test("el texto enseña las tres secciones con sus datos", () => {
    expect(email.text).toContain("RESUMEN SEMANAL DEL TALLER");
    expect(email.text).toContain("LO QUE SE TRABAJÓ");
    expect(email.text).toContain("Incidencias con movimiento: 3");
    expect(email.text).toContain("Peticiones decididas: 1 · entregadas: 0");
    expect(email.text).toContain("1 aprobada");
    expect(email.text).toContain("Quién movió el taller");
    expect(email.text).toContain("SIN CONSTANCIA");
    expect(email.text).toContain("3 días o más en curso sin que su técnico anote nada");
    expect(email.text).toContain("INC-0091 · Asignada · Iván Torres · 8 días en curso");
    expect(email.text).toContain("ARCHIVADO");
    expect(email.text).toContain("1 ficha al archivo");
    expect(email.text).toContain("1 automáticas, 0 a mano");
    expect(email.text).toContain("Panel del taller: http://localhost:5173");
  });

  test("el HTML va escapado y sin enlaces externos inventados", () => {
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("<h2");
  });

  test("una semana vacía lo dice sin inventarse actividad", () => {
    const vacio = renderWeeklyReport(
      weeklyDigest({ now: AHORA, incidents: [], requests: [] }),
    );
    expect(vacio.text).toContain("Semana sin movimientos registrados");
    expect(vacio.text).toContain(
      "no hay trabajo que lleve 3 días o más en curso sin constancia",
    );
    expect(vacio.text).toContain("Sin fichas nuevas en el archivo esta semana.");
  });

  test("con muchas cerradas resume el resto en una línea", () => {
    const muchas = weeklyDigest({
      now: AHORA,
      requests: [],
      incidents: Array.from({ length: MAX_DETAIL_LINES + 2 }, (_, index) =>
        incident({
          reference: `INC-01${String(index).padStart(2, "0")}`,
          status: "resolved",
          history: [
            { status: "reported", at: AHORA - 5 * DAY, by: "Laura Peña" },
            { status: "resolved", at: AHORA - DAY, by: "Iván Torres" },
          ],
        }),
      ),
    });
    const correo = renderWeeklyReport(muchas);
    expect(correo.text).toContain("y 2 más cerradas.");
    expect(correo.text).toContain("10 con resolución");
  });
});
