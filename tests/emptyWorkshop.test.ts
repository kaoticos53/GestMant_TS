import { describe, expect, test } from "vitest";
import {
  readStartedEmpty,
  writeStartedEmpty,
} from "../src/lib/emptyWorkshop";
import type { WidthStorage } from "../src/lib/sidebar";

/** `localStorage` de mentira para probar la preferencia guardada. */
function fakeStorage(initial: Record<string, string> = {}): WidthStorage {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("empezar con el taller vacío", () => {
  test("sin nada guardado, la muestra se sigue ofreciendo", () => {
    expect(readStartedEmpty(fakeStorage())).toBe(false);
  });

  test("la elección se recuerda entre visitas", () => {
    const storage = fakeStorage();
    writeStartedEmpty(storage, true);
    expect(readStartedEmpty(storage)).toBe(true);
  });

  test("cargar la muestra vuelve a dejar el aviso disponible", () => {
    const storage = fakeStorage();
    writeStartedEmpty(storage, true);
    writeStartedEmpty(storage, false);
    expect(readStartedEmpty(storage)).toBe(false);
  });

  test("sin almacenamiento no falla: se comporta como si no hubiera elección", () => {
    expect(readStartedEmpty(null)).toBe(false);
    expect(() => writeStartedEmpty(null, true)).not.toThrow();
  });
});
