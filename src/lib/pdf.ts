/**
 * Escritor de PDF mínimo, sin dependencias: lo justo para componer el parte de
 * una incidencia —texto con negritas, cursivas y tachados, listas, líneas,
 * tablas e imágenes— en un archivo que se abre en cualquier lector.
 *
 * Se apoya en las tipografías de base 14 (Helvetica y Courier), que todo lector
 * trae de serie: no hay que incrustar ningún archivo de fuente, así que el
 * archivo pesa lo que pesa su contenido. Los textos se escriben en WinAnsi, que
 * cubre el castellano y los signos que usa el parte («», —, ·, …).
 *
 * Las coordenadas de aquí se piensan como se compone una página: origen en la
 * esquina superior izquierda y el eje `y` hacia abajo. La conversión al sistema
 * del PDF —origen abajo a la izquierda— se hace dentro, en `flip`.
 *
 * Lo que este módulo no hace: decidir dónde va cada cosa. Eso es del maquetador
 * (`reportPdf.ts`), que solo necesita saber medir un texto para repartirlo en
 * líneas.
 */

/** Tipografías de base 14 que usa el parte. */
export type PdfFont = "regular" | "bold" | "italic" | "boldItalic" | "mono";

/** Color de 0 a 1 por canal. */
export type PdfColor = readonly [number, number, number];

/** Un JPEG listo para incrustar: el PDF no lo recomprime, lo mete tal cual. */
export interface PdfImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface PdfPageSize {
  width: number;
  height: number;
}

/** A4 en puntos: el tamaño del parte. */
export const A4: PdfPageSize = { width: 595.28, height: 841.89 };

const FONT_REFERENCES: Record<PdfFont, string> = {
  regular: "F1",
  bold: "F2",
  italic: "F3",
  boldItalic: "F4",
  mono: "F5",
};

const FONT_NAMES: Record<PdfFont, string> = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldItalic: "Helvetica-BoldOblique",
  mono: "Courier",
};

const FONTS: readonly PdfFont[] = [
  "regular",
  "bold",
  "italic",
  "boldItalic",
  "mono",
];

/**
 * Lo que WinAnsi escribe con un solo byte fuera de Latin-1: la puntuación
 * tipográfica que el editor deja al escribir (comillas, guiones, puntos
 * suspensivos). El resto de Latin-1 va tal cual, que coincide con WinAnsi.
 */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

/**
 * Texto → bytes WinAnsi. Lo que no cabe en WinAnsi sale como `?`: el parte se
 * escribe en castellano, así que lo que se pierde es un emoji suelto, no una
 * palabra.
 */
export function encodeWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const mapped = WIN_ANSI[char];
    if (mapped !== undefined) bytes.push(mapped);
    else if (code >= 0x20 && code <= 0x7e) bytes.push(code);
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code);
    else bytes.push(0x3f);
  }
  return bytes;
}

/** Número del PDF: sin más decimales de los que se ven. */
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Color de relleno o de trazo, según el operador que se use. */
function colorOp(color: PdfColor, stroke: boolean): string {
  const [r, g, b] = color;
  return `${num(r)} ${num(g)} ${num(b)} ${stroke ? "RG" : "rg"}`;
}

/**
 * Un literal de cadena del PDF: los tres caracteres que rompen la sintaxis
 * —paréntesis y barra invertida— se escapan y los de control se escriben en
 * octal. Los bytes de WinAnsi van tal cual —un PDF es bytes, no texto—, que es
 * lo que deja el archivo legible por dentro cuando hay que mirarlo.
 */
function literal(bytes: readonly number[]): string {
  let out = "(";
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += `\\${String.fromCharCode(byte)}`;
    } else if (byte < 0x20) {
      out += `\\${byte.toString(8).padStart(3, "0")}`;
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return `${out})`;
}

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((size, part) => size + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Una página del documento: las órdenes se van apuntando y se escriben al final. */
export class PdfPage {
  readonly width: number;
  readonly height: number;
  private readonly ops: string[] = [];
  /** Imágenes de esta página, por índice dentro del documento. */
  readonly images = new Set<number>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** `y` es la línea base del texto, contada desde arriba. */
  text(
    text: string,
    x: number,
    y: number,
    options: { font?: PdfFont; size?: number; color?: PdfColor } = {},
  ): void {
    const font = options.font ?? "regular";
    const size = options.size ?? 10.5;
    const color = options.color ?? [0, 0, 0];
    const bytes = encodeWinAnsi(text);
    if (bytes.length === 0) return;
    this.ops.push(
      `BT /${FONT_REFERENCES[font]} ${num(size)} Tf ${colorOp(
        color,
        false,
      )} ${num(x)} ${num(this.flip(y))} Td ${literal(bytes)} Tj ET`,
    );
  }

  /** Línea de `x1,y1` a `x2,y2`, en coordenadas de arriba hacia abajo. */
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: { color?: PdfColor; width?: number } = {},
  ): void {
    const color = options.color ?? [0, 0, 0];
    const width = options.width ?? 0.6;
    this.ops.push(
      `${colorOp(color, true)} ${num(width)} w ${num(x1)} ${num(
        this.flip(y1),
      )} m ${num(x2)} ${num(this.flip(y2))} l S`,
    );
  }

  /** Rectángulo relleno cuya esquina superior izquierda es `x,y`. */
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: { color?: PdfColor; border?: PdfColor } = {},
  ): void {
    const color = options.color ?? [0, 0, 0];
    this.ops.push(
      `${colorOp(color, false)} ${num(x)} ${num(this.flip(y + height))} ${num(
        width,
      )} ${num(height)} re f`,
    );
    if (options.border) {
      this.ops.push(
        `${colorOp(options.border, true)} 0.6 w ${num(x)} ${num(
          this.flip(y + height),
        )} ${num(width)} ${num(height)} re S`,
      );
    }
  }

  /**
   * Dibuja una imagen en el hueco que se le da (esquina superior izquierda).
   * La imagen en sí se registra en el documento al escribir el archivo, así que
   * aquí solo queda apuntado su índice.
   */
  drawImage(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.images.add(index);
    this.ops.push(
      `q ${num(width)} 0 0 ${num(height)} ${num(x)} ${num(
        this.flip(y + height),
      )} cm /Im${index} Do Q`,
    );
  }

  /** Flujo de contenido de la página, en ASCII. */
  content(): string {
    return this.ops.join("\n");
  }

  private flip(y: number): number {
    return this.height - y;
  }
}

