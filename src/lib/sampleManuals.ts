/**
 * Los manuales de la muestra: la documentación que el taller de ejemplo trae ya
 * cargada, para que el módulo de manuales no nazca vacío.
 *
 * Están las dos formas —el PDF que se sube y la nota que escribe un técnico—,
 * repartidas por los seis tipos del catálogo y por varias marcas, con manuales
 * asignados a un equipo del inventario y otros que son solo del modelo, sin
 * equipo: es la clasificación del módulo la que se quiere poder probar desde el
 * primer día. Y cada equipo del inventario tiene su expediente —al menos un
 * manual asignado a él—, para que abrir la ficha de cualquiera de ellos
 * enseñe su documentación y no un hueco.
 *
 * Ninguno de los manuales de la muestra se queda sin colgar de ninguna ficha:
 * un manual del taller solo aparece en un equipo si está asignado a él o si
 * declara el modelo de un equipo que exista —sin modelo no es «del modelo» de
 * nada—, así que aquí no hay ninguno de un modelo que el inventario no tenga ni
 * ninguno sin marca ni modelo que pulule suelto. Todos los que no están
 * asignados declaran la marca y el modelo de un equipo del taller, y los
 * asignados llevan la clasificación del suyo. Uno de los manuales de archivo llega ya sustituido una vez, con su
 * versión anterior en el historial, para que la ficha enseñe el historial de
 * cambios sin tener que provocarlo a mano, y el del servidor lleva además su
 * nota: el archivo y la nota en la misma ficha, que es donde el taller apunta lo
 * que el PDF del fabricante no dice de esta instalación.
 *
 * Los PDF no van escritos aquí en bytes: se componen al vuelo con el maquetador
 * del taller (`lib/pdf`, el mismo del parte en PDF), así que son documentos de
 * verdad —una hoja con la ficha del manual— y no un puñado de bytes suelto. Eso
 * sí: son de ejemplo y lo dicen en su primera línea, no el manual del
 * fabricante. Los guarda una acción (`seedDemoManuals`), que es el único sitio
 * desde donde se escribe el almacén.
 *
 * Aquí solo vive lo que se puede decidir sin tocar nada: qué manuales trae la
 * muestra y cómo se compone su documento. La base de datos la escribe el seed.
 */

import type { ManualType } from "./manuals";
import { A4, PdfDocument } from "./pdf";

/** Un manual de la muestra, con lo que hace falta para crearlo. */
export interface SampleManual {
  /** Identificador de la muestra: va en el documento y firma las pruebas. */
  code: string;
  title: string;
  /** Uno de los tipos del catálogo del módulo. */
  type: ManualType;
  /** Código del equipo del inventario al que se asigna, si es de uno del taller. */
  equipmentCode?: string;
  brand?: string;
  model?: string;
  /** La nota del taller (documento de `richDoc`) si el manual la lleva. */
  notes?: string;
  /** El PDF del manual, si es de tipo archivo. */
  file?: { fileName: string };
  /**
   * Nombre de la versión anterior del archivo. Solo lo lleva el manual que la
   * muestra da por sustituido: su historial nace con lo que decía antes.
   */
  previousFileName?: string;
  /** Antigüedad del alta de la ficha, en días. */
  ageDays: number;
}

/**
 * Los manuales que carga la muestra: el expediente de todo el inventario —cada
 * equipo con al menos un manual asignado a él—, más los del modelo, con
 * los seis tipos del catálogo. El del servidor es de archivo y lleva además su
 * nota.
 */
