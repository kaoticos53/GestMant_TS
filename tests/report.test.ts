import { describe, expect, test } from "vitest";
import {
  REPORT_MIME,
  REPORT_PERIODS,
  inReportPeriod,
  incidentReport,
  incidentReportFilename,
  incidentsReport,
  incidentsReportFilename,
  reportPeriodOf,
  reportPeriodRange,
  reportPeriodTitle,
  reportRange,
  reportStatusCounts,
  type ReportIncident,
  type ReportRequest,
  type ReportTrailEntry,
} from "../src/lib/report";
import { richDocToStore } from "../src/lib/richDoc";
import { formatDate, formatDateTime } from "../src/lib/workshop";

/** Mediodía local del 8 de octubre de 2026: el huso no entra en juego. */
const ahora = new Date(2026, 9, 8, 12, 0, 0).getTime();
const dia = 24 * 60 * 60 * 1000;

/** Una incidencia cerrada y con expediente, como las de la muestra. */
const incidencia: ReportIncident = {
  reference: "INC-0038",
  reporterName: "Nuria Cano",
  reporterRole: "Servicios técnicos",
  location: "Plató 3",
  equipmentKind: "Foco LED de plató",
  model: "Gemini 2x1",
  serialNumber: "GEM-2404-6677",
  description:
    "El foco no mantiene la intensidad y se queda al 50 % a los pocos minutos.",
  reportedAt: ahora - 9 * dia,
  severity: "high",
  status: "resolved",
  assigneeName: "Paula Iglesias",
  workshopAssigneeName: "Iván Torres",
  closedAt: ahora - 2 * dia,
  notes: "Se sustituyó la fuente de alimentación y quedó estable en pruebas.",
  documents: [
    {
      name: "Presupuesto de reparación.pdf",
      note: "Adjuntado por el técnico al verificar la incidencia.",
      author: "Administración del taller",
      createdAt: ahora - 8 * dia,
    },
  ],
  lifecycleNotes: [
    {
      note: "Probado con carga durante dos horas sin fallos.",
      author: "Paula Iglesias",
      at: ahora - 3 * dia,
      editedAt: ahora - 3 * dia + 3600_000,
      // Corregir una nota guarda lo que decía antes: un parte con una nota
      // corregida siempre trae su historial.
      versions: [
        {
          note: "Probado con carga durante una hora sin fallos.",
          at: ahora - 3 * dia + 3600_000,
        },
      ],
    },
  ],
  history: [
    { status: "reported", at: ahora - 9 * dia, by: "Nuria Cano" },
    {
      status: "assigned",
      at: ahora - 8 * dia,
      by: "Paula Iglesias",
      note: "Autoasignada por el técnico.",
    },
    { status: "resolved", at: ahora - 2 * dia, by: "Paula Iglesias" },
  ],
};

/**
 * Una nota corregida dos veces: lo que decía la primera versión, lo que la
 * sustituyó y el texto que quedó, como los guarda el cuaderno.
 */
const notaCorregida = {
  note: "Probado con carga durante dos horas sin fallos.",
  author: "Paula Iglesias",
  at: ahora - 3 * dia,
  editedAt: ahora - 3 * dia + 3600_000,
  versions: [
    {
      note: "Probado con carga durante una hora.",
      at: ahora - 3 * dia + 3600_000,
    },
    { note: "Probado con carga durante dos horas.", at: ahora - 2 * dia },
  ],
};

/** El rastro de ese expediente: un alta, un renombrado y una retirada. */
const rastro: ReportTrailEntry[] = [
  {
    action: "attached",
    name: "Presupuesto de reparación.pdf",
    by: "Administración del taller",
    byId: "u1",
    incidentId: "i1",
    at: ahora - 8 * dia,
  },
  {
    action: "edited",
    name: "Presupuesto de reparación (revisado).pdf",
    previousName: "Presupuesto de reparación.pdf",
    by: "Administración del taller",
    byId: "u1",
    incidentId: "i1",
    at: ahora - 5 * dia,
  },
  {
    action: "removed",
    name: "Fotos del daño.jpg",
    by: "Elena Vidal",
    byId: "u2",
    incidentId: "i1",
    at: ahora - 4 * dia,
  },
];

const informe = (over: Partial<Parameters<typeof incidentReport>[0]> = {}) =>
  incidentReport({
    incident: incidencia,
    exportedBy: "Administración del taller",
    now: ahora,
    ...over,
  });

