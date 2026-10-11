import { describe, expect, test } from "vitest";

import {
  describeDiff,
  diffStats,
  diffTokens,
  diffWords,
  type DiffPart,
} from "../src/lib/textDiff";

/** Lo que se mantiene, tal cual, quitando las marcas del diff. */
const mismo = (parts: readonly DiffPart[]) =>
  parts
    .filter((part) => part.kind === "same")
    .map((part) => part.text)
    .join("");

/** El texto anterior reconstruido: lo que se mantiene más lo que se quitó. */
const anterior = (parts: readonly DiffPart[]) =>
  parts
    .filter((part) => part.kind !== "added")
    .map((part) => part.text)
    .join("");

/** El texto nuevo reconstruido: lo que se mantiene más lo que se añadió. */
const nuevo = (parts: readonly DiffPart[]) =>
  parts
    .filter((part) => part.kind !== "removed")
    .map((part) => part.text)
    .join("");

/** Las palabras añadidas, sin los huecos que las rodean. */
const anadido = (parts: readonly DiffPart[]) =>
  parts
    .filter((part) => part.kind === "added")
    .map((part) => part.text)
    .join("")
    .trim();

/** Las palabras quitadas, sin los huecos que las rodeaban. */
const quitado = (parts: readonly DiffPart[]) =>
  parts
    .filter((part) => part.kind === "removed")
    .map((part) => part.text)
    .join("")
    .trim();

describe("troceado del texto", () => {
  test("une las piezas y devuelve el texto original, espacios incluidos", () => {
    const texto = "  Probado con carga.\nSin fallos tras dos horas.  ";
    expect(diffTokens(texto).join("")).toBe(texto);
    expect(diffTokens("")).toEqual([]);
  });
});

