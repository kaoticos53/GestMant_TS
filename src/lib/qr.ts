/**
 * Codificador de QR, sin dependencias: lo justo para que una etiqueta del taller
 * lleve un código que cualquier móvil lea.
 *
 * Se escribe aquí —y no se importa una librería— por la misma razón que el
 * escritor de PDF (`lib/pdf`): la etiqueta se compone en el navegador, sin
 * servidor y sin conexión, y para una dirección corta no merece la pena
 * arrastrar un paquete más. Lo que se codifica son códigos de equipo y de
 * repuesto, y la dirección con la que se consultan: unas decenas de caracteres.
 *
 * Lo que se implementa es el modo **byte** (UTF-8), la corrección de errores
 * **M** —la que deja un 15 % de margen para que la etiqueta se lea con una
 * pegatina rozada o una esquina doblada— y las versiones **1 a 10** (hasta 213
 * bytes), que sobran para una etiqueta. Se elige la versión más pequeña en la
 * que cabe el contenido y la máscara que menos penaliza, como manda la norma.
 *
 * Lo que devuelve es la matriz de módulos, no un dibujo: quién la convierte en
 * SVG es `labelGenerator`, y quién decide el tamaño en milímetros, la vista de
 * impresión. Así el codificador se prueba sin navegador y sin píxeles.
 */

/** Un código listo para dibujar: la matriz de módulos y cómo se generó. */
export interface QrCode {
  /** Lado de la matriz en módulos (sin el margen de silencio). */
  size: number;
  /** La versión de la norma que se usó (1 a 10). */
  version: number;
  /** La máscara elegida (0 a 7). */
  mask: number;
  /**
   * Los módulos: `modules[fila][columna]`, `true` cuando el módulo es oscuro.
   * La fila 0 es la de arriba y la columna 0 la de la izquierda.
   */
  modules: boolean[][];
}

/** La versión más pequeña y la más grande que sabe codificar este módulo. */
export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 10;

/**
 * La corrección de errores M: 15 % de módulos recuperables. Las otras tres
 * (L, Q, H) no se ofrecen porque no hay dónde elegir: una etiqueta de estantería
 * se imprime pequeña y se roza, y con M cabe el contenido de sobra.
 */
const EC_LEVEL_BITS = 0b00; // 00 = M

/** Los bytes que caben en cada versión, por bloque, para la corrección M. */
interface EcSpec {
  /** Codewords de corrección por bloque. */
  ecPerBlock: number;
  /** Bloques de datos, en el orden en que se intercalan. */
  blocks: { count: number; dataCodewords: number }[];
}

/**
 * La tabla de bloques de la norma para la corrección M, versiones 1 a 10. Cada
 * versión reparte sus codewords de datos en uno o varios bloques —los grandes,
 * para que una mancha no se lleve el contenido entero— y añade los de
 * corrección.
 */
const EC_TABLE: Record<number, EcSpec> = {
  1: { ecPerBlock: 10, blocks: [{ count: 1, dataCodewords: 16 }] },
  2: { ecPerBlock: 16, blocks: [{ count: 1, dataCodewords: 28 }] },
  3: { ecPerBlock: 26, blocks: [{ count: 1, dataCodewords: 44 }] },
  4: { ecPerBlock: 18, blocks: [{ count: 2, dataCodewords: 32 }] },
  5: { ecPerBlock: 24, blocks: [{ count: 2, dataCodewords: 43 }] },
  6: { ecPerBlock: 16, blocks: [{ count: 4, dataCodewords: 27 }] },
  7: { ecPerBlock: 18, blocks: [{ count: 4, dataCodewords: 31 }] },
  8: {
    ecPerBlock: 22,
    blocks: [
      { count: 2, dataCodewords: 38 },
      { count: 2, dataCodewords: 39 },
    ],
  },
  9: {
    ecPerBlock: 22,
    blocks: [
      { count: 3, dataCodewords: 36 },
      { count: 2, dataCodewords: 37 },
    ],
  },
  10: {
    ecPerBlock: 26,
    blocks: [
      { count: 4, dataCodewords: 43 },
      { count: 1, dataCodewords: 44 },
    ],
  },
};