describe("cabecera del informe", () => {
  test("titula con la referencia y el equipo, y firma quién y cuándo lo saca", () => {
    const texto = informe();
    expect(
      texto.startsWith("# Incidencia INC-0038 · Foco LED de plató Gemini 2x1"),
    ).toBe(true);
    expect(texto).toContain(
      `Parte generado el ${formatDateTime(ahora)} por Administración del taller.`,
    );
  });

  test("resume el estado, la gravedad, la notificación y el cierre", () => {
    const texto = informe();
    expect(texto).toContain("- **Estado:** Resuelta — Cerrada con resolución");
    expect(texto).toContain("- **Gravedad:** Alta");
    expect(texto).toContain(
      `- **Notificada:** ${formatDateTime(ahora - 9 * dia)} por Nuria Cano (Servicios técnicos)`,
    );
    expect(texto).toContain("- **Ubicación:** Plató 3");
    expect(texto).toContain("- **Técnico:** Paula Iglesias");
    expect(texto).toContain("- **Entrada a taller:** Iván Torres");
    expect(texto).toContain(
      `- **Cerrada:** ${formatDateTime(ahora - 2 * dia)} · con resolución`,
    );
  });

  test("nombra el equipo del inventario cuando se le pasa", () => {
    expect(informe()).not.toContain("Equipo del inventario");
    // Si el inventario se llama igual que el equipo descrito, no se repite.
    const mismo = informe({ equipmentName: "Foco LED de plató Gemini 2x1" });
    expect(mismo).toContain("- **Equipo:** Foco LED de plató Gemini 2x1");
    expect(mismo).toContain(
      "- **Equipo del inventario:** el mismo del expediente",
    );
    // Y si tiene otro nombre, se dicen los dos.
    expect(informe({ equipmentName: "Foco LED Gemini 2x1" })).toContain(
      "- **Equipo del inventario:** Foco LED Gemini 2x1",
    );
  });

  test("deja claro que sin técnico la incidencia sigue sin asignar", () => {
    const nueva = informe({
      incident: {
        ...incidencia,
        status: "reported",
        assigneeName: undefined,
        workshopAssigneeName: undefined,
        closedAt: undefined,
        notes: undefined,
      },
    });
    expect(nueva).toContain("- **Técnico:** Sin asignar todavía");
    expect(nueva).not.toContain("- **Cerrada:**");
    expect(nueva).not.toContain("- **Entrada a taller:**");
  });
});

