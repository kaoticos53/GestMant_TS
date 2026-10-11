import { describe, expect, test } from "vitest";
import {
  equipmentRecord,
  equipmentRecordPdfFilename,
  type EquipmentRecordInput,
  type EquipmentRecordIntervention,
  type EquipmentRecordRequest,
} from "../src/lib/equipmentRecord";
import { reportToPdf } from "../src/lib/reportPdf";
import { richDocToStore } from "../src/lib/richDoc";
import { formatDate, formatDateTime } from "../src/lib/workshop";

/** Mediodía local del 10 de octubre de 2026: el huso no entra en juego. */
const AHORA = new Date(2026, 9, 10, 12, 0, 0).getTime();
/** El mismo taller un par de años después: garantía caducada y revisión vencida. */
const DESPUES = new Date(2029, 5, 1, 12, 0, 0).getTime();
const DIA = 24 * 60 * 60 * 1000;

/** El equipo, tal y como lo pasa la ficha. */
const EQUIPO: EquipmentRecordInput = {
  code: "EQ-001",
  name: "Cámara de estudio",
  model: "HDC-3500",
  brand: "Sony",
  location: "Plató 1",
  serialNumber: "HDC3500-2505-0147",
  supplier: "Sony Professional",
  purchaseDate: new Date(2025, 4, 12).getTime(),
  warrantyEndDate: new Date(2028, 4, 12).getTime(),
  maintenanceIntervalDays: 180,
  description: richDocToStore(
    "<p>La cámara del plató 1 va con el objetivo de estudio montado.</p>" +
      "<ul><li>Antes de mover el cable, apagar la cámara.</li></ul>",
  ),
};

/** Los manuales de la ficha: uno de la unidad y otro del modelo. */
const MANUALES = {
  assigned: [
    {
      title: "Manual de servicio HDC-3500",
      kind: "file" as const,
      type: "Manual de servicio",
      brand: "Sony",
      model: "HDC-3500",
      fileName: "Manual-de-servicio-HDC-3500.pdf",
      size: 2483,
    },
  ],
  byModel: [
    {
      title: "Guía rápida de la cámara de estudio HDC-3500",
      kind: "file" as const,
      type: "Guía rápida",
      brand: "Sony",
      model: "HDC-3500",
      fileName: "HDC-3500-guia-rapida.pdf",
      size: 1024,
    },
  ],
};

/** Una avería con su nota y su petición, y una revisión sin nada de eso. */
const INTERVENCIONES: EquipmentRecordIntervention[] = [
  {
    kind: "preventive",
    title: "Revisión semestral del plan preventivo",
    performedAt: AHORA - 40 * DIA,
    technician: "Nuria Cano",
  },
  {
    kind: "repair",
    title: "Sustitución del cable de cámara",
    description: richDocToStore(
      "<p>El cable hacía falso contacto al mover la cámara.</p>" +
        "<ul><li>Se probó en directo antes de cerrar.</li></ul>",
    ),
    performedAt: AHORA - 5 * DIA,
    technician: "Iván Torres",
    requestReference: "PED-0042",
  },
];

/**
 * Dos peticiones del equipo: una entregada, con sus repuestos y su motivo, y
 * otra rechazada sin líneas de repuesto.
 */
const PETICIONES: EquipmentRecordRequest[] = [
  {
    reference: "PED-0042",
    status: "issued",
    priority: "urgent",
    requesterName: "Iván Torres",
    requesterTeam: "Realización",
    lines: [{ code: "REP-0007", name: "Cable de cámara", quantity: 2 }],
    description: richDocToStore(
      "<p>El cable de la cámara del plató 1 hace falso contacto.</p>",
    ),
    createdAt: AHORA - 6 * DIA,
  },
  {
    reference: "PED-0039",
    status: "rejected",
    priority: "low",
    requesterName: "Nuria Cano",
    createdAt: AHORA - 20 * DIA,
  },
];

/* ------------------------------------------------------------------ */
/* Leer el PDF que se acaba de componer                                */
/* ------------------------------------------------------------------ */

/** Un literal de cadena del PDF, de vuelta a texto (escape a escape). */
function decodeLiteral(value: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") {
      bytes.push(value.charCodeAt(index));
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(value.slice(index + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += octal[0].length;
      continue;
    }
    bytes.push(value.charCodeAt(index + 1));
    index += 1;
  }
  return bytes.map((byte) => String.fromCharCode(byte)).join("");
}

