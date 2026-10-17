import { readFileSync } from "node:fs";
import { nextRequestStatus } from "../src/lib/requestFlow";
import { purchaseOrderStatusAfterReceiving } from "../src/lib/purchaseFlow";

/**
 * El documento de las tres máquinas (`MAQUINAS.md`, en la raíz), leído como
 * datos: sus tablas de pasos —el estado del que sale cada paso, a dónde lleva y
 * las capacidades que nombra su columna «quién»— y sus dibujos.
 *
 * Vive aquí, y no dentro de una prueba, porque lo leen tres y no pueden leer cosas
 * distintas: `maquinas.test.ts` lo compara con las tablas del código —que sea el
 * dibujo de lo que hace la máquina—, `especificaciones.test.ts` hace lo mismo con
 * el documento de especificaciones, y `maquinasPermisos.test.ts` comprueba contra
 * él lo que el backend deja pasar, rol por rol. Con dos copias del lector, el día
 * que cambie el formato del documento una de las dos dejaría de leer filas y
 * seguiría en verde, que es justo lo que estas pruebas existen para evitar.
 *
 * Aquí vive también lo que deciden los tres igual: si el destino de un paso
 * depende de algo más que el estado del que sale (abajo).
 */

/** Una fila de una de las tablas del documento. */
export interface DocRow {
  /** El estado del que sale. */
  from: string;
  /** El paso, tal y como lo llama la máquina. */
  action: string;
  /** Lo que el documento cuenta después del paso, si cuenta algo. */
  wording: string;
  /** A dónde dice que lleva (o el destino que no es un estado fijo). */
  to: string;
  /** Las capacidades que el documento nombra entre acentos graves. */
  caps: string[];
  /**
   * La columna «quién» entera. La segunda puerta de las incidencias —«el técnico
   * asignado», que no es una capacidad sino una pregunta— va aquí en negrita, y
   * es lo que `maquinasPermisos.test.ts` mira para saber si el paso la tiene.
   */
  quien: string;
}

/** El documento, tal y como está escrito. */
export const MACHINES_DOC = readFileSync(
  new URL("../MAQUINAS.md", import.meta.url),
  "utf8",
);

/** El primer `token` entre acentos graves de una celda. */
function token(cell: string): string | null {
  return /`(\w+)`/.exec(cell)?.[1] ?? null;
}

/**
 * Las tablas del documento, por máquina. La cabecera es
 * `<nivel> Tabla de pasos — <máquina>` y de ahí cuelgan sus filas hasta la
 * siguiente cabecera: es lo que permite comprobar cada tabla contra su máquina.
 *
 * El nivel se pide porque los documentos las colocan a distinta profundidad: en
 * `MAQUINAS.md` cuelgan de la sección de cada máquina (`###`), y en las
 * especificaciones van dentro de su apartado (`####`). El resto del formato —las
 * cuatro columnas y su significado— es el mismo, y por eso se leen con el mismo
 * lector.
 */
export function documentedRows(
  queDoc: string = MACHINES_DOC,
  level = "###",
): Record<string, DocRow[]> {
  const tables: Record<string, DocRow[]> = {};
  const cabecera = new RegExp(`^${level} Tabla de pasos — (\\w+)$`);
  let current: string | null = null;
  for (const line of queDoc.split(/\r?\n/)) {
    const heading = cabecera.exec(line.trim());
    if (heading) {
      current = heading[1];
      tables[current] = tables[current] ?? [];
      continue;
    }
    if (current === null) continue;
    const cells = line.trim().split("|");
    if (cells.length !== 6) continue;
    const [from, paso, to, quien] = cells
      .slice(1, 5)
      .map((cell) => cell.trim());
    if (from === "desde" || from.startsWith("---")) continue;
    const fromToken = token(from);
    const step = /^`(\w+)`(?:\s+(.*))?$/.exec(paso);
    const toToken = token(to);
    if (fromToken === null || step === null || toToken === null) {
      throw new Error(`Fila sin estado, paso o destino: ${line.trim()}`);
    }
    tables[current].push({
      from: fromToken,
      action: step[1],
      wording: (step[2] ?? "").trim(),
      to: toToken,
      caps: [...quien.matchAll(/`(\w+)`/g)].map((match) => match[1]),
      quien,
    });
  }
  return tables;
}

/**
 * ¿El destino de este paso depende de algo más que el estado del que sale? Se
 * pregunta al código en vez de escribirlo a mano: si algún día reanudar volviera
 * siempre al mismo sitio, o una recepción ya no pudiera quedar a medias, los
 * documentos dejan de poder dar por bueno el destino abierto —`heldFrom`,
 * `allReceived`— y tendrán que decir un estado concreto.
 *
 * Lo leen `maquinas.test.ts` y `especificaciones.test.ts`: los dos documentos
 * tienen que permitirse y prohibirse lo mismo, y esa decisión no se escribe dos
 * veces.
 */
export function parametricDestination(
  machine: string,
  action: string,
): boolean {
  if (machine === "request" && action === "resume") {
    return (
      nextRequestStatus("onHold", "resume", "approved") !==
      nextRequestStatus("onHold", "resume", undefined)
    );
  }
  if (machine === "purchaseOrder" && action === "receive") {
    // Recibir todo de un artículo y nada de otro: completada, o parcial.
    const all = purchaseOrderStatusAfterReceiving([
      { quantity: 1, receivedQuantity: 1 },
    ]);
    const part = purchaseOrderStatusAfterReceiving([
      { quantity: 2, receivedQuantity: 1 },
    ]);
    return all !== part;
  }
  return false;
}

/**
 * Los diagramas del documento, en orden: uno por máquina. Se leen aparte de las
 * tablas porque un dibujo con una flecha de más no rompe nada —Mermaid pinta lo
 * que le digan— y ese error solo se ve mirándolo.
 */
export function diagrams(queDoc: string = MACHINES_DOC): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of queDoc.split(/\r?\n/)) {
    const text = line.trim();
    if (text === "```mermaid") {
      current = [];
      continue;
    }
    if (current === null) continue;
    if (text === "```") {
      blocks.push(current);
      current = null;
      continue;
    }
    current.push(text);
  }
  return blocks;
}
