import { describe, expect, test } from "vitest";
import {
  manualRecord,
  manualRecordPdfFilename,
  type ManualRecordInput,
} from "../src/lib/manualRecord";
import { reportToPdf } from "../src/lib/reportPdf";
import { richDocToStore } from "../src/lib/richDoc";
import { formatDateTime } from "../src/lib/workshop";

/** Mediodía local del 10 de octubre de 2026: el huso no entra en juego. */
const AHORA = new Date(2026, 9, 10, 12, 0, 0).getTime();
const DIA = 24 * 60 * 60 * 1000;

/** El equipo, tal y como lo pasa la ficha: con su nombre visible. */
const EQUIPO = "Cámara de estudio HDC-3500";

/** Un manual de archivo con una versión anterior y una corrección después. */
const MANUAL: ManualRecordInput = {
  title: "Manual de servicio HDC-3500",
  kind: "file",
  type: "Manual de servicio",
  brand: "Sony",
  model: "HDC-3500",
  fileName: "Manual-de-servicio-HDC-3500.pdf",
  size: 2483,
  author: "Elena Vidal",
  createdAt: AHORA - 30 * DIA,
  updatedAt: AHORA - 5 * DIA,
  history: [
    { at: AHORA - 30 * DIA, action: "created", by: "Elena Vidal" },
    {
      at: AHORA - 15 * DIA,
      action: "fileReplaced",
      by: "Elena Vidal",
      fields: ["title"],
      file: {
        storageId: "s1",
        fileName: "Manual-de-servicio-HDC-3500-v1.pdf",
        size: 1200,
      },
    },
    {
      at: AHORA - 5 * DIA,
      action: "edited",
      by: "Nuria Cano",
      fields: ["notes"],
    },
  ],
};

/** Una nota del taller suelta: sin equipo, sin marca y sin modelo. */
const NOTA: ManualRecordInput = {
  title: "Inventario de cables y latiguillos del rack",
  kind: "note",
  type: "Procedimiento interno",
  notes: richDocToStore(
    "<p>Los latiguillos del rack se revisan una vez al año.</p>" +
      "<ul><li>Se etiqueta cada uno con su longitud.</li></ul>",
  ),
  author: "Elena Vidal",
  createdAt: AHORA - 5 * DIA,
  updatedAt: AHORA - 5 * DIA,
  history: [{ at: AHORA - 5 * DIA, action: "created", by: "Elena Vidal" }],
};

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