/**
 * Centros de los patrones de alineación de cada versión. Los de las esquinas
 * —los tres que caen sobre un patrón de posición— no se dibujan.
 */
const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** El modo byte: cuatro bits que anuncian que lo que viene son octetos. */
const MODE_BYTE = 0b0100;

/** Los bytes de relleno que cierra la norma cuando sobra sitio en el bloque. */
const PAD_BYTES = [0xec, 0x11];

/* ------------------------------------------------------------------ */
/* Aritmética de Galois (GF(256)), la de la corrección de errores      */
/* ------------------------------------------------------------------ */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// El polinomio primitivo del QR es x^8 + x^4 + x^3 + x^2 + 1 (0x11d).
for (let i = 0, x = 1; i < 255; i += 1) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * El polinomio generador de `degree` grados, sin el término principal (que
 * siempre es 1): los coeficientes que multiplican a cada resto.
 */
function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMultiply(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly.slice(1);
}

/** Los codewords de corrección de un bloque, por división de polinomios. */
function rsRemainder(data: readonly number[], ecLength: number): number[] {
  const generator = rsGenerator(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < ecLength; i += 1) {
      remainder[i] ^= gfMultiply(generator[i], factor);
    }
  }
  return remainder;
}

/* ------------------------------------------------------------------ */
/* Reparto del contenido en codewords                                  */
/* ------------------------------------------------------------------ */

/** Cuántos codewords de datos tiene una versión con la corrección M. */
function dataCodewords(version: number): number {
  return EC_TABLE[version].blocks.reduce(
    (total, block) => total + block.count * block.dataCodewords,
    0,
  );
}

/** Cuántos bits ocupa anunciar la longitud del contenido en esta versión. */
function lengthBits(version: number): number {
  // En las versiones 1 a 9 la longitud cabe en un byte; desde la 10, en dos.
  return version <= 9 ? 8 : 16;
}

/** La versión más pequeña en la que cabe `byteLength` bytes. */
function smallestVersion(byteLength: number): number {
  for (let version = QR_MIN_VERSION; version <= QR_MAX_VERSION; version += 1) {
    const capacityBits = dataCodewords(version) * 8;
    const needed = 4 + lengthBits(version) + byteLength * 8;
    if (needed <= capacityBits) return version;
  }
  throw new Error(
    `El contenido no cabe en un QR de la versión ${QR_MAX_VERSION} (${byteLength} bytes).`,
  );
}

/** El flujo de codewords de datos: modo, longitud, contenido y relleno. */
function dataCodewordStream(
  bytes: Uint8Array,
  version: number,
): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) {
      bits.push((value >>> i) & 1);
    }
  };

  push(MODE_BYTE, 4);
  push(bytes.length, lengthBits(version));
  for (const byte of bytes) push(byte, 8);

  const capacityBits = dataCodewords(version) * 8;
  // Terminador: hasta cuatro ceros, y si ya no cabe ninguno, ninguno.
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    codewords.push(value);
  }

  let pad = 0;
  while (codewords.length < dataCodewords(version)) {
    codewords.push(PAD_BYTES[pad % PAD_BYTES.length]);
    pad += 1;
  }
  return codewords;
}

/** Los codewords finales: bloques de datos intercalados con su corrección. */
function interleavedCodewords(
  bytes: Uint8Array,
  version: number,
): number[] {
  const spec = EC_TABLE[version];
  const stream = dataCodewordStream(bytes, version);

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const block of spec.blocks) {
    for (let i = 0; i < block.count; i += 1) {
      const data = stream.slice(offset, offset + block.dataCodewords);
      offset += block.dataCodewords;
      dataBlocks.push(data);
      ecBlocks.push(rsRemainder(data, spec.ecPerBlock));
    }
  }

  const total = [...dataBlocks, ...ecBlocks];
  const longestData = Math.max(...dataBlocks.map((block) => block.length));
  const result: number[] = [];
  for (let i = 0; i < longestData; i += 1) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of ecBlocks) result.push(block[i]);
  }

  // `total` solo sirve para que el compilador avise si alguna vez se separa del
  // tamaño que dice la norma.
  if (result.length !== total.reduce((sum, block) => sum + block.length, 0)) {
    throw new Error("El reparto de codewords del QR no cuadra.");
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* La matriz                                                           */
/* ------------------------------------------------------------------ */

/** Las máscaras de la norma: cada una invierte unos módulos y no otros. */
function maskApplies(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return false;
  }
}