describe("secciones del informe", () => {
  test("lleva la avería tal cual se describió", () => {
    expect(informe()).toContain(
      "## Avería descrita\n\nEl foco no mantiene la intensidad y se queda al 50 % a los pocos minutos.",
    );
  });

  test("la avería descrita con formato conserva sus bloques en el parte", () => {
    // La descripción es un documento del editor: al parte va como Markdown, así
    // que sus listas y sus imágenes no se aplastan a un párrafo de texto.
    const description = richDocToStore(
      "<p>El foco <strong>no mantiene</strong> la intensidad.</p>" +
        "<ul><li>Probado en el plató 3</li></ul>" +
        '<img src="https://taller/foco.png" alt="foco">',
    )!;
    const texto = informe({ incident: { ...incidencia, description } });
    expect(texto).toContain(
      "## Avería descrita\n\nEl foco **no mantiene** la intensidad.",
    );
    expect(texto).toContain("- Probado en el plató 3");
    expect(texto).toContain("![foco](https://taller/foco.png)");
  });

  test("cuenta el historial de estados con quién hizo cada paso", () => {
    const texto = informe();
    expect(texto).toContain("## Historial de estados");
    expect(texto).toContain("| Fecha y hora | Estado | Quién | Nota |");
    expect(texto).toContain(
      `| ${formatDateTime(ahora - 8 * dia)} | Asignada | Paula Iglesias | Autoasignada por el técnico. |`,
    );
  });

  test("recoge el cuaderno con la firma de cada nota y su texto", () => {
    const texto = informe();
    expect(texto).toContain("## Notas del cuaderno de vida");
    // La firma abre la nota —cuándo, quién y si se corrigió— y debajo va lo que
    // dice, fuera de ninguna tabla.
    expect(texto).toContain(
      `**${formatDateTime(ahora - 3 * dia)} · Paula Iglesias** (corregida el ${formatDateTime(
        ahora - 3 * dia + 3600_000,
      )})`,
    );
    expect(texto).toContain(
      "\n\nProbado con carga durante dos horas sin fallos.",
    );
    const sinNotas = informe({
      incident: { ...incidencia, lifecycleNotes: undefined },
    });
    expect(sinNotas).toContain("_Todavía no hay notas en el ciclo de vida._");
  });

  test("una nota conserva sus negritas, su lista y su foto en el parte", () => {
    const note = richDocToStore(
      "<p>Fusible <strong>cambiado</strong>.</p>" +
        "<ul><li>sin fallos en carga</li><li>30 minutos de prueba</li></ul>" +
        '<img src="https://taller/foto.png" alt="fusible nuevo">',
    )!;
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [{ note, author: "Iván Torres", at: ahora - dia }],
      },
    });
    expect(texto).toContain(`**${formatDateTime(ahora - dia)} · Iván Torres**`);
    expect(texto).toContain("Fusible **cambiado**.");
    expect(texto).toContain("- sin fallos en carga\n- 30 minutos de prueba");
    expect(texto).toContain("![fusible nuevo](https://taller/foto.png)");
    // Y la nota no se ha aplastado dentro de una celda de tabla.
    expect(texto).not.toContain("| Fusible");
  });

  test("las notas que cambiaron llevan su propia sección de correcciones", () => {
    const texto = informe({
      incident: { ...incidencia, lifecycleNotes: [notaCorregida] },
    });
    // La sección se anuncia con la nota —autor y fecha del hilo— y con cuántas
    // correcciones lleva.
    expect(texto).toContain("## Correcciones de las notas");
    expect(texto).toContain(
      `**Nota de Paula Iglesias · ${formatDateTime(notaCorregida.at)}** — 2 correcciones`,
    );
    // Cada corrección: cuándo se sustituyó, qué cambió y el texto con lo que se
    // añadió en negrita y lo que se quitó tachado (el punto final no se toca).
    expect(texto).toContain(
      `- **${formatDateTime(notaCorregida.versions[1].at)}** · 2 palabras añadidas\n` +
        "  Probado con carga durante dos horas **sin fallos**.",
    );
    expect(texto).toContain(
      `- **${formatDateTime(notaCorregida.versions[0].at)}** · 2 palabras añadidas · 2 quitadas\n` +
        "  Probado con carga durante ~~una~~**dos** ~~hora~~**horas**.",
    );
    // De la corrección más reciente hacia atrás, como en la ficha.
    expect(
      texto.indexOf(formatDateTime(notaCorregida.versions[1].at)),
    ).toBeLessThan(texto.indexOf(formatDateTime(notaCorregida.versions[0].at)));
    // El marcado no se pega al hueco: `** texto**` no prende en Markdown.
    expect(texto).not.toContain("** sin fallos**");
  });

  test("una nota que se devolvió a una versión anterior lo dice, con quién y cuándo", () => {
    // La restauración queda anotada en la propia nota: quién la hizo, cuándo y
    // a qué versión se volvió.
    const restaurada = {
      ...notaCorregida,
      restoredAt: ahora - dia,
      restoredBy: "Paula Iglesias",
      // La versión restaurada, por su posición en el historial guardado.
      restoredVersion: 1,
    };
    const texto = informe({
      incident: { ...incidencia, lifecycleNotes: [restaurada] },
    });
    expect(texto).toContain(
      `**Nota de Paula Iglesias · ${formatDateTime(
        notaCorregida.at,
      )}** — 2 correcciones · restaurada por Paula Iglesias el ${formatDateTime(
        ahora - dia,
      )}`,
    );
    // Y la versión a la que se volvió se distingue de las demás.
    expect(texto).toContain(
      `- **${formatDateTime(
        notaCorregida.versions[1].at,
      )}** · 2 palabras añadidas · versión restaurada`,
    );
    // El resto no se toca: las otras correcciones se leen igual que siempre.
    expect(texto).toContain(
      `- **${formatDateTime(notaCorregida.versions[0].at)}** · 2 palabras añadidas · 2 quitadas`,
    );
  });

  test("una corrección que se llevó un bloque entero lo dice en el parte", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          {
            note: "Cambio de fusible.",
            author: "Iván Torres",
            at: ahora - 2 * dia,
            editedAt: ahora - dia,
            // La nota llevaba una lista que se quitó al corregirla.
            versions: [
              {
                note: "<p>Cambio de fusible.</p><ul><li>Probado 30 minutos</li></ul>",
                at: ahora - dia,
              },
            ],
          },
        ],
      },
    });
    expect(texto).toContain("· 3 quitadas · 1 bloque quitado");
  });

  test("cada nota corregida abre su bloque: la siguiente no se pierde", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          notaCorregida,
          {
            note: "Otra nota corregida.",
            author: "Iván Torres",
            at: ahora - 2 * dia,
            editedAt: ahora - dia,
            versions: [{ note: "Otra nota.", at: ahora - dia }],
          },
        ],
      },
    });
    // Entre el final de una nota y el título de la siguiente hay línea en
    // blanco: pegada a la viñeta, Markdown la leería como su continuación.
    expect(texto).toContain("**horas**.\n\n**Nota de Iván Torres");
  });

  test("las correcciones van donde el cuaderno: entre las notas y los documentos", () => {
    const texto = informe({
      incident: { ...incidencia, lifecycleNotes: [notaCorregida] },
    });
    const posiciones = [
      texto.indexOf("## Notas del cuaderno de vida"),
      texto.indexOf("## Correcciones de las notas"),
      texto.indexOf("## Documentos adjuntos"),
    ];
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  test("una corrección de varias líneas conserva los saltos dentro de su viñeta", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          {
            note: "Primera línea.\nSegunda línea corregida.",
            author: "Iván Torres",
            at: ahora - 2 * dia,
            editedAt: ahora - dia,
            versions: [
              { note: "Primera línea.\nSegunda línea.", at: ahora - dia },
            ],
          },
        ],
      },
    });
    // Las líneas de continuación van sangradas: si no, la viñeta se rompe.
    expect(texto).toContain(
      `- **${formatDateTime(ahora - dia)}** · 1 palabra añadida\n` +
        "  Primera línea.\n  Segunda línea **corregida**.",
    );
  });

  test("sin ninguna corrección la sección lo dice, en vez de quedarse en blanco", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          {
            note: "Nota sin corregir.",
            author: "Paula Iglesias",
            at: ahora - 3 * dia,
          },
        ],
      },
    });
    expect(texto).toContain("## Correcciones de las notas");
    expect(texto).toContain("_No se ha corregido ninguna nota del cuaderno._");
    // El otro extremo: sin cuaderno tampoco hay correcciones que contar.
    expect(
      informe({ incident: { ...incidencia, lifecycleNotes: undefined } }),
    ).toContain("_No se ha corregido ninguna nota del cuaderno._");
  });

  test("lo que alguien retiró del cuaderno no sale en el informe", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          ...(incidencia.lifecycleNotes ?? []),
          {
            note: "Anotación retirada por error.",
            author: "Paula Iglesias",
            at: ahora - 2 * dia,
            deletedAt: ahora - dia,
          },
        ],
      },
    });
    expect(texto).toContain("Probado con carga durante dos horas sin fallos.");
    expect(texto).not.toContain("Anotación retirada por error.");
    // Tampoco sus correcciones: una nota retirada sale del cuaderno entera.
    const conRetiradaCorregida = informe({
      incident: {
        ...incidencia,
        lifecycleNotes: [
          {
            note: "Retirada, con corrección.",
            author: "Paula Iglesias",
            at: ahora - 2 * dia,
            editedAt: ahora - dia,
            versions: [{ note: "Retirada, sin corregir.", at: ahora - dia }],
            deletedAt: ahora,
          },
        ],
      },
    });
    expect(conRetiradaCorregida).toContain(
      "_No se ha corregido ninguna nota del cuaderno._",
    );
    expect(conRetiradaCorregida).not.toContain("Retirada, con corrección.");
    // Con todas retiradas, el apartado lo dice en vez de quedarse en blanco.
    expect(
      informe({
        incident: {
          ...incidencia,
          lifecycleNotes: [
            {
              note: "Solo esta, retirada.",
              author: "Paula Iglesias",
              at: ahora,
              deletedAt: ahora,
            },
          ],
        },
      }),
    ).toContain("_Todavía no hay notas en el ciclo de vida._");
  });

  test("lista los documentos del expediente con quién los adjuntó", () => {
    const texto = informe();
    expect(texto).toContain("## Documentos adjuntos");
    expect(texto).toContain(
      `**${new Date(ahora - 8 * dia).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })} · Presupuesto de reparación.pdf** — Administración del taller`,
    );
    // La nota del documento es una nota más: va debajo, con su formato.
    expect(texto).toContain(
      "\n\nAdjuntado por el técnico al verificar la incidencia.",
    );
    expect(
      informe({ incident: { ...incidencia, documents: undefined } }),
    ).toContain("_No hay documentos en el expediente._");
  });

  test("la nota de un documento conserva su formato y su nombre no rompe nada", () => {
    const texto = informe({
      incident: {
        ...incidencia,
        documents: [
          {
            name: "Acta_final*.pdf",
            note: richDocToStore(
              "<p>Con <strong>negrita</strong> y <em>cursiva</em>.</p><ul><li>una línea</li></ul>",
            )!,
            author: "Administración del taller",
            createdAt: ahora,
          },
        ],
      },
    });
    // Las marcas de Markdown del nombre se neutralizan (si no, los guiones bajos
    // y el asterisco pondrían media línea en cursiva).
    expect(texto).toContain("Acta\\_final\\*.pdf");
    expect(texto).toContain("Con **negrita** y *cursiva*.");
    expect(texto).toContain("- una línea");
  });
});

