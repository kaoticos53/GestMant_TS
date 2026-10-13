import { describe, expect, test } from "vitest";
import { COORDINATION_ROLES } from "../src/lib/roles";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
  INCIDENT_REFERENCE_PREFIX,
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
  NOTE_EDIT_WINDOW_MS,
  alertReachesRole,
  documentTrailLabel,
  equipmentLabel,
  formatFileSize,
  hasTechnicianNote,
  inProgressSince,
  isNoteWithinEditWindow,
  liveNotes,
  matchesIncidentQuery,
  noteEditDeadline,
  noteRestoration,
  noteRestoreUndoIndex,
  noteVersionChanges,
  noteVersions,
  normalizeIncidentReference,
  retiredNotes,
  requestMatchesEquipment,
  stockState,
  workWithoutTraceDays,
} from "../src/lib/workshop";

const equipo = { _id: "eq01fx", model: "FX-888D" };

describe("formatFileSize — tamaño de un archivo para leerlo de un vistazo", () => {
  test("los kilobytes redondean y los megabytes llevan un decimal", () => {
    expect(formatFileSize(50 * 1024)).toBe("50 KB");
    // Una foto de móvil ya comprimida: 198.294 bytes.
    expect(formatFileSize(203054)).toBe("198 KB");
    expect(formatFileSize(691200)).toBe("675 KB");
    expect(formatFileSize(4.9 * 1024 * 1024)).toBe("4,9 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  test("por debajo de un kilobyte no se dice «0 KB» de un archivo que existe", () => {
    expect(formatFileSize(120)).toBe("1 KB");
    // Y sin archivo —el que ya no está en el almacén— se dice que no hay nada.
    expect(formatFileSize(0)).toBe("0 KB");
    expect(formatFileSize(-1)).toBe("0 KB");
  });
});

describe("requestMatchesEquipment — filtro de peticiones por modelo", () => {
  test("sin equipo filtrado, coincide con todo", () => {
    expect(requestMatchesEquipment({ equipment: "Cualquier cosa" }, undefined)).toBe(
      true,
    );
  });

  test("coincide por el id elegido del inventario", () => {
    expect(
      requestMatchesEquipment(
        { equipmentId: "eq01fx", equipment: "Estación de soldadura FX-888D" },
        equipo,
      ),
    ).toBe(true);
  });

  test("coincide por el modelo escrito a mano, sin id", () => {
    expect(
      requestMatchesEquipment(
        { equipment: "Estación de soldadura fx-888d (turno noche)" },
        equipo,
      ),
    ).toBe(true);
  });

  test("no coincide con otro modelo escrito a mano", () => {
    expect(
      requestMatchesEquipment({ equipment: "Horno de reflow HOR-2" }, equipo),
    ).toBe(false);
  });

  test("una petición sin equipo no coincide con un filtro de modelo", () => {
    expect(requestMatchesEquipment({}, equipo)).toBe(false);
  });

  test("el id de otro equipo no coincide aunque el texto no exista", () => {
    expect(
      requestMatchesEquipment({ equipmentId: "eq02otro" }, equipo),
    ).toBe(false);
  });
});

describe("equipmentLabel", () => {
  test("combina designación y modelo", () => {
    expect(
      equipmentLabel({ name: "Estación de soldadura", model: "FX-888D" }),
    ).toBe("Estación de soldadura FX-888D");
  });
});

describe("stockState — regla de stock bajo compartida por el resumen y el catálogo", () => {
  test("distingue agotado, bajo mínimo y disponible", () => {
    expect(stockState(0, 5)).toBe("out");
    expect(stockState(-1, 5)).toBe("out");
    expect(stockState(4, 5)).toBe("low");
    // Justo en el mínimo ya cuenta como bajo: es lo que suma la tarjeta.
    expect(stockState(5, 5)).toBe("low");
    expect(stockState(6, 5)).toBe("ok");
  });

  test("sin mínimo, cualquier stock positivo está disponible", () => {
    expect(stockState(1, 0)).toBe("ok");
    expect(stockState(0, 0)).toBe("out");
  });
});

describe("isNoteWithinEditWindow — plazo del autor para corregir su nota", () => {
  const escrito = 1_700_000_000_000;

  test("el plazo dura el margen publicado y se cierra justo al acabarse", () => {
    expect(isNoteWithinEditWindow(escrito, escrito)).toBe(true);
    expect(isNoteWithinEditWindow(escrito, escrito + NOTE_EDIT_WINDOW_MS)).toBe(
      true,
    );
    expect(
      isNoteWithinEditWindow(escrito, escrito + NOTE_EDIT_WINDOW_MS + 1),
    ).toBe(false);
  });

  test("una fecha del hilo posterior al momento de escribirla no abre el plazo", () => {
    // En el límite: si la nota se escribió hace nada, el margen entero está
    // por delante; si su marca es del futuro (relojes desajustados), no hay
    // plazo que valga y la nota ya es histórico.
    expect(isNoteWithinEditWindow(escrito, escrito - 1)).toBe(false);
  });

  test("el vencimiento que se enseña en la ficha es el fin del plazo", () => {
    expect(noteEditDeadline(escrito)).toBe(escrito + NOTE_EDIT_WINDOW_MS);
  });
});

describe("noteVersions — historial de correcciones de una nota", () => {
  const primera = { note: "Primera versión.", at: 1_700_000_000_000 };
  const segunda = { note: "Segunda versión.", at: 1_700_000_600_000 };

  test("enseña primero la corrección más reciente", () => {
    expect(noteVersions({ versions: [primera, segunda] })).toEqual([
      segunda,
      primera,
    ]);
  });

  test("una nota sin correcciones no tiene historial", () => {
    expect(noteVersions({})).toEqual([]);
    expect(noteVersions({ versions: [] })).toEqual([]);
  });

  test("leerlo no reordena el original que guarda el expediente", () => {
    const versions = [primera, segunda];
    noteVersions({ versions });
    expect(versions).toEqual([primera, segunda]);
  });
});

describe("noteVersionChanges — cada corrección con su sitio en el historial", () => {
  const versions = [
    { note: "Primera versión.", at: 1_700_000_000_000 },
    { note: "Segunda versión.", at: 1_700_000_600_000 },
  ];

  test("la posición es la del historial guardado, no la de la ficha", () => {
    const changes = noteVersionChanges({ note: "Tercera versión.", versions });
    // Se enseñan de la más reciente a la más antigua...
    expect(changes.map((change) => change.at)).toEqual([
      versions[1].at,
      versions[0].at,
    ]);
    // ...pero la posición que identifica cada versión es la de dentro del
    // historial, que es la que aguanta dos correcciones en el mismo instante.
    expect(changes.map((change) => change.index)).toEqual([1, 0]);
  });
});

describe("noteRestoration — constancia de volver a una versión anterior", () => {
  const versions = [
    { note: "Primera versión.", at: 1_700_000_000_000 },
    { note: "Segunda versión.", at: 1_700_000_600_000 },
  ];

  test("una nota que nunca se restauró no tiene constancia", () => {
    expect(noteRestoration({})).toBeNull();
    expect(
      noteRestoration({ restoredBy: "Iván Torres", restoredVersion: 0 }),
    ).toBeNull();
  });

  test("la constancia dice quién, cuándo y a qué versión se volvió", () => {
    expect(
      noteRestoration({
        versions,
        restoredAt: 1_700_000_900_000,
        restoredBy: "Iván Torres",
        restoredVersion: 0,
      }),
    ).toEqual({
      at: 1_700_000_900_000,
      by: "Iván Torres",
      version: 0,
      from: 1_700_000_000_000,
    });
  });

  test("sin nombre ni versión anotados no se inventa nada", () => {
    expect(noteRestoration({ restoredAt: 1_700_000_900_000 })).toEqual({
      at: 1_700_000_900_000,
      by: "—",
      version: null,
      from: null,
    });
  });

  test("una versión que ya no está en el historial se queda sin fecha", () => {
    expect(
      noteRestoration({ versions, restoredAt: 1, restoredVersion: 7 }),
    ).toEqual({ at: 1, by: "—", version: 7, from: null });
  });
});

describe("noteRestoreUndoIndex — volver al texto que quitó una restauración", () => {
  const versions = [
    { note: "Primera versión.", at: 1_700_000_000_000 },
    { note: "Segunda versión.", at: 1_700_000_600_000 },
  ];

  test("deshacer es volver a donde queda el texto que se quita", () => {
    // Restaurar la versión 0 archiva lo que la nota dice ahora ("Tercera
    // versión.") al final del historial: esa posición 2 es la que hay que
    // devolver para recuperarlo.
    expect(
      noteRestoreUndoIndex({ note: "Tercera versión.", versions }, 0),
    ).toBe(2);
  });

  test("una nota sin historial no tiene nada que deshacer", () => {
    expect(noteRestoreUndoIndex({ note: "Solo texto." }, 0)).toBeNull();
    expect(noteRestoreUndoIndex({ note: "Solo texto.", versions: [] }, 0)).toBeNull();
  });

  test("volver a la versión que ya dice lo mismo no se deshace: no habría cambio", () => {
    expect(
      noteRestoreUndoIndex({ note: "Primera versión.", versions }, 0),
    ).toBeNull();
  });

  test("una posición que no está en el historial no se inventa", () => {
    expect(noteRestoreUndoIndex({ note: "Tercera versión.", versions }, 7)).toBeNull();
  });
});

describe("trabajo en curso sin constancia del técnico", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const ahora = 1_800_000_000_000;
  /** Incidencia asignada hace esos días (con su paso por «Nueva» detrás). */
  const asignadaHace = (dias: number) => ({
    status: "assigned" as const,
    history: [
      { status: "reported" as const, at: ahora - (dias + 1) * DAY },
      { status: "assigned" as const, at: ahora - dias * DAY },
    ],
  });

  test("cuenta desde la asignación, no desde la derivación a taller", () => {
    const at = ahora - 4 * DAY;
    expect(
      inProgressSince({
        status: "workshop",
        history: [
          { status: "reported", at: at - 3600_000 },
          { status: "assigned", at },
          { status: "workshop", at: at + 3600_000 },
        ],
      }),
    ).toBe(at);
  });

  test("sin paso de asignación anotado no se da por en curso", () => {
    expect(
      inProgressSince({
        status: "assigned",
        history: [{ status: "reported", at: ahora - 9 * DAY }],
      }),
    ).toBe(null);
  });

  test("avisa de la que lleva días en curso y no tiene ninguna nota", () => {
    expect(workWithoutTraceDays(asignadaHace(4), ahora)).toBe(4);
  });

  test("por debajo del margen todavía no avisa y justo en el margen sí", () => {
    expect(
      workWithoutTraceDays(
        asignadaHace(DEFAULT_WORK_WITHOUT_TRACE_DAYS - 1),
        ahora,
      ),
    ).toBe(null);
    expect(
      workWithoutTraceDays(asignadaHace(DEFAULT_WORK_WITHOUT_TRACE_DAYS), ahora),
    ).toBe(DEFAULT_WORK_WITHOUT_TRACE_DAYS);
  });

  test("el margen configurado manda sobre el de partida", () => {
    // Un margen más ancho calla lo que antes avisaba...
    expect(workWithoutTraceDays(asignadaHace(4), ahora, 7)).toBe(null);
    expect(workWithoutTraceDays(asignadaHace(7), ahora, 7)).toBe(7);
    // ...y uno más estrecho avisa mucho antes.
    expect(workWithoutTraceDays(asignadaHace(1), ahora, 1)).toBe(1);
    expect(workWithoutTraceDays(asignadaHace(0), ahora, 1)).toBe(null);
  });

  test("los límites del margen configurable son los que acepta el backend", () => {
    expect(workWithoutTraceDays(asignadaHace(MIN_WORK_WITHOUT_TRACE_DAYS), ahora, MIN_WORK_WITHOUT_TRACE_DAYS)).toBe(
      MIN_WORK_WITHOUT_TRACE_DAYS,
    );
    expect(
      workWithoutTraceDays(
        asignadaHace(MAX_WORK_WITHOUT_TRACE_DAYS),
        ahora,
        MAX_WORK_WITHOUT_TRACE_DAYS,
      ),
    ).toBe(MAX_WORK_WITHOUT_TRACE_DAYS);
    expect(
      workWithoutTraceDays(
        asignadaHace(MAX_WORK_WITHOUT_TRACE_DAYS + 1),
        ahora,
        MAX_WORK_WITHOUT_TRACE_DAYS,
      ),
    ).toBe(MAX_WORK_WITHOUT_TRACE_DAYS + 1);
  });

  test("lo que no está en curso se queda fuera del aviso", () => {
    for (const status of ["reported", "resolved", "unresolved"] as const) {
      expect(workWithoutTraceDays({ ...asignadaHace(9), status }, ahora)).toBe(
        null,
      );
    }
    // En taller sigue siendo trabajo en curso.
    expect(
      workWithoutTraceDays({ ...asignadaHace(9), status: "workshop" }, ahora),
    ).toBe(9);
  });

  test("una nota del técnico asignado quita el aviso, aunque sea de los primeros días", () => {
    expect(
      workWithoutTraceDays(
        {
          ...asignadaHace(9),
          assigneeId: "tecnico",
          lifecycleNotes: [{ authorId: "tecnico", at: ahora - 8 * DAY }],
        },
        ahora,
      ),
    ).toBe(null);
  });

  test("la orden de taller también firma constancia", () => {
    expect(
      hasTechnicianNote({
        assigneeId: "tecnico",
        workshopAssigneeId: "taller",
        lifecycleNotes: [{ authorId: "taller" }],
      }),
    ).toBe(true);
  });

  test("una nota de quien coordina no tapa el hueco del técnico", () => {
    expect(
      workWithoutTraceDays(
        {
          ...asignadaHace(9),
          assigneeId: "tecnico",
          lifecycleNotes: [{ authorId: "coordinador", at: ahora - 8 * DAY }],
        },
        ahora,
      ),
    ).toBe(9);
  });

  test("si la incidencia cambia de manos, el aviso vuelve para el nuevo técnico", () => {
    expect(
      workWithoutTraceDays(
        {
          ...asignadaHace(9),
          assigneeId: "recien",
          lifecycleNotes: [{ authorId: "anterior", at: ahora - 8 * DAY }],
        },
        ahora,
      ),
    ).toBe(9);
  });

  test("una nota antigua sin firma cuenta como constancia", () => {
    // Hay algo escrito en el cuaderno aunque ya no se sepa quién: el aviso
    // busca trabajo sin rastro, no notas atribuibles.
    expect(
      workWithoutTraceDays(
        { ...asignadaHace(9), lifecycleNotes: [{ at: ahora - DAY }] },
        ahora,
      ),
    ).toBe(null);
  });

  test("un reloj por detrás de la asignación no inventa días", () => {
    expect(workWithoutTraceDays(asignadaHace(-10), ahora)).toBe(null);
  });

  test("una nota retirada del cuaderno no tapa el hueco del técnico", () => {
    // Si se sacó del cuaderno, es como si no estuviera: el aviso vuelve.
    expect(
      workWithoutTraceDays(
        {
          ...asignadaHace(9),
          assigneeId: "tecnico",
          lifecycleNotes: [
            {
              authorId: "tecnico",
              at: ahora - 8 * DAY,
              deletedAt: ahora - DAY,
            },
          ],
        },
        ahora,
      ),
    ).toBe(9);
    expect(
      hasTechnicianNote({
        assigneeId: "tecnico",
        lifecycleNotes: [{ authorId: "tecnico", deletedAt: ahora }],
      }),
    ).toBe(false);
  });
});