/**
 * Lo que el PDF dibuja, en orden. Basta para comprobar que lo compuesto llegó
 * al documento: aquí no se mira dónde quedó cada cosa, solo que está.
 */
function drawnText(bytes: Uint8Array): string {
  const pdf = Buffer.from(bytes).toString("latin1");
  return [...pdf.matchAll(/\(((?:\\.|[^\\()])*)\) Tj/g)]
    .map((match) => decodeLiteral(match[1]))
    .join("\n");
}

/* ------------------------------------------------------------------ */

describe("la ficha de un equipo como documento", () => {
  const record = equipmentRecord(EQUIPO, {
    manuals: MANUALES,
    interventions: INTERVENCIONES,
    now: AHORA,
  });

  test("lleva su título y su identificación, tal y como se lee en la ficha", () => {
    expect(record).toContain("# Cámara de estudio HDC-3500 (EQ-001)");
    expect(record).toContain("- **Marca y modelo:** Sony HDC-3500");
    expect(record).toContain("- **Nº de serie:** HDC3500-2505-0147");
    expect(record).toContain("- **Ubicación:** Plató 1");
    expect(record).toContain("- **Proveedor:** Sony Professional");
    expect(record).toContain(
      `- **Fecha de alta:** ${formatDate(EQUIPO.purchaseDate!)}`,
    );
    // Cuándo se generó: lo que hace que el papel se pueda fechar.
    expect(record).toContain(
      `Ficha del equipo generada el ${formatDateTime(AHORA)} desde el taller.`,
    );
  });

  test("dice si sigue en garantía, contando desde el día en que se genera", () => {
    expect(record).toContain(
      `- **Garantía:** En garantía hasta el ${formatDate(
        EQUIPO.warrantyEndDate!,
      )}`,
    );
    // El mismo equipo pasado su fin de garantía ya no lo está: la frase se
    // decide contra la fecha del documento, no contra el reloj de quien lo abre.
    const caducada = equipmentRecord(EQUIPO, { now: DESPUES });
    expect(caducada).toContain(
      `- **Garantía:** Garantía caducada el ${formatDate(
        EQUIPO.warrantyEndDate!,
      )}`,
    );
  });

  test("un equipo de baja lo dice, con su fecha", () => {
    const baja = equipmentRecord(
      { ...EQUIPO, decommissionDate: AHORA - 30 * DIA },
      { now: AHORA },
    );
    expect(baja).toContain(
      `- **Estado:** De baja desde el ${formatDate(AHORA - 30 * DIA)}`,
    );
    expect(record).toContain("- **Estado:** En servicio");
  });

  test("sin código, el título se queda con lo que se lee", () => {
    const sinCodigo = equipmentRecord(
      { ...EQUIPO, code: null },
      { now: AHORA },
    );
    expect(sinCodigo).toContain("# Cámara de estudio HDC-3500\n");
    expect(sinCodigo).not.toContain("(EQ-001)");
  });

  test("el plan preventivo dice cada cuánto toca y si está vencido", () => {
    // La última preventiva es de hace 40 días con un plan de 180: al día.
    expect(record).toContain(
      `- **Plan de mantenimiento:** cada 180 días · próxima revisión ${formatDate(
        INTERVENCIONES[0].performedAt + 180 * DIA,
      )} (al día)`,
    );
    // La misma ficha mirada más tarde: la revisión ya está vencida.
    const tarde = equipmentRecord(EQUIPO, {
      manuals: MANUALES,
      interventions: INTERVENCIONES,
      now: DESPUES,
    });
    expect(tarde).toContain("(vencida)");

    // Sin plan, y con plan pero sin ninguna revisión de la que contar: los dos
    // casos que la ficha también enseña.
    const sinPlan = equipmentRecord(
      { ...EQUIPO, maintenanceIntervalDays: null },
      { now: AHORA },
    );
    expect(sinPlan).toContain(
      "- **Plan de mantenimiento:** sin plan preventivo.",
    );
    const sinRevisiones = equipmentRecord(
      { ...EQUIPO, purchaseDate: null },
      { now: AHORA },
    );
    expect(sinRevisiones).toContain(
      "- **Plan de mantenimiento:** cada 180 días · sin primera revisión registrada",
    );
  });

  test("la nota del taller va con su formato, y sin nota lo dice", () => {
    expect(record).toContain(
      "La cámara del plató 1 va con el objetivo de estudio montado.",
    );
    expect(record).toContain("- Antes de mover el cable, apagar la cámara.");
    const sinNota = equipmentRecord(
      { ...EQUIPO, description: undefined },
      { now: AHORA },
    );
    expect(sinNota).toContain("Este equipo no lleva descripción.");
  });

  test("los manuales van separados: los de la unidad y los del modelo", () => {
    expect(record).toContain("## Manuales");
    expect(record).toContain("### Asignados a esta unidad");
    expect(record).toContain(
      "- **Manual de servicio HDC-3500** · Manual de servicio · Archivo · Manual-de-servicio-HDC-3500.pdf (2 KB) · Sony HDC-3500",
    );
    expect(record).toContain("### Del modelo");
    expect(record).toContain(
      "- **Guía rápida de la cámara de estudio HDC-3500** · Guía rápida · Archivo · HDC-3500-guia-rapida.pdf (1 KB) · Sony HDC-3500",
    );
    expect(record).toContain(
      "Los manuales del modelo valen para cualquier equipo de ese modelo, no solo para este.",
    );
  });

  test("una nota del taller se cita como nota, y sin archivo lo avisa", () => {
    const otros = equipmentRecord(EQUIPO, {
      manuals: {
        assigned: [
          {
            title: "Ajuste de color del panel",
            kind: "note",
            type: "Procedimiento interno",
          },
          {
            title: "Manual de usuario sin archivo",
            kind: "file",
            type: "Manual de usuario",
            fileName: null,
          },
        ],
        byModel: [],
      },
      now: AHORA,
    });
    expect(otros).toContain(
      "- **Ajuste de color del panel** · Procedimiento interno · Nota del taller",
    );
    expect(otros).not.toContain("Nota del taller ·");
    expect(otros).toContain(
      "- **Manual de usuario sin archivo** · Manual de usuario · Archivo · archivo ya no disponible en el almacén",
    );
  });

  test("sin manuales lo dice, sin dejar el apartado vacío", () => {
    const sinManuales = equipmentRecord(EQUIPO, { now: AHORA });
    expect(sinManuales).toContain("## Manuales");
    expect(sinManuales).toContain("Este equipo no tiene manuales.");
    expect(sinManuales).not.toContain("### ");
  });

  test("el historial va de la última intervención atrás, con su técnico y su petición", () => {
    expect(record).toContain("## Historial de intervenciones");
    expect(record).toContain(
      "| Fecha | Tipo | Intervención | Técnico | Petición |",
    );
    expect(record).toContain(
      `| ${formatDate(INTERVENCIONES[1].performedAt)} | Avería | Sustitución del cable de cámara | Iván Torres | Petición PED-0042 |`,
    );
    expect(record).toContain(
      `| ${formatDate(INTERVENCIONES[0].performedAt)} | Preventivo | Revisión semestral del plan preventivo | Nuria Cano | — |`,
    );
    const ultima = record.indexOf("Sustitución del cable de cámara");
    const revision = record.indexOf("Revisión semestral del plan preventivo");
    expect(ultima).toBeGreaterThan(-1);
    expect(revision).toBeGreaterThan(ultima);
  });

  test("las notas de las intervenciones van aparte, con su formato", () => {
    expect(record).toContain("### Notas de las intervenciones");
    expect(record).toContain(
      `**${formatDate(INTERVENCIONES[1].performedAt)} · Avería · Sustitución del cable de cámara**`,
    );
    expect(record).toContain(
      "El cable hacía falso contacto al mover la cámara.",
    );
    expect(record).toContain("- Se probó en directo antes de cerrar.");
    // La revisión no lleva nota: no se cuela en el apartado de las notas.
    const notas = record.slice(
      record.indexOf("### Notas de las intervenciones"),
    );
    expect(notas).not.toContain("Revisión semestral del plan preventivo");
  });

  test("sin intervenciones lo dice", () => {
    const sinHistorial = equipmentRecord(EQUIPO, {
      manuals: MANUALES,
      now: AHORA,
    });
    expect(sinHistorial).toContain("Sin intervenciones registradas.");
    expect(sinHistorial).not.toContain("| Fecha | Tipo |");
  });

  test("las peticiones van con su estado, su prioridad y quién las pidió", () => {
    const conPeticiones = equipmentRecord(EQUIPO, {
      interventions: INTERVENCIONES,
      requests: PETICIONES,
      now: AHORA,
    });
    expect(conPeticiones).toContain("## Peticiones");
    expect(conPeticiones).toContain(
      "| Fecha | Petición | Estado | Prioridad | Solicitante |",
    );
    expect(conPeticiones).toContain(
      `| ${formatDate(PETICIONES[0].createdAt)} | PED-0042 | Entregada | Urgente | Iván Torres · Realización |`,
    );
    expect(conPeticiones).toContain(
      `| ${formatDate(PETICIONES[1].createdAt)} | PED-0039 | Rechazada | Baja | Nuria Cano |`,
    );
    // De la última a la primera, como en la cola: lo que sigue en marcha arriba.
    const peticiones = conPeticiones.slice(
      conPeticiones.indexOf("## Peticiones"),
    );
    expect(peticiones.indexOf("PED-0042")).toBeLessThan(
      peticiones.indexOf("PED-0039"),
    );
  });

  test("el repuesto pedido y lo que contó quien pide van con su petición", () => {
    const conPeticiones = equipmentRecord(EQUIPO, {
      requests: PETICIONES,
      now: AHORA,
    });
    expect(conPeticiones).toContain("### Qué se pide");
    expect(conPeticiones).toContain("**PED-0042 · Entregada**");
    expect(conPeticiones).toContain("- REP-0007 Cable de cámara x2");
    expect(conPeticiones).toContain(
      "El cable de la cámara del plató 1 hace falso contacto.",
    );
    // La que no pide nada y no trae texto no se cuela en ese apartado.
    const detalle = conPeticiones.slice(
      conPeticiones.indexOf("### Qué se pide"),
    );
    expect(detalle).not.toContain("PED-0039");
  });

  test("sin peticiones lo dice, sin dejar una tabla vacía", () => {
    const sinPeticiones = equipmentRecord(EQUIPO, {
      manuals: MANUALES,
      now: AHORA,
    });
    expect(sinPeticiones).toContain("## Peticiones");
    expect(sinPeticiones).toContain(
      "Este equipo no tiene peticiones registradas.",
    );
    expect(sinPeticiones).not.toContain("| Fecha | Petición |");
    expect(sinPeticiones).not.toContain("### Qué se pide");
  });
});