describe("repuestos utilizados dentro del informe", () => {
  test("sin peticiones la sección dice que no se han utilizado repuestos", () => {
    const texto = informe({ requests: [] });
    expect(texto).toContain("## Repuestos utilizados");
    expect(texto).toContain("_No se han utilizado repuestos en esta incidencia._");
  });

  test("muestra los repuestos con código, cantidades pedidas y entregadas, y estado", () => {
    const requests: ReportRequest[] = [
      {
        reference: "PET-0001",
        status: "issued",
        priority: "urgent",
        requesterName: "Paula Iglesias",
        createdAt: ahora - 6 * dia,
        lines: [
          {
            code: "ALI-24015",
            name: "Fuente de alimentación 24 V 15 A",
            quantity: 1,
            deliveredQuantity: 1,
          },
          {
            code: "FUS-5X20-2A",
            name: "Fusible 5x20mm 2A",
            quantity: 2,
            deliveredQuantity: 2,
          },
        ],
      },
    ];
    const texto = informe({ requests });
    expect(texto).toContain("## Repuestos utilizados");
    expect(texto).toContain(
      "| Petición | Repuesto | Código | Pedido | Entregado | Estado |",
    );
    expect(texto).toContain(
      "| PET-0001 | Fuente de alimentación 24 V 15 A | ALI-24015 | 1 | 1 | Entregada |",
    );
    expect(texto).toContain(
      "| PET-0001 | Fusible 5x20mm 2A | FUS-5X20-2A | 2 | 2 | Entregada |",
    );
  });

  test("incluye el detalle de la petición si se describió material fuera de catálogo", () => {
    const requests: ReportRequest[] = [
      {
        reference: "PET-0002",
        status: "pending",
        priority: "normal",
        requesterName: "Iván Torres",
        createdAt: ahora - 3 * dia,
        description: "Cable bipolar de silicona 2x1.5mm para alta temperatura.",
      },
    ];
    const texto = informe({ requests });
    expect(texto).toContain("## Repuestos utilizados");
    expect(texto).toContain("**PET-0002 · Pendiente** — Iván Torres");
    expect(texto).toContain("Cable bipolar de silicona 2x1.5mm para alta temperatura.");
  });

  test("los repuestos van antes del historial de estados y del cuaderno de vida", () => {
    const requests: ReportRequest[] = [
      {
        reference: "PET-0001",
        status: "issued",
        createdAt: ahora - 5 * dia,
        lines: [
          {
            code: "ALI-24015",
            name: "Fuente de alimentación",
            quantity: 1,
          },
        ],
      },
    ];
    const texto = informe({ requests });
    const posRepuestos = texto.indexOf("## Repuestos utilizados");
    const posHistorial = texto.indexOf("## Historial de estados");
    const posCuaderno = texto.indexOf("## Notas del cuaderno de vida");
    expect(posRepuestos).toBeGreaterThan(0);
    expect(posRepuestos).toBeLessThan(posHistorial);
    expect(posHistorial).toBeLessThan(posCuaderno);
  });

  test("omite la sección si no se pasan requests", () => {
    const texto = informe();
    expect(texto).not.toContain("Repuestos utilizados");
  });

  test("el lote del periodo incluye los repuestos de cada incidencia", () => {
    const lote = incidentsReport({
      entries: [
        {
          incident: incidencia,
          requests: [
            {
              reference: "PET-0001",
              status: "issued",
              createdAt: ahora - 4 * dia,
              lines: [
                {
                  code: "ALI-24015",
                  name: "Fuente 24 V",
                  quantity: 1,
                  deliveredQuantity: 1,
                },
              ],
            },
          ],
        },
      ],
      range: { from: ahora - 10 * dia, to: ahora },
      basis: "reported",
      exportedBy: "Administración",
    });
    expect(lote).toContain("### Repuestos utilizados");
    expect(lote).toContain(
      "| PET-0001 | Fuente 24 V | ALI-24015 | 1 | 1 | Entregada |",
    );
  });
});

