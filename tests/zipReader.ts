/**
 * Un lector de ZIP mínimo para las pruebas: el índice central del final, la
 * ficha de cada archivo y sus bytes, sin comprimir (que es como se escriben).
 * Sirve para comprobar lo que se entregaría sin depender de ninguna herramienta
 * de fuera.
 */
export interface ReadZipEntry {
  name: string;
  bytes: Uint8Array;
  content: string;
}

export function readZip(bytes: Uint8Array): ReadZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("el ZIP no cierra con su índice");

  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries: ReadZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error(`la ficha del archivo ${index} no está donde dice`);
    }
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const head = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    if (method !== 0) throw new Error(`${name} no va guardado sin comprimir`);
    if (view.getUint32(head, true) !== 0x04034b50) {
      throw new Error(`${name} no tiene su cabecera donde dice el índice`);
    }
    const start = head + 30 + view.getUint16(head + 26, true);
    const content = bytes.subarray(start, start + size);
    entries.push({
      name,
      bytes: content,
      content: new TextDecoder().decode(content),
    });
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true);
  }
  return entries;
}
