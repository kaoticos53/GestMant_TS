import { describe, expect, test } from "vitest";
import { A4 } from "../src/lib/pdf";
import {
  helveticaMeasure,
  parseReportInline,
  parseReportMarkdown,
  reportToPdf,
  type PdfLoadImage,
} from "../src/lib/reportPdf";
import {
  incidentReport,
  type ReportIncident,
  type ReportTrailEntry,
} from "../src/lib/report";
import { richDocToStore } from "../src/lib/richDoc";

/** Mediodía local del 8 de octubre de 2026: el huso no entra en juego. */
const ahora = new Date(2026, 9, 8, 12, 0, 0).getTime();
const dia = 24 * 60 * 60 * 1000;

/** Los márgenes que declara el maquetador (la caja de texto del papel). */
const MARGEN = { left: 56, right: 56 };

/* ------------------------------------------------------------------ */
/* Leer el PDF que se acaba de componer                                */
/* ------------------------------------------------------------------ */

/** La vuelta a WinAnsi: los bytes 0x80-0x9F que no coinciden con Latin-1. */
const WIN_ANSI_BACK: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

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
  return bytes
    .map((byte) => WIN_ANSI_BACK[byte] ?? String.fromCharCode(byte))
    .join("");
}

/** Un texto dibujado: en qué hoja, con qué tipografía, dónde y qué dice. */
interface DrawnText {
  page: number;
  font: "regular" | "bold" | "italic" | "boldItalic" | "mono";
  size: number;
  x: number;
  /** Distancia desde el borde superior de la hoja. */
  top: number;
  text: string;
}

const FONT_BY_REFERENCE: Record<string, DrawnText["font"]> = {
  F1: "regular",
  F2: "bold",
  F3: "italic",
  F4: "boldItalic",
  F5: "mono",
};

/**
 * Los flujos de contenido del archivo, uno por hoja y en orden. Al componer se
 * escriben antes que las fuentes y las imágenes, así que los primeros son los
 * de las hojas.
 */
function pageStreams(pdf: string): string[] {
  const pages = (pdf.match(/\/Type \/Page[^s]/g) ?? []).length;
  const streams: string[] = [];
  const pattern = /\/Length (\d+) >>\nstream\n/g;
  let match = pattern.exec(pdf);
  while (match !== null && streams.length < pages) {
    const start = match.index + match[0].length;
    streams.push(pdf.slice(start, start + Number(match[1])));
    match = pattern.exec(pdf);
  }
  return streams;
}

/** Todo lo que el archivo escribe, tal y como lo escribió. */
function drawnText(bytes: Uint8Array): DrawnText[] {
  const pdf = Buffer.from(bytes).toString("latin1");
  const drawn: DrawnText[] = [];
  pageStreams(pdf).forEach((stream, page) => {
    const op =
      /BT \/(F\d) ([\d.]+) Tf [\d. ]+rg ([\d.-]+) ([\d.-]+) Td \(((?:\\.|[^\\()])*)\) Tj ET/g;
    for (const match of stream.matchAll(op)) {
      drawn.push({
        page,
        font: FONT_BY_REFERENCE[match[1]],
        size: Number(match[2]),
        x: Number(match[3]),
        top: A4.height - Number(match[4]),
        text: decodeLiteral(match[5]),
      });
    }
  });
  return drawn;
}

/* ------------------------------------------------------------------ */
/* Una incidencia con nota con formato                                 */
/* ------------------------------------------------------------------ */

const notaConFormato =
  richDocToStore(
    "<p>Probado con <strong>carga durante dos horas</strong> sin fallos.</p>" +
      "<ul><li>Sin fallos</li><li>Estable</li></ul>",
  ) ?? "";

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
  status: "resolved",
  assigneeName: "Paula Iglesias",
  closedAt: ahora - 2 * dia,
  lifecycleNotes: [
    { note: notaConFormato, author: "Paula Iglesias", at: ahora - 3 * dia },
  ],
  history: [
    { status: "reported", at: ahora - 9 * dia, by: "Nuria Cano" },
    { status: "resolved", at: ahora - 2 * dia, by: "Paula Iglesias" },
  ],
};

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
    action: "removed",
    name: "Fotos del daño.jpg",
    by: "Elena Vidal",
    byId: "u2",
    incidentId: "i1",
    at: ahora - 4 * dia,
  },
];

