import { describe, expect, test } from "vitest";
import { richDocBlocks, richDocToStore, type RichBlock } from "../src/lib/richDoc";
import { describeBlockCounts, diffRichDoc } from "../src/lib/richDocDiff";

/** El texto de los trozos de un tipo, en orden: lo que se acaba pintando. */
const trozos = (parts: readonly { kind: string; text: string }[], kind: string) =>
  parts
    .filter((part) => part.kind === kind)
    .map((part) => part.text)
    .join("");

/** Los bloques del HTML de una nota, como los lee el historial. */
const doc = (value: string): RichBlock[] => richDocBlocks(value);

describe("diffRichDoc — dos versiones de una nota, bloque a bloque", () => {
  test("una nota que no cambió no tiene nada que contar", () => {
    const changes = diffRichDoc(doc("<p>Probado dos horas.</p>"), doc("<p>Probado dos horas.</p>"));
    expect(changes.blocksAdded).toBe(0);
    expect(changes.blocksRemoved).toBe(0);
    expect(changes.added).toBe(0);
    expect(changes.removed).toBe(0);
    expect(changes.parts).toEqual([{ kind: "same", text: "Probado dos horas." }]);
  });

  test("dentro de un párrafo se comparan las palabras, como siempre", () => {
    const changes = diffRichDoc(
      doc("<p>Probado dos horas.</p>"),
      doc("<p>Probado dos horas sin fallos.</p>"),
    );
    expect(changes.added).toBe(2);
    expect(changes.removed).toBe(0);
    expect(changes.blocksAdded).toBe(0);
    expect(changes.blocksRemoved).toBe(0);
    expect(trozos(changes.parts, "added")).toContain("sin fallos");
    expect(trozos(changes.parts, "same")).toContain("Probado dos horas");
  });

  test("un párrafo que apareció entero es un bloque añadido", () => {
    const changes = diffRichDoc(
      doc("<p>Probado en carga.</p>"),
      doc("<p>Probado en carga.</p><p>Sin fallos tras 30 minutos.</p>"),
    );
    expect(changes.blocksAdded).toBe(1);
    expect(changes.blocksRemoved).toBe(0);
    expect(changes.added).toBe(5);
    expect(trozos(changes.parts, "added")).toBe("Sin fallos tras 30 minutos.");
    // Cada bloque va en su línea: el párrafo que ya estaba y el que llegó.
    expect(trozos(changes.parts, "same")).toContain("\n");
  });

  test("un párrafo que se fue entero es un bloque quitado", () => {
    const changes = diffRichDoc(
      doc("<p>Probado en carga.</p><p>Anotado a las prisas.</p>"),
      doc("<p>Probado en carga.</p>"),
    );
    expect(changes.blocksAdded).toBe(0);
    expect(changes.blocksRemoved).toBe(1);
    expect(trozos(changes.parts, "removed")).toBe("Anotado a las prisas.");
  });

  test("una lista a la que se le añade un elemento no es un bloque nuevo", () => {
    const changes = diffRichDoc(
      doc("<ul><li>revisado el sello</li></ul>"),
      doc("<ul><li>revisado el sello</li><li>cambiado el filtro</li></ul>"),
    );
    expect(changes.blocksAdded).toBe(0);
    expect(changes.blocksRemoved).toBe(0);
    expect(trozos(changes.parts, "added")).toContain("cambiado el filtro");
    expect(trozos(changes.parts, "same")).toContain("revisado el sello");
  });

  test("un párrafo que pasa a ser una lista se lee como bloque quitado y añadido", () => {
    const changes = diffRichDoc(
      doc("<p>Fusible y filtro</p>"),
      doc("<ul><li>Fusible</li><li>Filtro</li></ul>"),
    );
    expect(changes.blocksRemoved).toBe(1);
    expect(changes.blocksAdded).toBe(1);
    expect(trozos(changes.parts, "removed")).toBe("Fusible y filtro");
    expect(trozos(changes.parts, "added")).toBe("Fusible\nFiltro");
  });

  test("una imagen que se añade se nombra, porque no se puede leer", () => {
    const changes = diffRichDoc(
      doc("<p>Antes:</p>"),
      doc('<p>Antes:</p><img src="https://taller/f.png" alt="foto">'),
    );
    expect(changes.blocksAdded).toBe(1);
    expect(trozos(changes.parts, "added")).toBe("[imagen: foto]");
  });

  test("una imagen que ya estaba sale como contexto, sin contarse", () => {
    const antes = doc('<p>Antes:</p><img src="https://taller/f.png" alt="foto">');
    const despues = doc(
      '<p>Antes:</p><img src="https://taller/f.png" alt="foto"><p>Después.</p>',
    );
    const changes = diffRichDoc(antes, despues);
    expect(changes.blocksAdded).toBe(1);
    expect(changes.blocksRemoved).toBe(0);
    expect(trozos(changes.parts, "same")).toContain("[imagen: foto]");
  });

  test("la nota vacía y la que tiene algo se comparan sin inventarse bloques", () => {
    const changes = diffRichDoc([], doc("<p>Cambio de fusible.</p>"));
    expect(changes.blocksAdded).toBe(1);
    expect(changes.blocksRemoved).toBe(0);
    expect(trozos(changes.parts, "added")).toBe("Cambio de fusible.");
  });

  test("lo que se guarda de una nota antigua se compara igual que lo nuevo", () => {
    // Una nota de siempre (texto plano) y su corrección con el editor: la
    // comparación no distingue de dónde viene cada versión.
    const antes = doc("Cambio de fusible.\nProbado en carga.");
    const despues = doc("<p>Cambio de fusible.</p><p>Probado en carga 30 minutos.</p>");
    const changes = diffRichDoc(antes, despues);
    expect(changes.blocksAdded).toBe(0);
    expect(changes.blocksRemoved).toBe(0);
    expect(trozos(changes.parts, "added")).toContain("30 minutos");
  });

  test("el resumen por bloques solo habla cuando apareció o se fue alguno", () => {
    const suma = diffRichDoc(doc("<p>Uno.</p>"), doc("<p>Uno.</p><p>Dos.</p><p>Tres.</p>"));
    expect(describeBlockCounts(suma)).toBe("2 bloques añadidos");
    const resta = diffRichDoc(doc("<p>Uno.</p><p>Dos.</p>"), doc("<p>Dos.</p>"));
    expect(describeBlockCounts(resta)).toBe("1 bloque quitado");
    const retoque = diffRichDoc(doc("<p>Uno.</p>"), doc("<p>Uno y medio.</p>"));
    expect(describeBlockCounts(retoque)).toBeNull();
  });

  test("el documento guardado se compara con sus bloques, no con su JSON", () => {
    const antes = richDocToStore("<p>Probado en carga.</p>")!;
    const despues = richDocToStore("<p>Probado en carga y descarga.</p>")!;
    const changes = diffRichDoc(richDocBlocks(antes), richDocBlocks(despues));
    expect(changes.parts.some((part) => part.text.includes("type"))).toBe(false);
    expect(trozos(changes.parts, "added")).toContain("y descarga");
  });
});