describe("aviso de trabajo sin constancia — a qué roles les llega", () => {
  test("de partida le llega a quien coordina el taller", () => {
    expect([...DEFAULT_WORK_WITHOUT_TRACE_ROLES]).toEqual([
      ...COORDINATION_ROLES,
    ]);
    expect(alertReachesRole("admin", DEFAULT_WORK_WITHOUT_TRACE_ROLES)).toBe(
      true,
    );
    expect(alertReachesRole("manager", DEFAULT_WORK_WITHOUT_TRACE_ROLES)).toBe(
      true,
    );
    expect(
      alertReachesRole("technician", DEFAULT_WORK_WITHOUT_TRACE_ROLES),
    ).toBe(false);
  });

  test("manda la lista guardada, no los permisos del rol", () => {
    // Un rol que no coordina entra si quien configura lo añade a mano...
    expect(alertReachesRole("technician", ["technician"])).toBe(true);
    expect(alertReachesRole("auxiliar-de-almacen", ["auxiliar-de-almacen"])).toBe(
      true,
    );
    // ...y uno que coordina se queda fuera si no está en la lista.
    expect(alertReachesRole("manager", ["admin"])).toBe(false);
    expect(alertReachesRole("admin", [])).toBe(false);
  });

  test("sin rol no le llega a nadie", () => {
    expect(alertReachesRole(undefined, ["admin"])).toBe(false);
    expect(alertReachesRole(null, ["admin"])).toBe(false);
  });
});

