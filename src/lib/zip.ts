/**
 * Un ZIP mínimo, sin dependencias: lo justo para entregar el parte con sus fotos
 * dentro y que se abra en cualquier sistema (Windows, macOS, Linux, el visor del
 * móvil).
 *
 * Los archivos se guardan tal cual (`store`, sin comprimir). Las fotos ya vienen
 * comprimidas —volver a comprimirlas no quita ni un byte— y el texto del parte
 * son unos pocos kilobytes, así que no compensa: componerlo así no depende de la
 * API de compresión del navegador, es síncrono y sale idéntico en cualquier
 * máquina, que es lo que se espera de algo que se firma y se guarda.
 */

/** La tabla de CRC-32, la que pide el formato para cada archivo. */
const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

/** El CRC-32 de unos bytes, sin signo. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Un archivo del paquete: su ruta dentro del ZIP y lo que lleva. */
export interface ZipEntry {
  /** La ruta dentro del paquete, con `/` como separador (`fotos/01-cara.png`). */
  name: string;
  bytes: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_RECORD = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
/** 2.0: lo mínimo que entiende cualquier lector, y sobra para `store`. */
const VERSION = 20;
/** Los nombres van en UTF-8: las fotos y los partes llevan acentos. */
const UTF8_NAMES = 0x0800;
/** `store`: sin comprimir. */
const METHOD_STORE = 0;

/**
 * La fecha y la hora en el formato del ZIP (DOS): dos bytes cada una. Antes de
 * 1980 no se puede escribir, así que se recorta —un paquete con fecha de 1970 no
 * lo abre nadie— y la hora va en pasos de dos segundos.
 */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1);
  const day =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, day: day & 0xffff };
}

/** Los trozos, uno detrás de otro. */
function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * Un ZIP con los archivos indicados, fechados como se diga. La fecha entra por
 * parámetro —y no se lee del reloj— para que el mismo parte, entregado dos veces
 * el mismo día, salga byte a byte igual.
 */
export function createZip(
  entries: readonly ZipEntry[],
  date: Date = new Date(),
): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const header = new Uint8Array(30 + name.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, LOCAL_HEADER, true);
    headerView.setUint16(4, VERSION, true);
    headerView.setUint16(6, UTF8_NAMES, true);
    headerView.setUint16(8, METHOD_STORE, true);
    headerView.setUint16(10, time, true);
    headerView.setUint16(12, day, true);
    headerView.setUint32(14, crc, true);
    headerView.setUint32(18, size, true); // comprimido
    headerView.setUint32(22, size, true); // sin comprimir
    headerView.setUint16(26, name.length, true);
    headerView.setUint16(28, 0, true); // sin campo extra
    header.set(name, 30);
    locals.push(header, entry.bytes);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, CENTRAL_RECORD, true);
    recordView.setUint16(4, VERSION, true); // quién lo escribió
    recordView.setUint16(6, VERSION, true); // qué hace falta para leerlo
    recordView.setUint16(8, UTF8_NAMES, true);
    recordView.setUint16(10, METHOD_STORE, true);
    recordView.setUint16(12, time, true);
    recordView.setUint16(14, day, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, size, true);
    recordView.setUint32(24, size, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint16(30, 0, true); // sin campo extra
    recordView.setUint16(32, 0, true); // sin comentario
    recordView.setUint16(34, 0, true); // en el primer disco
    recordView.setUint16(36, 0, true); // sin atributos internos
    recordView.setUint32(38, 0, true); // sin atributos externos
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);

    offset += header.length + size;
  }

  const centralSize = central.reduce((total, chunk) => total + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_OF_CENTRAL, true);
  endView.setUint16(4, 0, true); // este disco
  endView.setUint16(6, 0, true); // el disco del índice
  endView.setUint16(8, entries.length, true); // archivos en este disco
  endView.setUint16(10, entries.length, true); // archivos en total
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true); // sin comentario del paquete

  return concat(
    [...locals, ...central, end],
    offset + centralSize + end.length,
  );
}