/**
 * El documento: sus páginas y, al final, el archivo. Las imágenes se numeran
 * aquí, porque el número con el que se dibujan (`/Im0`) es el mismo con el que
 * se declaran en los recursos del archivo.
 */
export class PdfDocument {
  private readonly created: PdfPage[] = [];
  private readonly images: PdfImage[] = [];
  readonly size: PdfPageSize;

  constructor(size: PdfPageSize = A4) {
    this.size = size;
  }

  addPage(): PdfPage {
    const page = new PdfPage(this.size.width, this.size.height);
    this.created.push(page);
    return page;
  }

  get pageCount(): number {
    return this.created.length;
  }

  /**
   * Las páginas ya creadas. Hace falta para lo que solo se puede escribir
   * cuando se sabe cuántas hay: el pie de hoja («Página 3 de 7»).
   */
  get pages(): readonly PdfPage[] {
    return this.created;
  }

  /** Registra un JPEG y devuelve el número con el que se dibuja. */
  addImage(image: PdfImage): number {
    this.images.push(image);
    return this.images.length - 1;
  }

  /**
   * El archivo, byte a byte: cabecera, objetos, tabla de referencias y cierre.
   * Todo va sin comprimir —las imágenes ya vienen comprimidas de origen y el
   * texto del parte es corto—: un archivo que se lee con cualquier lector y que
   * se puede mirar por dentro si algo no cuadra.
   */
  toBytes(): Uint8Array {
    const pageCount = this.created.length;
    const pageIds = this.created.map((_, index) => 3 + index);
    const contentIds = this.created.map((_, index) => 3 + pageCount + index);
    const fontIds = new Map<PdfFont, number>(
      FONTS.map((font, index) => [font, 3 + 2 * pageCount + index]),
    );
    const imageIds = this.images.map(
      (_, index) => 3 + 2 * pageCount + FONTS.length + index,
    );

    const objects: Uint8Array[][] = [new Array<Uint8Array>()];
    objects[1] = [asciiBytes("<< /Type /Catalog /Pages 2 0 R >>")];
    objects[2] = [
      asciiBytes(
        `<< /Type /Pages /Kids [${pageIds
          .map((id) => `${id} 0 R`)
          .join(" ")}] /Count ${pageCount} >>`,
      ),
    ];

    this.created.forEach((page, index) => {
      const fonts = FONTS.map(
        (font) => `/${FONT_REFERENCES[font]} ${fontIds.get(font)} 0 R`,
      ).join(" ");
      const xobjects = [...page.images]
        .sort((a, b) => a - b)
        .map((imageIndex) => `/Im${imageIndex} ${imageIds[imageIndex]} 0 R`)
        .join(" ");
      objects[pageIds[index]] = [
        asciiBytes(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(
            page.width,
          )} ${num(page.height)}] /Resources << /Font << ${fonts} >>${
            xobjects ? ` /XObject << ${xobjects} >>` : ""
          } >> /Contents ${contentIds[index]} 0 R >>`,
        ),
      ];
      const content = asciiBytes(page.content());
      objects[contentIds[index]] = [
        asciiBytes(`<< /Length ${content.length} >>\nstream\n`),
        content,
        asciiBytes("\nendstream"),
      ];
    });

    FONTS.forEach((font) => {
      objects[fontIds.get(font) as number] = [
        asciiBytes(
          `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[font]} /Encoding /WinAnsiEncoding >>`,
        ),
      ];
    });

    this.images.forEach((image, index) => {
      objects[imageIds[index]] = [
        asciiBytes(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${
            image.height
          } /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
        ),
        image.bytes,
        asciiBytes("\nendstream"),
      ];
    });

    const parts: Uint8Array[] = [
      asciiBytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"),
    ];
    const offsets: number[] = [0];
    let position = parts[0].length;
    for (let id = 1; id < objects.length; id += 1) {
      const body = concatBytes(objects[id]);
      const head = asciiBytes(`${id} 0 obj\n`);
      const tail = asciiBytes("\nendobj\n");
      offsets[id] = position;
      parts.push(head, body, tail);
      position += head.length + body.length + tail.length;
    }

    const xrefStart = position;
    const xref = [
      `xref\n0 ${objects.length}\n`,
      "0000000000 65535 f \n",
      ...offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    ].join("");
    parts.push(
      asciiBytes(xref),
      asciiBytes(
        `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
      ),
    );

    return concatBytes(parts);
  }
}