/** Los 15 bits del formato: nivel de corrección, máscara y su BCH. */
function formatBits(mask: number): number[] {
  const data = (EC_LEVEL_BITS << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;
  return Array.from({ length: 15 }, (_, i) => (bits >>> i) & 1);
}

/** Los 18 bits de la información de versión, desde la 7. */
function versionBits(version: number): number[] {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  }
  const bits = (version << 12) | remainder;
  return Array.from({ length: 18 }, (_, i) => (bits >>> i) & 1);
}

/**
 * La penalización de una máscara: lo que la norma cuenta para elegir la que
 * deja el código más legible —rachas largas, bloques macizos, patrones que
 * parecen un patrón de posición y una proporción de negros desequilibrada—.
 */
function penalty(modules: readonly boolean[][]): number {
  const size = modules.length;
  let score = 0;

  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i += 1) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        if (get(i, j) === get(i, j - 1)) {
          run += 1;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  runs((row, col) => modules[row][col]);
  runs((row, col) => modules[col][row]);

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const color = modules[row][col];
      if (
        modules[row][col + 1] === color &&
        modules[row + 1][col] === color &&
        modules[row + 1][col + 1] === color
      ) {
        score += 3;
      }
    }
  }

  // Patrones que parecen un patrón de posición (1011101) con cuatro módulos
  // claros a un lado. El margen de silencio cuenta como claro: un patrón que
  // cae pegado al borde del símbolo también se penaliza, y pasarlo por alto es
  // justo lo que hace que dos implementaciones elijan máscaras distintas.
  const history = new Array<number>(7).fill(0);
  const addRun = (length: number) => {
    // El primer tramo de una línea va precedido del borde claro del símbolo.
    if (history[0] === 0) length += size;
    history.pop();
    history.unshift(length);
  };
  const countPatterns = () => {
    const n = history[1];
    const core =
      n > 0 &&
      history[2] === n &&
      history[3] === n * 3 &&
      history[4] === n &&
      history[5] === n;
    return (
      (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
      (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
    );
  };
  const scanLine = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i += 1) {
      history.fill(0);
      let color = false;
      let run = 0;
      for (let j = 0; j < size; j += 1) {
        if (get(i, j) === color) {
          run += 1;
        } else {
          addRun(run);
          if (!color) score += countPatterns() * 40;
          color = get(i, j);
          run = 1;
        }
      }
      if (color) {
        addRun(run);
        run = 0;
      }
      addRun(run + size);
      score += countPatterns() * 40;
    }
  };
  scanLine((row, col) => modules[row][col]);
  scanLine((row, col) => modules[col][row]);

  let dark = 0;
  for (const row of modules) {
    for (const module of row) if (module) dark += 1;
  }
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/**
 * Dibuja la matriz de una versión con su contenido. Devuelve la matriz sin
 * enmascarar los módulos de datos: el enmascarado y la elección de máscara se
 * hacen después, porque hay que probarlas todas.
 */