describe("el nombre del documento de un equipo", () => {
  test("lleva el equipo y el día, para que dos descargas no se pisen", () => {
    expect(
      equipmentRecordPdfFilename("Cámara de estudio HDC-3500", AHORA),
    ).toBe("ficha-equipo-camara-de-estudio-hdc-3500-2026-10-10.pdf");
  });

  test("un nombre largo se corta sin dejar un guion suelto", () => {
    const largo = equipmentRecordPdfFilename(
      "Conmutador de red 10 GbE del rack central de realización del taller",
      AHORA,
    );
    expect(largo.startsWith("ficha-equipo-conmutador-de-red-10-gbe")).toBe(
      true,
    );
    expect(largo.endsWith("-2026-10-10.pdf")).toBe(true);
    expect(largo).not.toContain("--");
  });

  test("sin nombre que sirva, el documento se llama «equipo»", () => {
    expect(equipmentRecordPdfFilename("   ", AHORA)).toBe(
      "ficha-equipo-equipo-2026-10-10.pdf",
    );
  });
});

describe("la ficha del equipo compuesta en PDF", () => {
  test("el documento sale en hojas A4 con lo que dice la ficha", async () => {
    const bytes = await reportToPdf(
      equipmentRecord(EQUIPO, {
        manuals: MANUALES,
        interventions: INTERVENCIONES,
        requests: PETICIONES,
        now: AHORA,
      }),
      {
        footer: "Ficha del equipo «Cámara de estudio HDC-3500» · Pulso Taller",
      },
    );

    // Un PDF de verdad: cabecera y contenido escrito dentro.
    expect(Buffer.from(bytes.slice(0, 8)).toString("latin1")).toBe("%PDF-1.4");
    const texto = drawnText(bytes);
    expect(texto).toContain("Cámara de estudio HDC-3500 (EQ-001)");
    expect(texto).toContain("Manuales");
    expect(texto).toContain("Historial de intervenciones");
    expect(texto).toContain("Peticiones");
    // El expediente de peticiones llega con su referencia y lo que se pidió.
    expect(texto).toContain("PED-0042");
    expect(texto).toContain("REP-0007 Cable de cámara x2");
    // Los títulos de los manuales llegan enteros: es lo que permite cotejarlos
    // con los que se abren desde la ficha.
    expect(texto).toContain("Manual-de-servicio-HDC-3500.pdf");
    expect(texto).toContain("Sustitución del cable de cámara");
    // Y el pie, que es lo que hace que las hojas sueltas se puedan ordenar.
    expect(texto).toContain("Ficha del equipo «Cámara de estudio HDC-3500»");
  });
});
