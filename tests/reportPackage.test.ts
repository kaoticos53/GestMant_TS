import { describe, expect, test } from "vitest";
import { incidentReportPackageFilename } from "../src/lib/report";
import { parseReportMarkdown } from "../src/lib/reportPdf";
import {
  reportPackage,
  reportPhotos,
  type ReportLoadPhoto,
} from "../src/lib/reportPackage";
import { readZip } from "./zipReader";

/** Mediodía local del 9 de octubre de 2026. */
const ahora = new Date(2026, 9, 9, 12, 0, 0).getTime();

/** Una foto de verdad: sus primeros bytes bastan para saber de qué es. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);

/** El parte de una incidencia con fotos en las notas, como el de verdad. */
const markdown = [
  "# Incidencia INC-0004 · Cámara de estudio",
  "",
  "Avería descrita",
  "",
  "El obturador se queda bloqueado.",
  "",
  "Notas del cuaderno de vida",
  "",
  "**08 oct 2026, 17:38 · Nuria Cano**",
  "",
  "Se cambió el obturador y quedó estable.",
  "",
  "![canal-12.png](https://taller.example/storage/a1b2?token=xyz)",
  "",
  "**09 oct 2026, 09:18 · Iván Torres**",
  "",
  "Otra vuelta al conector.",
  "",
  "![daño en el foco.jpg](https://taller.example/storage/c3d4)",
  "",
  "Documentos adjuntos",
  "",
  "La misma foto se cita dos veces en el expediente: es una foto, no dos.",
  "",
  "![canal-12.png](https://taller.example/storage/a1b2?token=xyz)",
].join("\n");

/** El parte tal y como lo entregaría el paquete, con las fotos donde toque. */
const parte = (loadPhoto?: ReportLoadPhoto) =>
  reportPackage({
    markdown,
    markdownName: "parte-inc-0004-2026-10-09.md",
    loadPhoto,
    now: ahora,
  });

/** Trae las dos fotos; la tercera dirección, si se pide, no está. */
const traer =
  (perdida?: string): ReportLoadPhoto =>
  async (src) =>
    src === perdida ? null : src.includes("a1b2") ? PNG : JPG;

describe("las fotos que cita el parte", () => {
  test("salen en orden y la misma foto no cuenta dos veces", () => {
    expect(reportPhotos(markdown)).toEqual([
      {
        alt: "canal-12.png",
        src: "https://taller.example/storage/a1b2?token=xyz",
      },
      {
        alt: "daño en el foco.jpg",
        src: "https://taller.example/storage/c3d4",
      },
    ]);
  });

  test("son las mismas que maqueta el PDF: citadas una vez, en su orden", () => {
    // Lo que el paquete recoge y lo que el papel dibuja no pueden discrepar: si
    // el maquetador ve una imagen que el paquete no, esa foto se perdería.
    const maquetadas = [
      ...new Set(
        parseReportMarkdown(markdown)
          .filter((block) => block.type === "image")
          .map((block) => block.src),
      ),
    ];
    expect(reportPhotos(markdown).map((photo) => photo.src)).toEqual(
      maquetadas,
    );
  });

  test("un parte sin fotos no tiene nada que traer", () => {
    expect(reportPhotos("# Incidencia INC-0001\n\nSin fotos.\n")).toEqual([]);
  });
});

describe("el paquete del parte", () => {
  test("lleva el Markdown y cada foto dentro, con las rutas locales citadas", async () => {
    const pack = await parte(traer());
    const entries = readZip(pack.bytes);

    expect(entries.map((entry) => entry.name)).toEqual([
      "parte-inc-0004-2026-10-09.md",
      "fotos/01-canal-12.png",
      "fotos/02-dano-en-el-foco.jpg",
    ]);
    // Las fotos viajan tal y como están guardadas, sin recomprimir.
    expect(entries[1].bytes).toEqual(PNG);
    expect(entries[2].bytes).toEqual(JPG);
    // Y el Markdown que va dentro las cita por su ruta, que es la que funciona
    // en cuanto se descomprime.
    expect(entries[0].content).toBe(pack.markdown);
    expect(pack.markdown).toContain("![canal-12.png](fotos/01-canal-12.png)");
    expect(pack.markdown).toContain(
      "![daño en el foco.jpg](fotos/02-dano-en-el-foco.jpg)",
    );
    // La misma foto, citada dos veces, es un archivo y dos citas.
    expect(
      pack.markdown.split("![canal-12.png](fotos/01-canal-12.png)"),
    ).toHaveLength(3);
    expect(pack.photos.map((photo) => photo.bytes)).toEqual([
      PNG.length,
      JPG.length,
    ]);
    expect(pack.missing).toEqual([]);
  });

  test("del resto del parte no se toca ni una letra", async () => {
    const pack = await parte(traer());
    const soloFotos = (texto: string) =>
      texto.replace(/!\[[^\]]*\]\([^)]*\)/g, "FOTO");
    expect(soloFotos(pack.markdown)).toBe(soloFotos(markdown));
  });

  test("una foto que ya no está se dice en su sitio, y el parte se entrega igual", async () => {
    const pack = await parte(traer("https://taller.example/storage/c3d4"));

    expect(pack.missing).toEqual(["daño en el foco.jpg"]);
    expect(pack.markdown).toContain(
      "_[imagen no disponible: daño en el foco.jpg]_",
    );
    expect(readZip(pack.bytes).map((entry) => entry.name)).toEqual([
      "parte-inc-0004-2026-10-09.md",
      "fotos/01-canal-12.png",
    ]);
  });

  test("sin de dónde traerlas, el parte sale con las fotos citadas como ausentes", async () => {
    const pack = await parte();
    expect(pack.photos).toEqual([]);
    expect(pack.missing).toEqual(["canal-12.png", "daño en el foco.jpg"]);
    expect(pack.markdown).toContain("_[imagen no disponible: canal-12.png]_");
  });

  test("el paquete es un ZIP que se abre: sus bytes y su índice cuadran", async () => {
    const pack = await parte(traer());
    const bytes = Buffer.from(pack.bytes).toString("latin1");
    expect(bytes.startsWith("PK\u0003\u0004")).toBe(true);

    const view = new DataView(
      pack.bytes.buffer,
      pack.bytes.byteOffset,
      pack.bytes.byteLength,
    );
    const [entrada] = readZip(pack.bytes);
    // El CRC de cada archivo es el de sus bytes: sin eso el ZIP se abre roto.
    const tabla = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      tabla[index] = value >>> 0;
    }
    const crc = (datos: Uint8Array) => {
      let valor = 0xffffffff;
      for (const byte of datos)
        valor = tabla[(valor ^ byte) & 0xff] ^ (valor >>> 8);
      return (valor ^ 0xffffffff) >>> 0;
    };
    expect(view.getUint32(14, true)).toBe(
      crc(new TextEncoder().encode(entrada.content)),
    );
  });

  test("la misma entrega, dos veces, sale idéntica", async () => {
    const uno = await parte(traer());
    const otro = await parte(traer());
    expect(uno.bytes).toEqual(otro.bytes);
    expect(uno.markdown).toBe(otro.markdown);
  });
});

describe("el nombre del paquete", () => {
  test("lleva la referencia y el día, como el del informe", () => {
    expect(incidentReportPackageFilename("INC-0004", ahora)).toBe(
      "parte-inc-0004-2026-10-09.zip",
    );
  });
});