describe("notas vivas y retiradas del cuaderno", () => {
  test("separa las que están en el cuaderno de las que esperan recuperarse", () => {
    const notas = [
      { id: "n1", note: "Sigue en el cuaderno." },
      { id: "n2", note: "Retirada por error.", deletedAt: 1_700_000_000_000 },
      { id: "n3", note: "Otra viva." },
    ];
    expect(liveNotes(notas).map((nota) => nota.id)).toEqual(["n1", "n3"]);
    expect(retiredNotes(notas).map((nota) => nota.id)).toEqual(["n2"]);
    // Las notas heredadas, sin el campo, están vivas como cualquier otra.
    expect(liveNotes([{ note: "Del cuaderno de papel." }])).toHaveLength(1);
  });

  test("sin notas no hay nada que separar", () => {
    expect(liveNotes(undefined)).toEqual([]);
    expect(retiredNotes([])).toEqual([]);
  });
});

describe("normalizeIncidentReference — el número con el que se sigue una incidencia", () => {
  test("la referencia que se le da a quien notifica se escribe con prefijo y ceros", () => {
    expect(normalizeIncidentReference("INC-0004")).toBe("INC-0004");
    expect(INCIDENT_REFERENCE_PREFIX).toBe("INC");
  });

  test("se acepta escrita como sea: en minúsculas, sin el prefijo o el número suelto", () => {
    for (const typed of ["inc-4", "INC-4", "4", " la 4 ", "Incidencia nº 4"]) {
      expect(normalizeIncidentReference(typed), `«${typed}»`).toBe("INC-0004");
    }
  });

  test("más de cuatro cifras se respetan tal cual", () => {
    expect(normalizeIncidentReference("INC-12345")).toBe("INC-12345");
  });

  test("sin ningún número no hay referencia que buscar", () => {
    for (const typed of ["", "   ", "la de la cámara", null, undefined]) {
      expect(
        normalizeIncidentReference(typed as string),
        `«${String(typed)}»`,
      ).toBeNull();
    }
  });

  test("el primer número es el que cuenta", () => {
    // Un correo con la referencia dentro: se queda con el número de delante, que
    // es el que se copia y se pega.
    expect(normalizeIncidentReference("INC-0004 (2026)")).toBe("INC-0004");
  });
});