const informe = () =>
  incidentReport({
    incident: incidencia,
    trail: rastro,
    exportedBy: "Administración del taller",
    now: ahora,
  });

/* ------------------------------------------------------------------ */
/* Del Markdown a los bloques                                          */
/* ------------------------------------------------------------------ */

describe("del Markdown del parte a sus bloques", () => {
  test("reconoce títulos, párrafos, tablas, listas, citas, imágenes y reglas", () => {
    const blocks = parseReportMarkdown(
      [
        "# Incidencia INC-0038 · Foco LED",
        "",
        "Parte generado el 8 de octubre de 2026 por Administración.",
        "",
        "## Historial de estados",
        "",
        "| Fecha y hora | Estado | Quién |",
        "| --- | --- | --- |",
        "| 29 sept 2026, 12:00 | Nueva | Nuria Cano |",
        "",
        "- **Estado:** Resuelta",
        "  - sin resolución aplicable",
        "",
        "> Una nota citada del cuaderno.",
        "",
        "![foto del daño](https://taller/foto.png)",
        "",
        "---",
        "",
        "Fuente: Pulso Taller · Repuestos de equipo audiovisual · INC-0038",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Incidencia INC-0038 · Foco LED" },
      {
        type: "paragraph",
        text: "Parte generado el 8 de octubre de 2026 por Administración.",
      },
      { type: "heading", level: 2, text: "Historial de estados" },
      {
        type: "table",
        header: ["Fecha y hora", "Estado", "Quién"],
        rows: [["29 sept 2026, 12:00", "Nueva", "Nuria Cano"]],
      },
      { type: "item", marker: "•", text: "**Estado:** Resuelta", depth: 0 },
      { type: "item", marker: "•", text: "sin resolución aplicable", depth: 1 },
      { type: "quote", text: "Una nota citada del cuaderno." },
      { type: "image", src: "https://taller/foto.png", alt: "foto del daño" },
      { type: "rule" },
      {
        type: "paragraph",
        text: "Fuente: Pulso Taller · Repuestos de equipo audiovisual · INC-0038",
      },
    ]);
  });

  test("una barra escapada no parte la fila y un salto se aplana", () => {
    const [tabla] = parseReportMarkdown(
      [
        "| Fecha | Nota |",
        "| --- | --- |",
        "| hoy | Repuesto \\| pendiente |",
      ].join("\n"),
    );
    expect(tabla).toEqual({
      type: "table",
      header: ["Fecha", "Nota"],
      rows: [["hoy", "Repuesto | pendiente"]],
    });
  });

  test("un punto lleva sus continuaciones y su lista anidada", () => {
    // Es lo que escribe el informe con el diff de una nota corregida: la
    // continuación va sangrada y el punto anidado, más todavía.
    const blocks = parseReportMarkdown(
      [
        "- **29 sept 2026, 12:00** · se añadió un párrafo",
        "  Probado con carga durante dos horas.",
        "  - Un detalle anidado",
        "",
        "- **28 sept 2026, 10:00** · se corrigió una frase",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      {
        type: "item",
        marker: "•",
        text: "**29 sept 2026, 12:00** · se añadió un párrafo Probado con carga durante dos horas.",
        depth: 0,
      },
      { type: "item", marker: "•", text: "Un detalle anidado", depth: 1 },
      {
        type: "item",
        marker: "•",
        text: "**28 sept 2026, 10:00** · se corrigió una frase",
        depth: 0,
      },
    ]);
  });

  test("las marcas de dentro del texto se leen pieza a pieza", () => {
    expect(
      parseReportInline(
        "**Negrita** y *cursiva* y `código` y ~~tachado~~ y [enlace](https://taller/x)",
      ),
    ).toEqual([
      { text: "Negrita", font: "bold" },
      { text: " y ", font: "regular" },
      { text: "cursiva", font: "italic" },
      { text: " y ", font: "regular" },
      { text: "código", font: "mono" },
      { text: " y ", font: "regular" },
      { text: "tachado", font: "regular", strike: true },
      { text: " y ", font: "regular" },
      { text: "enlace", font: "regular", link: true },
    ]);
  });

  test("la barra devuelve el carácter que el informe escapó", () => {
    // El nombre de un archivo con guiones bajos y asteriscos llega escapado: en
    // el papel tiene que leerse tal cual, sin las barras.
    expect(parseReportInline("Acta\\_final\\*.pdf")).toEqual([
      { text: "Acta_final*.pdf", font: "regular" },
    ]);
  });

  test("una marca sin cerrar se lee tal cual, sin comerse el texto", () => {
    expect(parseReportInline("50 % * 2 = 100")).toEqual([
      { text: "50 % * 2 = 100", font: "regular" },
    ]);
  });
});