describe("la ficha de un manual como documento", () => {
  const record = manualRecord(MANUAL, {
    equipmentName: EQUIPO,
    now: AHORA,
  });

  test("lleva su título y su clasificación, tal y como se lee en la ficha", () => {
    expect(record).toContain("# Manual de servicio HDC-3500");
    expect(record).toContain("| Forma | Archivo |");
    expect(record).toContain("| Tipo | Manual de servicio |");
    expect(record).toContain("| Marca | Sony |");
    expect(record).toContain("| Modelo | HDC-3500 |");
    expect(record).toContain(`| Equipo | ${EQUIPO} |`);
    expect(record).toContain("| Autor de la ficha | Elena Vidal |");
    expect(record).toContain(`| Alta | ${formatDateTime(MANUAL.createdAt)} |`);
    expect(record).toContain(
      `| Última modificación | ${formatDateTime(MANUAL.updatedAt)} |`,
    );
    // Cuándo se generó: lo que hace que el papel se pueda fechar.
    expect(record).toContain(
      `Ficha del manual generada el ${formatDateTime(AHORA)} desde el taller.`,
    );
  });

  test("nombra el archivo en uso con su tamaño", () => {
    expect(record).toContain(
      "- **Archivo en uso:** Manual-de-servicio-HDC-3500.pdf (2 KB)",
    );
  });

  test("las versiones anteriores van numeradas, con su tamaño y su fecha", () => {
    expect(record).toContain(
      `- **v1** · Manual-de-servicio-HDC-3500-v1.pdf (1 KB) · sustituida el ${formatDateTime(
        AHORA - 15 * DIA,
      )} por Elena Vidal`,
    );
    expect(record).toContain(
      "Las versiones anteriores se siguen descargando desde la ficha del manual.",
    );
  });

  test("con dos versiones, la más reciente va primero y se numera después", () => {
    // Van en lista y no en tabla: el nombre de un archivo es una palabra larga
    // sin espacios y en una columna estrecha se partiría por la mitad.
    const dos = manualRecord(
      {
        ...MANUAL,
        history: [
          ...(MANUAL.history ?? []),
          {
            at: AHORA - 2 * DIA,
            action: "fileReplaced",
            by: "Nuria Cano",
            file: {
              storageId: "s2",
              fileName: "Manual-de-servicio-HDC-3500-v2.pdf",
              size: 2400,
            },
          },
        ],
      },
      { now: AHORA },
    );
    const v2 = dos.indexOf("- **v2** · Manual-de-servicio-HDC-3500-v2.pdf");
    const v1 = dos.indexOf("- **v1** · Manual-de-servicio-HDC-3500-v1.pdf");
    expect(v2).toBeGreaterThan(-1);
    expect(v1).toBeGreaterThan(v2);
  });

  test("el historial va del último movimiento atrás", () => {
    expect(record).toContain("Se subió el archivo del manual");
    expect(record).toContain("Se sustituyó el archivo y cambió: Título");
    expect(record).toContain("Cambió: Nota");
    const corregido = record.indexOf(
      `| ${formatDateTime(AHORA - 5 * DIA)} | Cambió: Nota | Nuria Cano |`,
    );
    const alta = record.indexOf("Se subió el archivo del manual");
    expect(corregido).toBeGreaterThan(-1);
    expect(alta).toBeGreaterThan(corregido);
  });

  test("una nota suelta se cuenta como tal, sin equipo y con su texto", () => {
    const nota = manualRecord(NOTA, { now: AHORA });
    expect(nota).toContain("| Forma | Nota del taller |");
    expect(nota).toContain("| Equipo | Sin equipo asignado |");
    expect(nota).toContain("| Marca | — |");
    expect(nota).toContain("| Modelo | — |");
    expect(nota).toContain(
      "Es una nota del taller: su contenido es el apartado siguiente.",
    );
    // La nota va con su formato, no aplanada.
    expect(nota).toContain(
      "Los latiguillos del rack se revisan una vez al año.",
    );
    expect(nota).toContain("- Se etiqueta cada uno con su longitud.");
    expect(nota).toContain(
      "El archivo de este manual no se ha sustituido: no hay versiones anteriores.",
    );
  });

  test("un manual del modelo lo dice, y uno sin nota también", () => {
    const delModelo = manualRecord(MANUAL, { now: AHORA });
    expect(delModelo).toContain(
      "| Equipo | Del modelo: vale para cualquier equipo Sony HDC-3500 |",
    );
    expect(delModelo).toContain("Este manual no lleva nota del taller.");
  });

  test("un manual de marca sin modelo no se dice de ningún equipo", () => {
    const deMarca = manualRecord({ ...MANUAL, model: null }, { now: AHORA });
    expect(deMarca).toContain(
      "| Equipo | De la marca, sin modelo: no cuelga de ningún equipo |",
    );
  });

  test("un manual de archivo sin archivo en el almacén lo avisa", () => {
    const huerfano = manualRecord(
      { ...MANUAL, fileName: null, size: null },
      { now: AHORA },
    );
    expect(huerfano).toContain(
      "El archivo de este manual ya no está en el almacén del taller.",
    );
  });
});

describe("el nombre del documento", () => {
  test("lleva el título en minúsculas, sin acentos, y la fecha", () => {
    expect(manualRecordPdfFilename("Manual de servicio HDC-3500", AHORA)).toBe(
      "ficha-manual-manual-de-servicio-hdc-3500-2026-10-10.pdf",
    );
    expect(
      manualRecordPdfFilename("Guía rápida de la cámara PXW-Z280", AHORA),
    ).toBe("ficha-manual-guia-rapida-de-la-camara-pxw-z280-2026-10-10.pdf");
  });

  test("un título largo se corta sin dejar un guion suelto", () => {
    const largo = manualRecordPdfFilename(
      "Procedimiento interno de comprobación de la sincronía de todas las entradas del router",
      AHORA,
    );
    expect(
      largo.startsWith("ficha-manual-procedimiento-interno-de-comprobacion"),
    ).toBe(true);
    expect(largo.endsWith("-2026-10-10.pdf")).toBe(true);
    expect(largo).not.toContain("--");
  });

  test("sin título que sirva, el documento se llama «manual»", () => {
    expect(manualRecordPdfFilename("   ", AHORA)).toBe(
      "ficha-manual-manual-2026-10-10.pdf",
    );
  });
});

describe("la ficha compuesta en PDF", () => {
  test("el documento sale en hojas A4 con lo que dice la ficha", async () => {
    const bytes = await reportToPdf(
      manualRecord(MANUAL, { equipmentName: EQUIPO, now: AHORA }),
      {
        footer: "Ficha del manual «Manual de servicio HDC-3500» · Pulso Taller",
      },
    );

    // Un PDF de verdad: cabecera y contenido escrito dentro.
    expect(Buffer.from(bytes.slice(0, 8)).toString("latin1")).toBe("%PDF-1.4");
    const texto = drawnText(bytes);
    expect(texto).toContain("Manual de servicio HDC-3500");
    expect(texto).toContain("Versiones anteriores del archivo");
    expect(texto).toContain("Historial de cambios");
    // El nombre de la versión llega entero: es lo que permite cotejarlo con el
    // archivo que se descarga desde la ficha.
    expect(texto).toContain("Manual-de-servicio-HDC-3500-v1.pdf");
    // Y el pie, que es lo que hace que las hojas sueltas se puedan ordenar.
    expect(texto).toContain("Ficha del manual «Manual de servicio HDC-3500»");
  });
});