export const SAMPLE_MANUALS: readonly SampleManual[] = [
  {
    code: "MAN-01",
    title: "Manual de servicio HDC-3500",
    type: "Manual de servicio",
    equipmentCode: "EQ-001",
    brand: "Sony",
    model: "HDC-3500",
    file: { fileName: "Manual-de-servicio-HDC-3500.pdf" },
    // Este llega ya sustituido: la ficha enseña la versión anterior.
    previousFileName: "Manual-de-servicio-HDC-3500-v1.pdf",
    ageDays: 420,
  },
  {
    code: "MAN-02",
    title: "Manual de usuario de la mesa DM7",
    type: "Manual de usuario",
    equipmentCode: "EQ-011",
    brand: "Yamaha",
    model: "DM7",
    file: { fileName: "DM7-manual-de-usuario.pdf" },
    ageDays: 210,
  },
  {
    code: "MAN-03",
    title: "Ficha técnica del SAI Smart-UPS 3000",
    type: "Ficha técnica",
    equipmentCode: "EQ-017",
    brand: "APC",
    model: "Smart-UPS 3000",
    file: { fileName: "Smart-UPS-3000-ficha-tecnica.pdf" },
    ageDays: 150,
  },
  {
    code: "MAN-04",
    title: "Esquema de rack del conmutador M4300",
    type: "Esquema y planos",
    equipmentCode: "EQ-016",
    brand: "Netgear",
    model: "M4300",
    file: { fileName: "M4300-esquema-de-rack.pdf" },
    ageDays: 96,
  },
  {
    code: "MAN-05",
    title: "Manual de usuario AW-UE150",
    type: "Manual de usuario",
    // Del modelo: vale para cualquier equipo AW-UE150 sin ser de uno concreto.
    brand: "Panasonic",
    model: "AW-UE150",
    file: { fileName: "AW-UE150-manual-de-usuario.pdf" },
    ageDays: 64,
  },
  {
    code: "MAN-06",
    title: "Guía rápida de la cámara de estudio HDC-3500",
    type: "Guía rápida",
    // Del modelo de un equipo que sí está en el inventario: la cámara de
    // estudio lo enseña en su ficha como «del modelo», sin ser de uno concreto. Antes este manual era de un modelo que el taller no tiene, y
    // con la regla del módulo —sin modelo no se cuelga de ninguna ficha— se
    // quedaba fuera de todas las fichas del inventario.
    brand: "Sony",
    model: "HDC-3500",
    file: { fileName: "HDC-3500-guia-rapida.pdf" },
    ageDays: 21,
  },
  {
    code: "MAN-07",
    title: "Manual de servicio del servidor K2 Summit",
    type: "Manual de servicio",
    equipmentCode: "EQ-021",
    brand: "Grass Valley",
    model: "K2 Summit",
    file: { fileName: "K2-Summit-manual-de-servicio.pdf" },
    // De archivo y con nota a la vez: el PDF del fabricante y, encima, lo que el
    // taller sabe de este equipo en concreto.
    notes:
      "<p>El PDF es el manual del fabricante tal cual: ni la tarjeta de E/S que monta este equipo ni la revisión de firmware con la que salió de fábrica vienen ahí, y es lo primero que se mira cuando el servidor no arranca.</p>" +
      "<ul><li>Antes de tocar el almacenamiento, avisar a Postproducción.</li>" +
      "<li>Arrancar en el orden del manual, no en el de la etiqueta de la puerta del rack.</li></ul>",
    ageDays: 14,
  },
  {
    code: "MAN-08",
    title: "Ajuste de color del panel SkyPanel S60-C",
    type: "Procedimiento interno",
    equipmentCode: "EQ-005",
    brand: "ARRI",
    model: "SkyPanel S60-C",
    notes:
      "<p>El panel se ajusta a 5600 K y se comprueba con el fotómetro antes de grabar. Si el cromatismo se va, revisar la caja de control antes de tocar el menú.</p>",
    ageDays: 26,
  },
  {
    code: "MAN-09",
    title: "Comprobación de sincronía tras un corte",
    type: "Procedimiento interno",
    // Del modelo del router: aparece en su ficha como «del modelo».
    brand: "Evertz",
    model: "7800FR 128×128",
    notes:
      "<p>Tras un corte de alimentación, comprobar el generador de sincronía y después la referencia de cada entrada del router.</p>",
    ageDays: 12,
  },
  {
    code: "MAN-10",
    title: "Inventario de cables y latiguillos del rack central",
    type: "Procedimiento interno",
    // Del router del rack —donde vive el cableado que la nota inventaría— y con
    // la marca y el modelo de su equipo: es lo que el formulario guarda al
    // elegir equipo, y sin eso el manual no lo encuentran los filtros de marca
    // y modelo. Antes iba suelto, sin equipo ni modelo, y no salía en ninguna
    // ficha.
    equipmentCode: "EQ-004",
    brand: "Evertz",
    model: "7800FR 128×128",
    notes:
      "<p>Los latiguillos del rack se revisan una vez al año: se etiqueta cada uno con su longitud y su destino.</p>",
    ageDays: 5,
  },
  /*
   * El resto del inventario, equipo por equipo: hasta aquí la muestra enseñaba
   * el módulo, pero la mitad de las fichas del taller se abrían sin su
   * documentación. Un manual del equipo —de archivo en los equipos grandes,
   * nota del taller en lo que se ajusta a mano— para que el expediente de
   * cualquier equipo esté completo desde el primer día.
   */
  {
    code: "MAN-11",
    title: "Manual de usuario del intercom Bolero",
    type: "Manual de usuario",
    equipmentCode: "EQ-002",
    brand: "Riedel",
    model: "Bolero",
    file: { fileName: "Bolero-manual-de-usuario.pdf" },
    ageDays: 310,
  },
  {
    code: "MAN-12",
    title: "Manual de servicio del conmutador Carbonite Ultra",
    type: "Manual de servicio",
    equipmentCode: "EQ-003",
    brand: "Ross",
    model: "Carbonite Ultra",
    file: { fileName: "Carbonite-Ultra-manual-de-servicio.pdf" },
    ageDays: 268,
  },
  {
    code: "MAN-13",
    title: "Esquema de cableado del router 7800FR",
    type: "Esquema y planos",
    equipmentCode: "EQ-004",
    brand: "Evertz",
    model: "7800FR 128×128",
    file: { fileName: "7800FR-esquema-de-cableado.pdf" },
    ageDays: 402,
  },
  {
    code: "MAN-14",
    title: "Ficha técnica del monitor de forma de onda WFM5200",
    type: "Ficha técnica",
    equipmentCode: "EQ-006",
    brand: "Tektronix",
    model: "WFM5200",
    file: { fileName: "WFM5200-ficha-tecnica.pdf" },
    ageDays: 348,
  },
  {
    code: "MAN-15",
    title: "Guía rápida de la cámara ENG PXW-Z750",
    type: "Guía rápida",
    equipmentCode: "EQ-007",
    brand: "Sony",
    model: "PXW-Z750",
    file: { fileName: "PXW-Z750-guia-rapida.pdf" },
    ageDays: 190,
  },
  {
    code: "MAN-16",
    title: "Manual de usuario de la URSA Broadcast G2",
    type: "Manual de usuario",
    equipmentCode: "EQ-008",
    brand: "Blackmagic",
    model: "URSA Broadcast G2",
    file: { fileName: "URSA-Broadcast-G2-manual-de-usuario.pdf" },
    ageDays: 240,
  },
  {
    code: "MAN-17",
    title: "Puesta a punto del objetivo CJ45ex9.7B",
    type: "Procedimiento interno",
    equipmentCode: "EQ-009",
    brand: "Canon",
    model: "CJ45ex9.7B",
    notes:
      "<p>El objetivo se ajusta con la carta de resolución y se anota el back focus: si vuelve a perder foco en el tele, es lo primero que se revisa.</p>",
    ageDays: 205,
  },
  {
    code: "MAN-18",
    title: "Ficha técnica del sistema de microfonía EW-DX",
    type: "Ficha técnica",
    equipmentCode: "EQ-010",
    brand: "Sennheiser",
    model: "EW-DX",
    file: { fileName: "EW-DX-ficha-tecnica.pdf" },
    ageDays: 160,
  },
  {
    code: "MAN-19",
    title: "Manual de usuario del micrófono Axient Digital",
    type: "Manual de usuario",
    equipmentCode: "EQ-012",
    brand: "Shure",
    model: "Axient Digital",
    file: { fileName: "Axient-Digital-manual-de-usuario.pdf" },
    ageDays: 118,
  },
  {
    code: "MAN-20",
    title: "Reparto de referencias del generador SPG 5600",
    type: "Procedimiento interno",
    equipmentCode: "EQ-013",
    brand: "Evertz",
    model: "SPG 5600",
    notes:
      "<p>Las salidas del generador van al router, al mezclador y al grabador, por ese orden: antes de mover una referencia, apuntar qué entrada se suelta.</p>",
    ageDays: 355,
  },
  {
    code: "MAN-21",
    title: "Manual de servicio de la matriz de audio Nova",
    type: "Manual de servicio",
    equipmentCode: "EQ-014",
    brand: "Lawo",
    model: "Nova",
    file: { fileName: "Nova-manual-de-servicio.pdf" },
    ageDays: 300,
  },
  {
    code: "MAN-22",
    title: "Ajustes del puesto de edición Media Composer",
    type: "Procedimiento interno",
    equipmentCode: "EQ-015",
    brand: "Avid",
    model: "Media Composer",
    notes:
      "<p>El puesto se entrega con el proyecto en el volumen de trabajo, no en el de sistema: al cerrar, comprobar que la caché queda fuera del arranque.</p>",
    ageDays: 75,
  },
  {
    code: "MAN-23",
    title: "Manual de usuario del grabador Lightspeed Live",
    type: "Manual de usuario",
    equipmentCode: "EQ-018",
    brand: "Telestream",
    model: "Lightspeed Live",
    file: { fileName: "Lightspeed-Live-manual-de-usuario.pdf" },
    ageDays: 132,
  },
  {
    code: "MAN-24",
    title: "Manual de servicio de la cámara AW-UE150",
    type: "Manual de servicio",
    equipmentCode: "EQ-019",
    brand: "Panasonic",
    model: "AW-UE150",
    file: { fileName: "AW-UE150-manual-de-servicio.pdf" },
    ageDays: 40,
  },
  {
    code: "MAN-25",
    title: "Manual de usuario del monitor MDSC-8424",
    type: "Manual de usuario",
    equipmentCode: "EQ-020",
    brand: "Barco",
    model: 'MDSC-8424 24"',
    file: { fileName: "MDSC-8424-manual-de-usuario.pdf" },
    ageDays: 226,
  },
  {
    code: "MAN-26",
    title: "Colocación del micrófono de caña 4017",
    type: "Procedimiento interno",
    equipmentCode: "EQ-022",
    brand: "DPA",
    model: "4017",
    notes:
      "<p>El 4017 se coloca fuera de plano y a un palmo del interlocutor: si entra viento, parabrisas antes de tocar el filtro del soporte.</p>",
    ageDays: 96,
  },
  {
    code: "MAN-27",
    title: "Guía rápida del foco LED Gemini 2x1",
    type: "Guía rápida",
    equipmentCode: "EQ-023",
    brand: "Litepanels",
    model: "Gemini 2x1",
    file: { fileName: "Gemini-2x1-guia-rapida.pdf" },
    ageDays: 88,
  },
  {
    code: "MAN-28",
    title: "Mantenimiento del trípode 546B",
    type: "Procedimiento interno",
    equipmentCode: "EQ-024",
    brand: "Manfrotto",
    model: "546B",
    notes:
      "<p>Una vez al año se limpian las rótulas y se comprueba el freno de la columna: si cede con la cámara montada, se cambia el muelle antes de volver a usarlo.</p>",
    ageDays: 62,
  },
  {
    code: "MAN-29",
    title: "Puesta a punto del monitor de confianza TM-1400",
    type: "Procedimiento interno",
    equipmentCode: "EQ-025",
    brand: "JVC",
    model: 'TM-1400 14"',
    notes:
      "<p>El monitor está retirado del servicio y se guarda como repuesto de plató: antes de bajarlo a un control, calibrarlo con la sonda y apuntar aquí el ajuste.</p>",
    ageDays: 30,
  },
];