function buildBaseMatrix(
  version: number,
  bytes: Uint8Array,
): { modules: boolean[][]; isFunction: boolean[][] } {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFunction = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const set = (row: number, col: number, dark: boolean) => {
    modules[row][col] = dark;
    isFunction[row][col] = true;
  };

  const drawFinder = (row: number, col: number) => {
    for (let dr = -4; dr <= 4; dr += 1) {
      for (let dc = -4; dc <= 4; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const distance = Math.max(Math.abs(dr), Math.abs(dc));
        set(r, c, distance !== 2 && distance !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(3, size - 4);
  drawFinder(size - 4, 3);

  // Los dos patrones de sincronización: una fila y una columna a rayas.
  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Los patrones de alineación, en todas las combinaciones salvo las esquinas.
  const centers = ALIGNMENT_CENTERS[version];
  for (const row of centers) {
    for (const col of centers) {
      const onFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          set(row + dr, col + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // El módulo oscuro de la norma, pegado al patrón de posición de abajo.
  set(size - 8, 8, true);

  // El hueco del formato (las dos copias) y el de la versión, reservados antes
  // de repartir los datos: si no, los datos ocuparían su sitio.
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) set(i, 8, false);
    if (i !== 6) set(8, i, false);
  }
  set(8, 8, false);
  set(7, 8, false);
  for (let i = 0; i < 8; i += 1) set(8, size - 1 - i, false);
  for (let i = 0; i < 7; i += 1) set(size - 1 - i, 8, false);

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, false);
      set(a, b, false);
    }
  }

  // Los datos, en zigzag desde abajo a la derecha, saltando la columna 6.
  const bits: number[] = [];
  for (const codeword of interleavedCodewords(bytes, version)) {
    for (let i = 7; i >= 0; i -= 1) bits.push((codeword >>> i) & 1);
  }
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vertical : vertical;
        if (isFunction[row][col]) continue;
        // Los bits que sobran de la capacidad son ceros, como manda la norma.
        modules[row][col] = index < bits.length ? bits[index] === 1 : false;
        index += 1;
      }
    }
  }

  return { modules, isFunction };
}

/** Los bits del formato y de la versión, en sus dos copias. */
function applyFormatAndVersion(
  modules: boolean[][],
  version: number,
  mask: number,
): void {
  const size = modules.length;
  const format = formatBits(mask);
  for (let i = 0; i < 15; i += 1) {
    const dark = format[i] === 1;
    // Primera copia, alrededor del patrón de posición de arriba a la izquierda.
    if (i < 6) modules[i][8] = dark;
    else if (i === 6) modules[7][8] = dark;
    else if (i === 7) modules[8][8] = dark;
    else if (i === 8) modules[8][7] = dark;
    else modules[8][14 - i] = dark;

    // Segunda copia, repartida entre el lado derecho y el de abajo.
    if (i < 8) modules[8][size - 1 - i] = dark;
    else modules[size - 15 + i][8] = dark;
  }
  // El módulo oscuro de la norma, que la segunda copia deja al final.
  modules[size - 8][8] = true;

  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      modules[b][a] = bits[i] === 1;
      modules[a][b] = bits[i] === 1;
    }
  }
}

/**
 * Codifica `content` (UTF-8) en un QR con corrección M.
 *
 * Devuelve la matriz ya enmascarada y con su información de formato. Si el
 * contenido no cabe en la versión máxima, lanza un error con lo que ha pasado:
 * quien compone la etiqueta decide entonces si recorta la dirección o deja la
 * etiqueta sin QR, pero no se imprime un código que no se puede leer.
 */
export function encodeQr(content: string): QrCode {
  const bytes = new TextEncoder().encode(content);
  const version = smallestVersion(bytes.length);
  const { modules, isFunction } = buildBaseMatrix(version, bytes);
  const size = modules.length;

  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let best: boolean[][] | null = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = modules.map((row) => row.slice());
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!isFunction[row][col] && maskApplies(mask, row, col)) {
          candidate[row][col] = !candidate[row][col];
        }
      }
    }
    // La información de formato también cuenta para la penalización: la norma
    // elige la máscara mirando el símbolo completo.
    applyFormatAndVersion(candidate, version, mask);
    const score = penalty(candidate);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
      best = candidate;
    }
  }

  if (best === null) throw new Error("No se ha podido elegir máscara para el QR.");
  return { size, version, mask: bestMask, modules: best };
}