describe("matchesIncidentQuery — encontrar la incidencia en la lista", () => {
  const campos = [
    "INC-0004",
    "Cámara de estudio",
    "HDC-3500",
    "Plató 1",
    "Alba Moreno",
  ];

  test("la referencia se encuentra escrita como se escriba", () => {
    for (const typed of ["INC-0004", "inc-4", "4", " la 0004 ", "Incidencia 4"]) {
      expect(
        matchesIncidentQuery(campos, "INC-0004", typed),
        `«${typed}»`,
      ).toBe(true);
    }
  });

  test("el número de otra incidencia no la saca", () => {
    expect(matchesIncidentQuery(campos, "INC-0004", "INC-0005")).toBe(false);
    expect(matchesIncidentQuery(campos, "INC-0004", "tripié")).toBe(false);
  });

  test("la referencia sola basta, aunque no venga en los campos", () => {
    // La comparación por número va aparte del texto: así «4» encuentra la
    // incidencia aunque lo que se busque no sea cómo se enseña la referencia.
    expect(matchesIncidentQuery([], "INC-0004", "4")).toBe(true);
    expect(matchesIncidentQuery([], "INC-0004", "otra cosa")).toBe(false);
  });

  test("los datos siguen buscándose como en el resto de listas", () => {
    expect(matchesIncidentQuery(campos, "INC-0004", "cámara 3500")).toBe(true);
    expect(matchesIncidentQuery(campos, "INC-0004", "tripié")).toBe(false);
  });
});

