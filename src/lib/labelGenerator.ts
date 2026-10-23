/**
 * Etiquetas físicas del taller: el contenido que se imprime en una pegatina de
 * estantería y el dibujo que se manda a la impresora.
 *
 * Una etiqueta lleva dos formas de leerla, porque hay dos formas de llegar a un
 * equipo o a un repuesto: un **QR** que el móvil abre en el buscador del taller
 * con el código ya escrito, y un **código de barras Code 128** que lee una
 * pistola óptica y escribe en el campo de búsqueda como si se tecleara. El QR
 * sirve para quien lleva el móvil; el Code 128, para el lector del almacén.
 *
 * Lo que se compone aquí es el SVG en milímetros, no una imagen: la etiqueta se
 * estira a la medida del rollo sin perder nitidez, la impresora térmica la
 * recibe vectorial y el navegador la pagina con `@page`. Cada milímetro del SVG
 * es un milímetro de papel; el `viewBox` va en esas unidades.
 *
 * Como todo lo que hay en `lib`, no sabe de React ni de Convex: recibe los datos
 * del equipo o del repuesto, el origen de la aplicación y la medida, y devuelve
 * texto. Quien la imprime —el diálogo de la ficha— pone el resto.
 */

import { encodeQr } from "./qr";

/** Las medidas de etiqueta que se ofrecen, en milímetros. */
export interface LabelSize {
  id: LabelSizeId;
  /** Nombre con el que se elige en pantalla. */
  label: string;
  widthMm: number;
  heightMm: number;
}

export type LabelSizeId = "50x30" | "60x40";

/**
 * Los dos rollos habituales del taller: el de 50×30 —el que cabe en una
 * gaveta— y el de 60×40, que deja sitio para el nombre largo y la ubicación.
 * Son medidas de etiqueta, no de hoja: la impresora térmica no recorta.
 */
export const LABEL_SIZES: readonly LabelSize[] = [
  { id: "50x30", label: "50 × 30 mm", widthMm: 50, heightMm: 30 },
  { id: "60x40", label: "60 × 40 mm", widthMm: 60, heightMm: 40 },
];

/** La medida que se usa si nadie elige otra: la pequeña, la de las gavetas. */
export const DEFAULT_LABEL_SIZE: LabelSizeId = "50x30";

export function labelSize(id: LabelSizeId): LabelSize {
  return LABEL_SIZES.find((size) => size.id === id) ?? LABEL_SIZES[0];
}

/** De qué es la etiqueta: cambia la dirección a la que lleva el QR. */
export type LabelKind = "equipment" | "part";

/** Lo que se imprime en una etiqueta, ya resuelto. */
export interface LabelData {
  kind: LabelKind;
  /** El código con el que se busca: «EQ-CAM-0042», «ALI-24015». */
  code: string;
  /** Nombre del equipo o del repuesto. */
  title: string;
  /** Marca, modelo o categoría: la línea de debajo del nombre. */
  subtitle?: string;
  /** Dónde está en el almacén o en la planta. */
  location?: string;
  /** Fecha de alta o de compra, ya en `dd/mm/aaaa` ("" si no se sabe). */
  acquiredOn?: string;
  /** La dirección que abre el QR: el buscador del taller con el código puesto. */
  url: string;
}

/** Los datos mínimos de un equipo para componer su etiqueta. */
export interface LabelEquipmentLike {
  code?: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  purchaseDate?: number;
  createdAt?: number;
}

/** Los datos mínimos de un repuesto para componer su etiqueta. */
export interface LabelPartLike {
  code: string;
  name: string;
  category?: string;
  location?: string;
  createdAt?: number;
}

/** `dd/mm/aaaa` en hora local, que es como se lee una fecha en el taller. */
export function labelDate(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * La dirección que lleva el QR: el panel del taller con el código en la
 * dirección, para que el buscador de equipos o de repuestos lo abra ya escrito.
 *
 * El origen se recorta por la derecha —una barra de más haría `//dashboard`— y
 * si viene vacío la dirección sale relativa: quien la lea desde dentro de la
 * aplicación llega igual, y así la etiqueta se puede componer sin saber dónde
 * está publicada.
 */
export function labelLookupUrl(
  kind: LabelKind,
  code: string,
  origin: string,
): string {
  const base = origin.trim().replace(/\/+$/, "");
  const param = kind === "equipment" ? "equipo" : "repuesto";
  return `${base}/dashboard?${param}=${encodeURIComponent(code.trim())}`;
}

/** La etiqueta de un equipo del inventario. */
export function equipmentLabel(
  equipment: LabelEquipmentLike,
  origin: string,
): LabelData {
  const code = (equipment.code ?? equipment.serialNumber ?? "").trim();
  const subtitle = [equipment.brand, equipment.model]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" · ");
  return {
    kind: "equipment",
    code,
    title: equipment.name.trim(),
    ...(subtitle ? { subtitle } : {}),
    ...(equipment.location ? { location: equipment.location.trim() } : {}),
    acquiredOn: labelDate(equipment.purchaseDate ?? equipment.createdAt),
    url: code ? labelLookupUrl("equipment", code, origin) : "",
  };
}