describe("rastro de auditoría dentro del informe", () => {
  test("remata el informe con el rastro, resumido y movimiento a movimiento", () => {
    const texto = informe({ trail: rastro });
    expect(texto).toContain("## Rastro de auditoría de documentos");
    expect(texto).toContain("3 movimientos · 1 alta · 1 edición · 1 retirada");
    expect(texto).toContain("| Fecha y hora | Movimiento | Quién |");
    // El mismo vocabulario que la ficha: alta, renombrado y retirada.
    expect(texto).toContain(
      `| ${formatDateTime(ahora - 8 * dia)} | Adjuntó «Presupuesto de reparación.pdf» | Administración del taller |`,
    );
    expect(texto).toContain(
      `| ${formatDateTime(ahora - 5 * dia)} | Renombró «Presupuesto de reparación.pdf» a «Presupuesto de reparación (revisado).pdf» | Administración del taller |`,
    );
    expect(texto).toContain(
      `| ${formatDateTime(ahora - 4 * dia)} | Quitó «Fotos del daño.jpg» | Elena Vidal |`,
    );
    expect(texto).toContain(
      "Un documento retirado ya no está en el expediente; su movimiento es la única constancia",
    );
  });

  test("el rastro va al final: después solo la procedencia del informe", () => {
    const texto = informe({ trail: rastro });
    const posiciones = [
      texto.indexOf("## Historial de estados"),
      texto.indexOf("## Notas del cuaderno"),
      texto.indexOf("## Documentos adjuntos"),
      texto.indexOf("## Rastro de auditoría"),
      texto.indexOf("Fuente: Pulso Taller"),
    ];
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  test("sin rastro (quien exporta no ve el expediente) la sección no existe", () => {
    const texto = informe();
    expect(texto).not.toContain("Rastro de auditoría");
    // El resto del informe sigue completo.
    expect(texto).toContain("## Documentos adjuntos");
  });

  test("un expediente sin movimientos lo dice, en vez de dejar un hueco", () => {
    expect(informe({ trail: [] })).toContain(
      "_Todavía no se ha movido ningún documento del expediente._",
    );
  });
});

describe("formato del archivo", () => {
  test("el nombre lleva la referencia y el día de la descarga", () => {
    expect(incidentReportFilename("INC-0038", ahora)).toBe(
      "parte-inc-0038-2026-10-08.md",
    );
    expect(incidentReportFilename(" INC/0007 ", ahora)).toBe(
      "parte-inc-0007-2026-10-08.md",
    );
  });

  test("es Markdown, termina en salto de línea y cierra sin huecos de más", () => {
    expect(REPORT_MIME).toBe("text/markdown;charset=utf-8");
    const texto = informe();
    expect(texto.endsWith("\n")).toBe(true);
    expect(texto).toContain(
      "---\n\nFuente: Pulso Taller · Repuestos de equipo audiovisual · INC-0038\n",
    );
  });

  test("las tablas que quedan escapan las barras y no rompen las filas", () => {
    // El cuaderno y las notas de los documentos ya no son tablas; las que
    // siguen (el historial de estados y el rastro) llevan texto de una línea y
    // siguen necesitando que la barra se escape y el salto se aplana.
    const texto = informe({
      incident: {
        ...incidencia,
        history: [
          ...incidencia.history,
          {
            status: "assigned",
            at: ahora,
            by: "Elena Vidal",
            note: "Repuesto | pendiente\nde presupuesto",
          },
        ],
      },
    });
    expect(texto).toContain("| Repuesto \\| pendiente de presupuesto |");
    // La fila sigue teniendo sus cinco separadores (la barra escapada no
    // cuenta como separador).
    const fila = texto
      .split("\n")
      .find((linea) => linea.includes("Repuesto \\| pendiente"));
    expect(fila?.match(/(?<!\\)\|/g)).toHaveLength(5);
  });

  test("dos informes del mismo instante son idénticos", () => {
    expect(informe({ trail: rastro })).toBe(informe({ trail: rastro }));
  });
});

/* ------------------------------------------------------------------ */
/* Lote de informes de un periodo                                      */
/* ------------------------------------------------------------------ */

const septiembre = reportPeriodRange("lastMonth", ahora);

/** Tres incidencias de septiembre: una nueva, una sin resolución y una resuelta. */
const nueva: ReportIncident = {
  ...incidencia,
  reference: "INC-0040",
  status: "reported",
  assigneeName: undefined,
  workshopAssigneeName: undefined,
  closedAt: undefined,
  notes: undefined,
  reportedAt: new Date(2026, 8, 3, 9, 0, 0).getTime(),
};
const sinResolver: ReportIncident = {
  ...incidencia,
  reference: "INC-0041",
  status: "unresolved",
  reportedAt: new Date(2026, 8, 12, 8, 0, 0).getTime(),
  closedAt: new Date(2026, 8, 20, 10, 0, 0).getTime(),
};
const resuelta: ReportIncident = {
  ...incidencia,
  reference: "INC-0042",
  status: "resolved",
  reportedAt: new Date(2026, 8, 25, 8, 0, 0).getTime(),
  closedAt: new Date(2026, 8, 29, 17, 0, 0).getTime(),
};
const septiembreCompleto = [nueva, sinResolver, resuelta];

const lote = (over: Partial<Parameters<typeof incidentsReport>[0]> = {}) =>
  incidentsReport({
    entries: septiembreCompleto.map((incident) => ({ incident })),
    range: septiembre,
    basis: "reported",
    exportedBy: "Administración del taller",
    now: ahora,
    ...over,
  });

describe("periodo del lote", () => {
  test("los atajos de mes empiezan el día 1 y cierran el mes entero", () => {
    expect(reportPeriodRange("thisMonth", ahora)).toEqual({
      from: new Date(2026, 9, 1, 0, 0, 0, 0).getTime(),
      to: new Date(2026, 9, 8, 23, 59, 59, 999).getTime(),
    });
    // El mes pasado va del día 1 a su último día, sin arrastrar nada de este.
    expect(septiembre).toEqual({
      from: new Date(2026, 8, 1, 0, 0, 0, 0).getTime(),
      to: new Date(2026, 8, 30, 23, 59, 59, 999).getTime(),
    });
    expect(reportPeriodRange("last30", ahora)).toEqual({
      from: new Date(2026, 8, 9, 0, 0, 0, 0).getTime(),
      to: new Date(2026, 9, 8, 23, 59, 59, 999).getTime(),
    });
    expect(reportPeriodRange("all", ahora)).toEqual({ from: null, to: null });
  });

  test("el atajo puesto se deduce del tramo y lo demás es un tramo a mano", () => {
    expect(reportPeriodOf(septiembre, ahora)).toBe("lastMonth");
    expect(reportPeriodOf(reportPeriodRange("thisMonth", ahora), ahora)).toBe(
      "thisMonth",
    );
    expect(reportPeriodOf({ from: null, to: null }, ahora)).toBe("all");
    expect(reportPeriodOf(reportRange("2026-09-01", "2026-09-15"), ahora)).toBe(
      "custom",
    );
  });

  test("las fechas escritas a mano se ordenan y el día final entra entero", () => {
    expect(reportRange("", "")).toEqual({ from: null, to: null });
    // Al revés: lo pedido es el tramo que va de una a otra, no uno vacío.
    expect(reportRange("2026-09-30", "2026-09-01")).toEqual({
      from: new Date(2026, 8, 1, 0, 0, 0, 0).getTime(),
      to: new Date(2026, 8, 30, 23, 59, 59, 999).getTime(),
    });
    expect(reportRange("2026-09-10", "2026-09-10").to).toBe(
      new Date(2026, 8, 10, 23, 59, 59, 999).getTime(),
    );
    // Una fecha imposible no amplía el periodo: se ignora.
    expect(reportRange("2026-02-31", "")).toEqual({ from: null, to: null });
    expect(reportRange("2026-09-30", "").to).toBeNull();
  });

  test("entra por notificación o por cierre, y sin cerrar solo por la primera", () => {
    expect(inReportPeriod(resuelta, septiembre, "reported")).toBe(true);
    expect(inReportPeriod(resuelta, septiembre, "closed")).toBe(true);
    expect(inReportPeriod(nueva, septiembre, "closed")).toBe(false);

    // Notificada en julio y cerrada en septiembre: entra por cierre.
    const arrastrada: ReportIncident = {
      ...resuelta,
      reportedAt: new Date(2026, 6, 15, 9, 0, 0).getTime(),
    };
    expect(inReportPeriod(arrastrada, septiembre, "reported")).toBe(false);
    expect(inReportPeriod(arrastrada, septiembre, "closed")).toBe(true);

    // Y fuera del tramo por las dos puertas, no entra.
    expect(
      inReportPeriod(
        arrastrada,
        reportRange("2026-10-01", "2026-10-31"),
        "reported",
      ),
    ).toBe(false);
    expect(
      inReportPeriod(arrastrada, { from: null, to: null }, "reported"),
    ).toBe(true);
  });
});

describe("lote de informes de un periodo", () => {
  test("titula con el mes, firma el lote y resume lo que entra", () => {
    const texto = lote();
    expect(
      texto.startsWith("# Informes de incidencias · septiembre de 2026"),
    ).toBe(true);
    expect(texto).toContain(
      `Lote generado el ${formatDateTime(ahora)} por Administración del taller.`,
    );
    expect(texto).toContain("- **Periodo:** Del 1 al 30 de septiembre de 2026");
    expect(texto).toContain("- **Entran por:** su fecha de notificación");
    expect(texto).toContain(
      "- **Incidencias:** 3 · 1 nueva · 1 resuelta · 1 sin resolución",
    );
  });

  test("el índice lista todas las incidencias, de la más antigua a la más nueva", () => {
    const texto = lote();
    expect(texto).toContain("## Índice");
    expect(texto).toContain(
      "| Referencia | Estado | Notificada | Cerrada | Técnico | Equipo |",
    );
    const referencias = texto
      .split("\n")
      .filter((linea) => /^\| INC-\d+/.test(linea))
      .map((linea) => linea.split("|")[1].trim());
    expect(referencias).toEqual(["INC-0040", "INC-0041", "INC-0042"]);
    // En el índice, la que sigue abierta no tiene fecha de cierre.
    expect(texto).toContain(
      `| INC-0040 | Nueva | ${formatDate(nueva.reportedAt)} |  |  | Foco LED de plató Gemini 2x1 |`,
    );
  });

  test("cada incidencia es un apartado con su informe entero, un nivel por debajo", () => {
    const texto = lote();
    expect(texto).toContain(
      "## Incidencia INC-0040 · Foco LED de plató Gemini 2x1",
    );
    expect(texto).toContain(
      "## Incidencia INC-0042 · Foco LED de plató Gemini 2x1",
    );
    // Los apartados de cada informe bajan un nivel: un archivo, un solo título.
    expect(texto).toContain("### Historial de estados");
    expect(texto).toContain("### Notas del cuaderno de vida");
    expect(texto).toContain("### Correcciones de las notas");
    expect(texto).toContain("### Documentos adjuntos");
    expect(texto).toContain("### Avería descrita");
    // El título suelto del informe de una incidencia no aparece suelto aquí.
    expect(texto).not.toContain("\n# Incidencia");
    // Y cada parte se cierra con su procedencia, como el informe suelto.
    expect(texto.split("Fuente: Pulso Taller").length - 1).toBe(
      septiembreCompleto.length,
    );
    // Cada parte abre con una raya y aire a los dos lados después del índice.
    expect(texto).toContain("---\n\n## Incidencia INC-0040");
    expect(texto).toContain("---\n\n## Incidencia INC-0041");
    expect(texto.split("\n---\n\n## Incidencia").length - 1).toBe(
      septiembreCompleto.length,
    );
  });

  test("el equipo del inventario entra en el índice y en cada informe", () => {
    const texto = lote({
      entries: [
        { incident: nueva, equipmentName: "Foco LED Gemini 2x1" },
        { incident: sinResolver },
      ],
    });
    expect(texto).toContain(
      `| INC-0040 | Nueva | ${formatDate(nueva.reportedAt)} |  |  | Foco LED Gemini 2x1 |`,
    );
    expect(texto).toContain("- **Equipo del inventario:** Foco LED Gemini 2x1");
  });

  test("el rastro de cada expediente va donde toca, y se calla si no se puede leer", () => {
    const conRastro = lote({
      entries: [
        { incident: nueva, trail: [] },
        { incident: resuelta, trail: rastro },
      ],
    });
    expect(conRastro).toContain("### Rastro de auditoría de documentos");
    expect(conRastro).toContain(
      "_Todavía no se ha movido ningún documento del expediente._",
    );
    expect(conRastro).toContain(
      "3 movimientos · 1 alta · 1 edición · 1 retirada",
    );

    // Sin rastro (quien exporta no lee el expediente) la sección no existe.
    expect(lote()).not.toContain("Rastro de auditoría");
  });

  test("un periodo sin incidencias sigue siendo un archivo entregable", () => {
    const texto = lote({
      entries: [],
      range: reportRange("2026-08-01", "2026-08-31"),
    });
    expect(texto.startsWith("# Informes de incidencias · agosto de 2026")).toBe(
      true,
    );
    expect(texto).toContain("- **Incidencias:** ninguna en este periodo");
    expect(texto).toContain("_No entró ninguna incidencia en este periodo._");
    expect(texto).toContain("Fuente: Pulso Taller");
    expect(texto.endsWith("\n")).toBe(true);
  });

  test("el mismo lote siempre sale igual, y termina en salto de línea", () => {
    expect(lote()).toBe(lote());
    expect(lote().endsWith("\n")).toBe(true);
    // El orden de entrada no cambia el archivo: manda la fecha de notificación.
    const alReves = lote({
      entries: [...septiembreCompleto]
        .reverse()
        .map((incident) => ({ incident })),
    });
    expect(alReves).toBe(lote());
  });
});

describe("formato del lote", () => {
  test("un mes natural nombra el archivo con su mes", () => {
    expect(incidentsReportFilename(septiembre, ahora)).toBe(
      "informes-2026-09.md",
    );
    expect(
      incidentsReportFilename(reportRange("2026-08-01", "2026-08-31"), ahora),
    ).toBe("informes-2026-08.md");
  });

  test("cualquier otro tramo lleva sus dos fechas, o el extremo que tenga", () => {
    expect(
      incidentsReportFilename(reportRange("2026-09-01", "2026-09-15"), ahora),
    ).toBe("informes-2026-09-01-a-2026-09-15.md");
    expect(incidentsReportFilename(reportRange("2026-09-01", ""), ahora)).toBe(
      "informes-desde-2026-09-01.md",
    );
    expect(incidentsReportFilename(reportRange("", "2026-09-30"), ahora)).toBe(
      "informes-hasta-2026-09-30.md",
    );
    expect(incidentsReportFilename({ from: null, to: null }, ahora)).toBe(
      "informes-todo-2026-10-08.md",
    );
  });

  test("el mes natural se titula con el mes y el resto con el tramo", () => {
    expect(reportPeriodTitle(septiembre, ahora)).toBe("septiembre de 2026");
    expect(
      reportPeriodTitle(reportRange("2026-09-01", "2026-09-15"), ahora),
    ).toBe("Del 1 al 15 de septiembre de 2026");
    expect(reportPeriodTitle(reportPeriodRange("last30", ahora), ahora)).toBe(
      "Últimos 30 días",
    );
    expect(reportPeriodTitle({ from: null, to: null }, ahora)).toBe(
      "todo el historial",
    );
    // El mes en curso no llega al día 30 por venir: se titula como tramo.
    expect(
      reportPeriodTitle(reportPeriodRange("thisMonth", ahora), ahora),
    ).toBe("Del 1 al 8 de octubre de 2026");
  });

  test("el desglose por estado se ordena por el flujo de trabajo", () => {
    expect(reportStatusCounts([])).toEqual([]);
    expect(reportStatusCounts([nueva])).toEqual(["1 nueva"]);
    expect(reportStatusCounts([resuelta, nueva, sinResolver, nueva])).toEqual([
      "2 nueva",
      "1 resuelta",
      "1 sin resolución",
    ]);
  });

  test("los atajos del diálogo son los cuatro que se esperan", () => {
    expect(REPORT_PERIODS.map((preset) => preset.label)).toEqual([
      "Este mes",
      "Mes pasado",
      "Últimos 30 días",
      "Todo",
    ]);
  });
});