describe("documentTrailLabel — la frase del rastro de auditoría", () => {
  test("el alta y la retirada se cuentan con el nombre del documento", () => {
    expect(documentTrailLabel({ action: "attached", name: "Acta.pdf" })).toBe(
      "Adjuntó «Acta.pdf»",
    );
    expect(documentTrailLabel({ action: "removed", name: "Acta.pdf" })).toBe(
      "Quitó «Acta.pdf»",
    );
  });

  test("con nombre anterior lo cuenta como renombrado y sin él como corrección", () => {
    expect(
      documentTrailLabel({
        action: "edited",
        name: "Acta (revisado).pdf",
        previousName: "Acta.pdf",
      }),
    ).toBe("Renombró «Acta.pdf» a «Acta (revisado).pdf»");
    expect(documentTrailLabel({ action: "edited", name: "Acta.pdf" })).toBe(
      "Actualizó la ficha de «Acta.pdf»",
    );
  });

  test("el reemplazo del archivo se cuenta como tal, no como una corrección", () => {
    expect(documentTrailLabel({ action: "replaced", name: "Acta.pdf" })).toBe(
      "Reemplazó el archivo de «Acta.pdf»",
    );
    // Reemplazar y renombrar a la vez es un solo movimiento con dos hechos.
    expect(
      documentTrailLabel({
        action: "replaced",
        name: "Acta (hoy).pdf",
        previousName: "Acta.pdf",
      }),
    ).toBe(
      "Reemplazó el archivo de «Acta.pdf» y lo renombró a «Acta (hoy).pdf»",
    );
  });
});