/** La etiqueta de un repuesto del catálogo. */
export function partLabel(part: LabelPartLike, origin: string): LabelData {
  const code = part.code.trim();
  return {
    kind: "part",
    code,
    title: part.name.trim(),
    ...(part.category ? { subtitle: part.category } : {}),
    ...(part.location ? { location: part.location.trim() } : {}),
    acquiredOn: labelDate(part.createdAt),
    url: code ? labelLookupUrl("part", code, origin) : "",
  };
}

/* ------------------------------------------------------------------ */
/* Code 128                                                            */
/* ------------------------------------------------------------------ */

/**
 * Los anchos de las seis barras y espacios de cada símbolo Code 128, en
 * módulos, empezando por barra. El índice es el valor del símbolo: los
 * caracteres del juego B van del 0 (espacio) al 95, y del 96 al 106 están los
 * especiales, el inicio (104, 105) y el fin (106). La tabla es la de la norma
 * ISO/IEC 15417; el fin se compone aparte porque lleva una barra de más.
 */
const CODE128_WIDTHS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "233111",
];

/** El fin del código: seis anchos más la barra final de dos módulos. */
const CODE128_STOP = "2331112";

/** El símbolo de inicio del juego B, el de los caracteres imprimibles. */
const CODE128_START_B = 104;

/** Un código de barras ya calculado. */
export interface Barcode {
  /** Anchos de barra y espacio, empezando por barra. */
  widths: number[];
  /** Lo que se lee debajo (el código tal cual). */
  text: string;
}

/** El ancho total de un código de barras, en módulos. */
export function barcodeModules(barcode: Barcode): number {
  return barcode.widths.reduce((total, width) => total + width, 0);
}

/**
 * Codifica un código en Code 128, juego B: los caracteres imprimibles de ASCII
 * (32 a 126), que es lo que llevan los códigos del taller —letras, números y
 * guiones—. El dígito de control es la suma ponderada módulo 103 de la norma.
 *
 * Se lanza un error si el código trae algo que este juego no sabe escribir: un
 * código de barras a medias se lee mal y nadie se entera hasta que la pistola
 * no encuentra la ficha.
 */
export function code128Barcode(value: string): Barcode {
  const text = value.trim();
  if (text === "") {
    throw new Error("No hay código que poner en la etiqueta.");
  }
  const values = [...text].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code > 126) {
      throw new Error(
        `«${character}» no se puede escribir en un código de barras Code 128 B.`,
      );
    }
    return code - 32;
  });

  // El inicio pesa 1 y cada carácter, su posición (la primera es la 1).
  let checksum = CODE128_START_B;
  values.forEach((value, index) => {
    checksum += value * (index + 1);
  });
  checksum %= 103;

  const widths: number[] = [];
  for (const symbol of [CODE128_START_B, ...values, checksum]) {
    for (const digit of CODE128_WIDTHS[symbol]) widths.push(Number(digit));
  }
  for (const digit of CODE128_STOP) widths.push(Number(digit));

  return { widths, text };
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Redondea a dos decimales: el SVG no necesita más y se lee mejor. */
function mm(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * El QR en un solo `path`, con su margen de silencio de cuatro módulos. Se unen
 * los módulos oscuros de cada fila en tramos horizontales: el archivo pesa
 * menos y la impresora dibuja menos rectángulos.
 */
function qrPath(modules: boolean[][], quietZone = 4): string {
  const commands: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run += 1;
      commands.push(
        `M${x + quietZone} ${y + quietZone}h${run}v1h-${run}z`,
      );
      x += run;
    }
  });
  return commands.join("");
}

/**
 * La etiqueta en SVG, con las medidas reales en milímetros.
 *
 * Compone el QR a la izquierda, el nombre y la ubicación a su derecha y el
 * código de barras abajo, con el código escrito debajo para poder leerlo a mano
 * si la pistola falla. Sin código —un equipo al que todavía no se le ha puesto
 * uno— la etiqueta sale solo con el texto: mejor una etiqueta a medias que un
 * QR que no lleva a ninguna ficha.
 */