describe("diferencias palabra a palabra", () => {
  test("un texto igual a sí mismo es todo lo mismo", () => {
    const parts = diffWords("Probado dos horas.", "Probado dos horas.");
    expect(parts).toEqual([{ kind: "same", text: "Probado dos horas." }]);
  });

  test("añadir al final de una frase no marca lo que ya estaba", () => {
    const parts = diffWords("Probado dos horas.", "Probado dos horas sin fallos.");
    // El punto final de la frase no forma parte de lo añadido: se queda igual.
    expect(parts).toEqual([
      { kind: "same", text: "Probado dos horas" },
      { kind: "added", text: " sin fallos" },
      { kind: "same", text: "." },
    ]);
    expect(quitado(parts)).toBe("");
    expect(nuevo(parts)).toBe("Probado dos horas sin fallos.");
    expect(anterior(parts)).toBe("Probado dos horas.");
    expect(diffStats(parts)).toEqual({ added: 2, removed: 0 });
  });

  test("marca la palabra que se quitó", () => {
    const parts = diffWords("Probado dos horas sin fallos.", "Probado dos horas.");
    expect(quitado(parts)).toBe("sin fallos");
    expect(anadido(parts)).toBe("");
    expect(anterior(parts)).toBe("Probado dos horas sin fallos.");
    expect(nuevo(parts)).toBe("Probado dos horas.");
    expect(diffStats(parts)).toEqual({ added: 0, removed: 2 });
  });

  test("una palabra cambiada se lee tachada y con la nueva detrás", () => {
    const parts = diffWords("El visor va lento.", "El visor va rápido.");
    expect(quitado(parts)).toBe("lento");
    expect(anadido(parts)).toBe("rápido");
    expect(parts.map((part) => part.kind)).toEqual([
      "same",
      "removed",
      "added",
      "same",
    ]);
    expect(anterior(parts)).toBe("El visor va lento.");
    expect(nuevo(parts)).toBe("El visor va rápido.");
    expect(diffStats(parts)).toEqual({ added: 1, removed: 1 });
  });

  test("lo que se mantiene entre medias no se toca", () => {
    // Dos cambios seguidos: cada uno se marca en su sitio y el resto de la
    // frase —incluido el «y quedó estable.» del final— no se toca.
    const parts = diffWords(
      "Se sustituyó el conector y quedó estable.",
      "Se sustituyó la fuente y quedó estable.",
    );
    expect(parts).toEqual([
      { kind: "same", text: "Se sustituyó " },
      { kind: "removed", text: "el" },
      { kind: "added", text: "la" },
      { kind: "same", text: " " },
      { kind: "removed", text: "conector" },
      { kind: "added", text: "fuente" },
      { kind: "same", text: " y quedó estable." },
    ]);
    expect(anterior(parts)).toBe("Se sustituyó el conector y quedó estable.");
    expect(nuevo(parts)).toBe("Se sustituyó la fuente y quedó estable.");
  });

  test("una corrección larga se marca palabra a palabra, no entera", () => {
    const antes =
      "Revisado el equipo en el banco: la fuente de alimentación estaba inflada y el ventilador no giraba.";
    const despues =
      "Revisado el equipo en el banco: la fuente de alimentación estaba inflada y el ventilador no giraba bien.";
    const parts = diffWords(antes, despues);
    // Solo se marca la última palabra, no todo el párrafo.
    expect(anadido(parts)).toBe("bien");
    expect(mismo(parts).endsWith("no giraba.")).toBe(true);
    expect(anterior(parts)).toBe(antes);
    expect(nuevo(parts)).toBe(despues);
  });

  test("separa por líneas sin perder los saltos de línea", () => {
    const antes = "Primera línea.\nSegunda línea.";
    const despues = "Primera línea.\nSegunda línea corregida.";
    const parts = diffWords(antes, despues);
    expect(nuevo(parts)).toBe(despues);
    expect(anterior(parts)).toBe(antes);
    // El punto final de la segunda línea sigue donde estaba.
    expect(mismo(parts)).toBe("Primera línea.\nSegunda línea.");
    expect(anadido(parts)).toBe("corregida");
  });

  test("los signos van aparte: un paréntesis o una coma se cambian solos", () => {
    expect(diffTokens("Hola, mundo.")).toEqual(["Hola", ",", " ", "mundo", "."]);
    const parts = diffWords("Cambiar (M4).", "Cambiar (M5).");
    expect(quitado(parts)).toBe("M4");
    expect(anadido(parts)).toBe("M5");
    // Un cambio de puntuación a secas también cuenta: la nota se tocó.
    const signos = diffWords("¿Listo?", "¿Listo!");
    expect(quitado(signos)).toBe("?");
    expect(anadido(signos)).toBe("!");
    expect(diffStats(signos)).toEqual({ added: 1, removed: 1 });
  });

  test("un texto que nace vacío es todo lo añadido, y al revés", () => {
    expect(diffWords("", "Nota nueva.")).toEqual([
      { kind: "added", text: "Nota nueva." },
    ]);
    expect(diffWords("Nota vieja.", "")).toEqual([
      { kind: "removed", text: "Nota vieja." },
    ]);
    expect(diffWords("", "")).toEqual([]);
    expect(diffStats([])).toEqual({ added: 0, removed: 0 });
  });

  test("los acentos y las mayúsculas son cambios de verdad", () => {
    const parts = diffWords("Cámara revisada.", "Camara revisada.");
    expect(quitado(parts)).toBe("Cámara");
    expect(anadido(parts)).toBe("Camara");
    const mayusculas = diffWords("visor ok", "Visor ok");
    expect(diffStats(mayusculas)).toEqual({ added: 1, removed: 1 });
    // Con el hueco entre medias, que no cuenta como palabra.
    expect(mismo(mayusculas)).toBe(" ok");
  });

  test("el mismo par de textos da siempre las mismas marcas", () => {
    const antes = "Uno dos tres cuatro cinco.";
    const despues = "Uno tres cuatro cinco seis.";
    expect(diffWords(antes, despues)).toEqual(diffWords(antes, despues));
    // Y las dos reconstrucciones cuadran con los originales.
    const parts = diffWords(antes, despues);
    expect(anterior(parts)).toBe(antes);
    expect(nuevo(parts)).toBe(despues);
  });

  test("un texto enorme no se compara palabra a palabra: se marca entero", () => {
    const antes = "palabraA ".repeat(700).trim();
    const despues = "palabraB ".repeat(700).trim();
    const parts = diffWords(antes, despues);
    expect(parts).toEqual([
      { kind: "removed", text: antes },
      { kind: "added", text: despues },
    ]);
  });
});

describe("resumen del cambio", () => {
  test("cuenta palabras, no huecos", () => {
    const parts = diffWords("Uno dos.", "Uno dos tres cuatro.");
    expect(diffStats(parts)).toEqual({ added: 2, removed: 0 });
    // Los espacios de más no cuentan como palabras.
    expect(
      diffStats(diffWords("Uno dos.", "Uno   dos.\n")),
    ).toEqual({ added: 0, removed: 0 });
  });

  test("se dice en castellano y en singular cuando toca", () => {
    expect(describeDiff({ added: 0, removed: 0 })).toBe("sin cambios");
    expect(describeDiff({ added: 3, removed: 0 })).toBe("3 palabras añadidas");
    expect(describeDiff({ added: 1, removed: 0 })).toBe("1 palabra añadida");
    expect(describeDiff({ added: 0, removed: 1 })).toBe("1 quitada");
    expect(describeDiff({ added: 0, removed: 2 })).toBe("2 quitadas");
    expect(describeDiff({ added: 4, removed: 2 })).toBe(
      "4 palabras añadidas · 2 quitadas",
    );
  });
});
