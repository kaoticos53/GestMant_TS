import { describe, expect, test } from "vitest";
import { encodeQr, QR_MAX_VERSION } from "../src/lib/qr";

/**
 * El codificador de QR de las etiquetas.
 *
 * Lo que se comprueba aquí no es «que salga una matriz», sino que la matriz sea
 * la que leería un móvil. La prueba que manda es la primera: el código de un
 * texto corto, comparado módulo a módulo con el que produce un generador de
 * referencia externo (misma versión, misma máscara, misma corrección M). Si el
 * reparto de bits, la corrección de errores, la colocación o el formato se
 * torcieran, esa comparación dejaría de cuadrar.
 *
 * El resto vigila las piezas que la comparación no alcanza: que la versión
 * crezca con el contenido, que los patrones fijos estén donde manda la norma y
 * que la información de formato y de versión se pueda leer de vuelta.
 */

/**
 * El código de «pulso/taller» (versión 1, corrección M, máscara 2), copiado de
 * un generador de referencia externo.
 */
const REFERENCE = [
  "#######..###..#######",
  "#.....#.....#.#.....#",
  "#.###.#.###.#.#.###.#",
  "#.###.#.####..#.###.#",
  "#.###.#.##.##.#.###.#",
  "#.....#.#.#.#.#.....#",
  "#######.#.#.#.#######",
  "........#.###........",
  "#.#####...#.#.#####..",
  "....#..##...#..######",
  ".##..##.#..#.#...###.",
  "#.##.#.#.##..#.#.##..",
  ".##.#.#.##.#..#......",
  "........##..###.##.##",
  "#######.....#.....##.",
  "#.....#.#.#..#..###..",
  "#.###.#.#...#.#.##.##",
  "#.###.#.####.####.#..",
  "#.###.#.##.##..#.#...",
  "#.....#....###..###..",
  "#######.##.##.#.#..#.",
];

/** La matriz como texto, para compararla de un vistazo. */
const rows = (modules: boolean[][]) =>
  modules.map((row) => row.map((dark) => (dark ? "#" : ".")).join(""));

/** Los 15 bits del formato, leídos de la primera copia (la de arriba a la izquierda). */
function readFormat(modules: boolean[][]): number {
  let bits = 0;
  for (let i = 0; i < 15; i += 1) {
    let dark = false;
    if (i < 6) dark = modules[i][8];
    else if (i === 6) dark = modules[7][8];
    else if (i === 7) dark = modules[8][8];
    else if (i === 8) dark = modules[8][7];
    else dark = modules[8][14 - i];
    if (dark) bits |= 1 << i;
  }
  return bits;
}

/** Los 18 bits de la versión, leídos del bloque de arriba a la derecha. */
function readVersion(modules: boolean[][]): number {
  const size = modules.length;
  let bits = 0;
  for (let i = 0; i < 18; i += 1) {
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    if (modules[row][col]) bits |= 1 << i;
  }
  return bits;
}

describe("el codificador de QR", () => {
  test("coincide módulo a módulo con un generador de referencia", () => {
    const code = encodeQr("pulso/taller");
    expect(code.version).toBe(1);
    expect(code.size).toBe(21);
    expect(rows(code.modules)).toEqual(REFERENCE);
  });

  test("elige la versión más pequeña en la que cabe el contenido", () => {
    // La capacidad de la corrección M, versión a versión: 14, 26, 42, 62, 84,
    // 106, 122, 152, 180 y 213 bytes.
    const capacity = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
    for (let i = 0; i < capacity.length; i += 1) {
      const version = i + 1;
      expect(encodeQr("a".repeat(capacity[i])).version).toBe(version);
      if (i + 1 < capacity.length) {
        expect(encodeQr("a".repeat(capacity[i] + 1)).version).toBe(version + 1);
      }
    }
  });

  test("lo que no cabe en la versión máxima no se codifica a medias", () => {
    expect(() => encodeQr("a".repeat(214))).toThrow(QR_MAX_VERSION.toString());
    // Los bytes que cuenta son los de UTF-8, no los caracteres: una «ñ» ocupa
    // dos.
    expect(encodeQr("ñ".repeat(61)).version).toBe(7);
  });

  test("dibuja los patrones fijos donde manda la norma", () => {
    const { size, modules } = encodeQr("https://taller.local/dashboard?eq=EQ-1");

    // Los tres patrones de posición: el anillo de 7×7 con su separación.
    for (const [row, col] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]) {
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const ring = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(modules[row + r][col + c]).toBe(ring || core);
        }
      }
    }

    // Las dos líneas de sincronización, alternando.
    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }

    // El módulo oscuro de la norma, y un patrón de alineación abajo a la derecha.
    expect(modules[size - 8][8]).toBe(true);
    expect(modules[size - 7][size - 7]).toBe(true);
    expect(modules[size - 8][size - 7]).toBe(false);
  });

  test("la información de formato se lee de vuelta: corrección M y su máscara", () => {
    const code = encodeQr("https://taller.local/dashboard?eq=EQ-CAM-0042");
    const decoded = readFormat(code.modules) ^ 0x5412;
    // Los dos bits de nivel de corrección (M es 00) y los tres de la máscara.
    expect((decoded >> 13) & 0b11).toBe(0);
    expect((decoded >> 10) & 0b111).toBe(code.mask);
    // Y el BCH que la acompaña es el que toca, no solo unos bits cualesquiera.
    let remainder = decoded >> 10;
    for (let i = 0; i < 10; i += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    }
    expect(remainder & 0x3ff).toBe(decoded & 0x3ff);
  });

  test("desde la versión 7 lleva su número también en la matriz", () => {
    const code = encodeQr("a".repeat(122)); // versión 7
    expect(code.version).toBe(7);

    let remainder = 7;
    for (let i = 0; i < 12; i += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    }
    expect(readVersion(code.modules)).toBe((7 << 12) | remainder);
  });

  test("la matriz cambia con el contenido y es estable al repetirse", () => {
    const first = encodeQr("EQ-CAM-0042");
    const same = encodeQr("EQ-CAM-0042");
    const other = encodeQr("EQ-CAM-0043");
    expect(rows(first.modules)).toEqual(rows(same.modules));
    expect(rows(first.modules)).not.toEqual(rows(other.modules));
    expect(first.size).toBe(4 * first.version + 17);
    expect(first.modules).toHaveLength(first.size);
  });
});