export function labelSvg(label: LabelData, size: LabelSize): string {
  const { widthMm, heightMm } = size;
  const padding = widthMm >= 60 ? 3 : 2;
  const barcodeHeight = heightMm >= 40 ? 7 : 5.5;
  const textBelowBarcode = heightMm >= 40 ? 2.6 : 2.2;
  const barcodeTop = heightMm - padding - textBelowBarcode - barcodeHeight;
  const qrSize = barcodeTop - padding - 1.5;
  const textLeft = padding + qrSize + 2;
  const textWidth = widthMm - textLeft - padding;

  const parts: string[] = [];
  parts.push(
    `<rect x="0" y="0" width="${mm(widthMm)}" height="${mm(heightMm)}" fill="#fff"/>`,
  );

  if (label.url !== "") {
    const qr = encodeQr(label.url);
    parts.push(
      `<g transform="translate(${mm(padding)} ${mm(padding)}) scale(${mm(
        qrSize / (qr.size + 8),
      )})">` +
        `<path d="${qrPath(qr.modules)}" fill="#000"/>` +
        `</g>`,
    );
  }

  // Nombre, en una o dos líneas según lo largo que sea.
  const titleSize = widthMm >= 60 ? 3.4 : 2.9;
  const maxChars = Math.max(6, Math.floor(textWidth / (titleSize * 0.52)));
  const words = label.title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  const titleLines = lines.length > 2 ? [lines[0], `${lines[1]}…`] : lines;

  let cursorY = padding + titleSize;
  for (const line of titleLines) {
    parts.push(
      `<text x="${mm(textLeft)}" y="${mm(cursorY)}" font-family="Helvetica, Arial, sans-serif" font-size="${mm(
        titleSize,
      )}" font-weight="700" fill="#000">${escapeXml(line)}</text>`,
    );
    cursorY += titleSize * 1.15;
  }

  if (label.subtitle) {
    parts.push(
      `<text x="${mm(textLeft)}" y="${mm(cursorY)}" font-family="Helvetica, Arial, sans-serif" font-size="${mm(
        titleSize * 0.78,
      )}" fill="#000">${escapeXml(label.subtitle)}</text>`,
    );
    cursorY += titleSize * 0.95;
  }

  if (label.location) {
    cursorY += 0.4;
    parts.push(
      `<text x="${mm(textLeft)}" y="${mm(cursorY)}" font-family="Helvetica, Arial, sans-serif" font-size="${mm(
        titleSize * 0.82,
      )}" fill="#000">Ubic. ${escapeXml(label.location)}</text>`,
    );
    cursorY += titleSize * 0.95;
  }

  if (label.acquiredOn) {
    parts.push(
      `<text x="${mm(textLeft)}" y="${mm(cursorY)}" font-family="Helvetica, Arial, sans-serif" font-size="${mm(
        titleSize * 0.7,
      )}" fill="#666">Alta ${escapeXml(label.acquiredOn)}</text>`,
    );
  }

  if (label.code !== "") {
    // El código de barras se ajusta al ancho útil: el ancho de un módulo sale
    // de repartir el hueco entre los módulos que lleva el símbolo.
    const barcode = code128Barcode(label.code);
    const modules = barcodeModules(barcode);
    const barcodeWidth = widthMm - padding * 2;
    const moduleWidth = barcodeWidth / modules;

    const bars: string[] = [];
    let x = padding;
    barcode.widths.forEach((width, index) => {
      const rendered = width * moduleWidth;
      // Los índices pares son barras (el primero siempre lo es); los impares,
      // huecos. Se dibujan solo las barras.
      if (index % 2 === 0) {
        bars.push(
          `M${mm(x)} ${mm(barcodeTop)}h${mm(rendered)}v${mm(
            barcodeHeight,
          )}h-${mm(rendered)}z`,
        );
      }
      x += rendered;
    });
    parts.push(`<path d="${bars.join("")}" fill="#000"/>`);
    parts.push(
      `<text x="${mm(widthMm / 2)}" y="${mm(
        barcodeTop + barcodeHeight + textBelowBarcode * 0.85,
      )}" text-anchor="middle" font-family="Courier New, monospace" font-size="${mm(
        textBelowBarcode,
      )}" fill="#000">${escapeXml(label.code)}</text>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(widthMm)}mm" height="${mm(
      heightMm,
    )}mm" viewBox="0 0 ${mm(widthMm)} ${mm(heightMm)}" shape-rendering="crispEdges">` +
    parts.join("") +
    `</svg>`
  );
}

/**
 * El documento que se manda a imprimir: una etiqueta por página, con el tamaño
 * del rollo en `@page`, sin márgenes y sin encabezados del navegador.
 *
 * `copies` repite la misma etiqueta para pegar varias —una por estante—; el
 * orden se conserva para que la primera que salga sea la que se estaba mirando.
 */
export function labelPrintDocument(
  labels: readonly LabelData[],
  options: { size: LabelSizeId; copies?: number },
): string {
  const size = labelSize(options.size);
  const copies = Math.max(1, Math.trunc(options.copies ?? 1));
  const sheets: string[] = [];
  for (const label of labels) {
    for (let copy = 0; copy < copies; copy += 1) {
      sheets.push(`<div class="sheet">${labelSvg(label, size)}</div>`);
    }
  }
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiquetas del taller</title>
<style>
  @page { size: ${mm(size.widthMm)}mm ${mm(size.heightMm)}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet {
    width: ${mm(size.widthMm)}mm;
    height: ${mm(size.heightMm)}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  svg { display: block; }
</style>
</head>
<body>${sheets.join("")}</body>
</html>`;
}