/** Lo que dice el documento de ejemplo: ni el manual del fabricante ni un hueco. */
const SAMPLE_PDF_NOTE =
  "Este documento es un manual de ejemplo: la muestra del taller lo trae ya cargado para poder probar el módulo de manuales —la búsqueda por tipo, marca y modelo, la descarga del archivo y el historial de cambios— sin depender de un PDF del fabricante.";

/** Reparte un texto en líneas que quepan en el ancho de la hoja. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length > max && current !== "") {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * El PDF de ejemplo de un manual: una hoja con su ficha —tipo, marca, modelo,
 * equipo y referencia— y el aviso de que es un documento de ejemplo. Se compone
 * con el maquetador del taller (`lib/pdf`), que no toca el navegador, así que
 * vale igual para el seed que para cualquier otra parte del código.
 *
 * `variant` distingue la versión anterior de la que está en uso: el texto cambia
 * —y con él los bytes—, que es lo que hace que las dos versiones del manual
 * guarden un archivo cada una.
 */
export function sampleManualPdf(
  manual: SampleManual,
  variant: "current" | "previous" = "current",
): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument(A4);
  const page = doc.addPage();
  const margin = 56;
  const fileName =
    variant === "previous"
      ? (manual.previousFileName ?? "Manual.pdf")
      : (manual.file?.fileName ?? "Manual.pdf");

  // Cabecera: una franja y la referencia de la muestra, que no se lee como el
  // título para que no se confundan.
  page.rect(0, 0, A4.width, 6, { color: [0.09, 0.4, 0.62] });
  page.text(
    variant === "previous"
      ? "Manual de ejemplo · versión anterior"
      : "Manual de ejemplo",
    margin,
    58,
    { font: "bold", size: 9, color: [0.35, 0.4, 0.45] },
  );
  page.text(manual.title, margin, 92, { font: "bold", size: 19 });
  page.line(margin, 112, A4.width - margin, 112, { color: [0.8, 0.82, 0.85] });

  const rows: [string, string][] = [
    ["Tipo", manual.type],
    [
      "Marca / modelo",
      [manual.brand, manual.model].filter(Boolean).join(" · ") || "—",
    ],
    [
      "Equipo del inventario",
      manual.equipmentCode
        ? `${manual.equipmentCode}`
        : "Manual del modelo, sin equipo asignado",
    ],
    ["Archivo", fileName],
    ["Referencia de la muestra", manual.code],
  ];

  let y = 140;
  for (const [label, value] of rows) {
    page.text(label, margin, y, { font: "bold", size: 10 });
    page.text(value, margin + 132, y, { size: 10 });
    y += 19;
  }

  y += 10;
  page.line(margin, y, A4.width - margin, y, { color: [0.88, 0.89, 0.91] });
  y += 24;
  for (const line of wrap(SAMPLE_PDF_NOTE, 88)) {
    page.text(line, margin, y, { size: 10.5 });
    y += 16;
  }

  page.text(`Documento de ejemplo · ${manual.code}`, margin, A4.height - 48, {
    size: 8.5,
    color: [0.45, 0.48, 0.52],
  });
  // `slice()` deja los bytes en memoria propia: es lo que el `Blob` que los
  // guarda admite, y de paso el archivo no comparte memoria con el maquetador.
  return doc.toBytes().slice();
}