describe("la medida del texto", () => {
  // El parte se coloca con los anchos de Helvetica que declara el archivo, no
  // con los del sistema: si la medida no es la de la letra que se dibuja, la
  // palabra siguiente se echa encima de la anterior.
  test("mide en milésimas de em: la M negrita mide 833, el espacio 278", () => {
    expect(helveticaMeasure("M", "bold", 1000)).toBe(833);
    expect(helveticaMeasure("M", "regular", 1000)).toBe(833);
    expect(helveticaMeasure("A", "bold", 1000)).toBe(722);
    expect(helveticaMeasure("A", "regular", 1000)).toBe(667);
    expect(helveticaMeasure(" ", "regular", 1000)).toBe(278);
  });

  test("la negrita mide lo suyo y las acentuadas como su letra", () => {
    expect(helveticaMeasure("carga", "bold", 10)).toBeGreaterThan(
      helveticaMeasure("carga", "regular", 10),
    );
    expect(helveticaMeasure("áé", "regular", 10)).toBeCloseTo(
      helveticaMeasure("ae", "regular", 10),
    );
    expect(helveticaMeasure("probado", "boldItalic", 10)).toBeCloseTo(
      helveticaMeasure("probado", "bold", 10),
    );
    // Monosespaciada: miden lo mismo dos textos de la misma longitud.
    expect(helveticaMeasure("cualquiera", "mono", 10)).toBeCloseTo(
      helveticaMeasure("otrocualqn", "mono", 10),
    );
    expect(helveticaMeasure("", "regular", 10)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* El archivo                                                          */
/* ------------------------------------------------------------------ */

describe("el parte en PDF", () => {
  test("es un archivo PDF completo: cabecera, páginas, tabla y cierre", async () => {
    const bytes = await reportToPdf(informe(), {
      footer: "Parte de INC-0038",
    });
    const pdf = Buffer.from(bytes).toString("latin1");

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/Type /Pages");
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("/BaseFont /Helvetica-Bold");
    expect(pdf).toContain("/Encoding /WinAnsiEncoding");
    // El `startxref` apunta a la tabla de referencias, que es lo que hace que
    // el archivo se abra.
    const start = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(start).startsWith("xref\n0 ")).toBe(true);
    // Y cada objeto declarado en la tabla empieza donde la tabla dice: sin eso
    // el archivo se abre en blanco.
    const table = pdf.slice(start);
    const objects = Number(/^xref\n0 (\d+)\n/.exec(table)?.[1]);
    const rows = table.split("\n").slice(3, 3 + objects - 1);
    expect(rows).toHaveLength(objects - 1);
    rows.forEach((row, index) => {
      const offset = Number(row.slice(0, 10));
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  test("lleva el texto del parte y el formato de las notas", async () => {
    const bytes = await reportToPdf(informe(), {
      footer: "Parte de INC-0038",
    });
    const drawn = drawnText(bytes);
    const texts = drawn.map((item) => item.text);

    // La cabecera en su tipografía de título.
    const titulo = drawn.find((item) =>
      item.text.startsWith("Incidencia INC-0038"),
    );
    expect(titulo?.font).toBe("bold");
    expect(titulo?.size).toBe(18);

    // La firma de la nota (en negrita, como se escribió) y su texto, con la
    // negrita de dentro: el formato de la nota llega al papel.
    expect(
      drawn.some(
        (item) => item.font === "bold" && item.text.includes("Paula Iglesias"),
      ),
    ).toBe(true);
    // Un trozo que no abre la línea arranca con el hueco que lo separa de lo
    // anterior, así que se compara sin el hueco de delante.
    expect(
      drawn.some(
        (item) =>
          item.text.trim() === "carga durante dos horas" &&
          item.font === "bold",
      ),
    ).toBe(true);
    expect(texts).toContain("Sin fallos");
    expect(texts).toContain("Estable");

    // Los puntos de la lista van sangrados respecto de su viñeta, que queda a
    // su misma altura: la viñeta abre el renglón y el texto va a su sombra.
    const punto = drawn.find((item) => item.text === "Sin fallos");
    expect(punto).toBeDefined();
    const vineta = drawn.find(
      (item) => item.text === "•" && Math.abs(item.top - punto!.top) < 1,
    );
    expect(vineta).toBeDefined();
    expect(punto!.x).toBeGreaterThan(vineta!.x + 4);

    // Las tablas del parte (historial y rastro) llevan sus cabeceras.
    expect(texts).toContain("Fecha y hora");
    expect(texts).toContain("Historial de estados");
    expect(texts).toContain("Rastro de auditoría de documentos");
    expect(
      texts.some((text) => text.includes("Quitó «Fotos del daño.jpg»")),
    ).toBe(true);

    // Y el pie: lo que es el parte a la izquierda y la hoja a la derecha.
    expect(texts).toContain("Parte de INC-0038");
    const pages = new Set(drawn.map((item) => item.page)).size;
    expect(pages).toBeGreaterThan(1);
    expect(texts).toContain(`Página 1 de ${pages}`);
    expect(texts).toContain(`Página ${pages} de ${pages}`);
  });

  test("cada trozo arranca donde acaba el anterior, con la anchura de su letra", async () => {
    // Una viñeta con el rótulo en negrita, como las de la ficha. El valor tiene
    // que empezar donde el rótulo acaba según Helvetica-Bold: «Estado:» mide
    // 3667 milésimas de em, es decir 38,50pt a 10,5pt. Si se midiera con otra
    // letra —la del sistema, o la redonda para la negrita—, el valor se echaría
    // encima del rótulo y el papel saldría con las palabras pisadas.
    const bytes = await reportToPdf("- **Estado:** En taller\n");
    const drawn = drawnText(bytes);
    const rotulo = drawn.find((item) => item.text === "Estado:");
    expect(rotulo?.font).toBe("bold");
    expect(rotulo?.x).toBeCloseTo(65.68, 2);
    const valor = drawn.find((item) => item.text.trim() === "En taller");
    expect(valor?.x).toBeCloseTo(65.68 + 3667 * 0.0105, 1);
  });

  test("un signo pegado a la negrita no se despega al componerlo", async () => {
    // El diff de una nota marca las palabras añadidas y deja fuera el punto:
    // «Probado dos horas **sin fallos**.». El punto va contra la negrita, no
    // separado por un espacio, así que el trozo siguiente arranca pegado.
    const bytes = await reportToPdf("Probado dos horas **sin fallos**.\n");
    const drawn = drawnText(bytes);
    const lineas = new Map<number, DrawnText[]>();
    for (const item of drawn) {
      if (item.text.startsWith("Página ")) continue;
      lineas.set(item.top, [...(lineas.get(item.top) ?? []), item]);
    }
    const [fila] = [...lineas.values()].sort(
      (uno, otro) =>
        uno.map((item) => item.x).sort()[0] -
        otro.map((item) => item.x).sort()[0],
    );
    const ordenada = fila.sort((uno, otro) => uno.x - otro.x);

    // La frase sale entera y el punto, pegado: nada de «sin fallos .».
    expect(ordenada.map((item) => item.text).join("")).toBe(
      "Probado dos horas sin fallos.",
    );
    const negrita = ordenada.find((item) => item.font === "bold");
    expect(negrita?.text).toBe(" sin fallos");
    const punto = ordenada[ordenada.indexOf(negrita!) + 1];
    expect(punto.text).toBe(".");
    // Y arranca justo donde acaba lo que se dibujó antes: sin un hueco de más.
    expect(punto.x).toBeCloseTo(
      negrita!.x + helveticaMeasure(negrita!.text, "bold", negrita!.size),
      2,
    );
  });

  test("el PDF dice lo mismo que el Markdown, renglón a renglón", async () => {
    // El parte en PDF se compone del mismo Markdown que se descarga, así que
    // todo lo que dice el uno tiene que estar en el otro. Se comparan los
    // renglones del papel (los trozos de una misma altura, en orden de lectura)
    // con las líneas del Markdown, ya sin marcas: es la red que caza una frase
    // que se pierde por el camino.
    const markdown = informe();
    const drawn = drawnText(
      await reportToPdf(markdown, { footer: "Parte de INC-0038" }),
    );

    const filas = new Map<string, DrawnText[]>();
    for (const item of drawn) {
      if (item.text.startsWith("Página ") || item.text === "Parte de INC-0038")
        continue;
      const key = `${item.page}|${item.top.toFixed(1)}`;
      filas.set(key, [...(filas.get(key) ?? []), item]);
    }
    const papel = [...filas.entries()]
      .sort(([uno], [otro]) => {
        const [paginaUno, altoUno] = uno.split("|").map(Number);
        const [paginaOtro, altoOtro] = otro.split("|").map(Number);
        return paginaUno - paginaOtro || altoUno - altoOtro;
      })
      .map(([, partes]) =>
        partes
          .sort((uno, otro) => uno.x - otro.x)
          .map((parte) => parte.text)
          .join(""),
      )
      .join(" ");
    const plano = (texto: string) => texto.replace(/\s+/g, " ").trim();
    const enPapel = plano(papel);

    const lineas = markdown
      .split("\n")
      // Las tablas se maquetan por columnas y los títulos de dentro de las
      // líneas ya se comprueban trozo a trozo; aquí interesan las frases.
      .filter((linea) => linea.trim() !== "" && !linea.trim().startsWith("|"))
      .map((linea) =>
        plano(
          linea
            .replace(/^#+\s*/, "")
            .replace(/^[-*>]\s*/, "")
            .replace(/\*\*|~~|\*/g, "")
            // El énfasis con guion bajo abre y cierra la frase entera
            // («_No se ha corregido ninguna nota…_»).
            .replace(/^_(?=\S)/, "")
            .replace(/(?<=\S)_$/, "")
            .replace(/\\([_*])/g, "$1"),
        ),
      )
      .filter((linea) => linea.length > 12);

    expect(lineas.length).toBeGreaterThan(10);
    for (const linea of lineas) expect(enPapel).toContain(linea);
  });

  test("el texto nunca se sale de la caja: los márgenes se respetan", async () => {
    const bytes = await reportToPdf(informe(), {
      footer: "Parte de INC-0038",
    });
    const drawn = drawnText(bytes);
    expect(drawn.length).toBeGreaterThan(20);
    for (const item of drawn) {
      expect(item.x).toBeGreaterThanOrEqual(MARGEN.left - 0.01);
      const width = helveticaMeasure(item.text, item.font, item.size);
      expect(item.x + width).toBeLessThanOrEqual(A4.width - MARGEN.right + 0.6);
    }
  });

  test("un parte largo se reparte en hojas y cada una lleva su pie", async () => {
    const largo = Array.from(
      { length: 90 },
      (_, index) =>
        `## Apartado ${index + 1}\n\nUn párrafo del apartado ${index + 1} que cuenta lo que pasó con el equipo y cómo quedó al final, con la firma de quien lo hizo.`,
    ).join("\n\n");
    const bytes = await reportToPdf(largo, { footer: "Parte de INC-0001" });
    const drawn = drawnText(bytes);
    const pages = [...new Set(drawn.map((item) => item.page))];

    expect(pages.length).toBeGreaterThan(1);
    // El primer apartado va en la primera hoja y cada hoja lleva su pie.
    expect(
      drawn.some((item) => item.page === 0 && item.text === "Apartado 1"),
    ).toBe(true);
    pages.forEach((page, index) => {
      expect(
        drawn.some(
          (item) =>
            item.page === page &&
            item.text === `Página ${index + 1} de ${pages.length}`,
        ),
      ).toBe(true);
      // El pie va al final de su hoja: nada de texto por debajo de él.
      const footer = drawn.find(
        (item) => item.page === page && item.text.startsWith("Página "),
      );
      expect(
        drawn
          .filter((item) => item.page === page)
          .every((item) => item.top <= footer!.top),
      ).toBe(true);
    });
    // Un título no se queda solo al final: cada apartado lleva su párrafo
    // debajo en la misma hoja.
    for (const title of drawn.filter((item) =>
      item.text.startsWith("Apartado "),
    )) {
      expect(
        drawn.some(
          (item) =>
            item.page === title.page &&
            item.text.includes("Un párrafo del apartado"),
        ),
      ).toBe(true);
    }
  });

  test("las imágenes del parte se incrustan, y lo que ya no está se cita", async () => {
    const markdown = "![foto del daño](https://taller/foto.jpg)\n";

    const image: PdfLoadImage = async (src) =>
      src.endsWith(".jpg")
        ? {
            bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
            width: 1600,
            height: 900,
          }
        : null;

    const bytes = await reportToPdf(markdown, { loadImage: image });
    const pdf = Buffer.from(bytes).toString("latin1");
    expect(pdf).toContain("/Subtype /Image");
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/Width 1600");
    expect(pdf).toContain("/Height 900");
    // Y se coloca en su sitio: una imagen de 1600×900 entra por el ancho de la
    // caja (483,28pt) y guarda su proporción (271,84pt de alto).
    expect(pdf).toContain("Do Q");
    const placed = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.-]+) cm/.exec(pdf);
    expect(Number(placed?.[1])).toBeCloseTo(483.28, 1);
    expect(Number(placed?.[2])).toBeCloseTo(483.28 * (900 / 1600), 1);
    // El texto de esa hoja es solo el pie: la imagen no escribe nada.
    expect(drawnText(bytes).map((item) => item.text)).toEqual([
      "Página 1 de 1",
    ]);

    // Sin de dónde traerla, el parte dice que ahí había una imagen: una foto
    // perdida no puede desaparecer del parte sin dejar rastro.
    const sinImagen = await reportToPdf(markdown, {
      loadImage: async () => null,
    });
    expect(drawnText(sinImagen).map((item) => item.text)).toContain(
      "[imagen no disponible: foto del daño]",
    );
  });

  test("sin navegador y sin imágenes, el parte se compone igual", async () => {
    // Es lo que pasa al componerlo sin `measure` ni `loadImage`: la medida de
    // reserva y las imágenes citadas.
    const markdown =
      "## Avería descrita\n\n![foto](https://taller/x.png)\n\nEl foco no enciende.\n";
    const bytes = await reportToPdf(markdown);
    const texts = drawnText(bytes).map((item) => item.text);
    expect(texts).toContain("Avería descrita");
    expect(texts).toContain("[imagen no disponible: foto]");
    expect(texts).toContain("El foco no enciende.");
  });
});
