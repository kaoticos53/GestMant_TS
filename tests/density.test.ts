import { describe, expect, test } from "vitest";
import {
  DEFAULT_QUEUE_DENSITY,
  initialQueueDensity,
  otherDensity,
  readDensity,
  writeDensity,
  type DensityStorage,
} from "@/lib/density";

/** Un almacenamiento en memoria: lo mismo que `localStorage`, sin navegador. */
function memoryStorage(initial: Record<string, string> = {}): DensityStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/** Un almacenamiento que falla, como el de una ventana en modo privado. */
const brokenStorage: DensityStorage = {
  getItem: () => {
    throw new Error("sin acceso");
  },
  setItem: () => {
    throw new Error("sin acceso");
  },
};

describe("la densidad de una cola", () => {
  test("abre en compacta cuando no hay nada guardado", () => {
    expect(initialQueueDensity(memoryStorage())).toBe("compact");
    expect(initialQueueDensity(null)).toBe(DEFAULT_QUEUE_DENSITY);
  });

  test("recuerda lo que se eligió", () => {
    const storage = memoryStorage();
    writeDensity(storage, "comfortable");
    expect(readDensity(storage)).toBe("comfortable");
    writeDensity(storage, "compact");
    expect(readDensity(storage)).toBe("compact");
  });

  test("un valor que no se entiende no rompe la cola", () => {
    const storage = memoryStorage({ "pulso:queue-density": "gigante" });
    expect(readDensity(storage)).toBeNull();
    expect(initialQueueDensity(storage)).toBe("compact");
  });

  test("si el navegador bloquea el almacenamiento, se sigue usando igual", () => {
    expect(() => writeDensity(brokenStorage, "compact")).not.toThrow();
    expect(readDensity(brokenStorage)).toBeNull();
    expect(initialQueueDensity(brokenStorage)).toBe("compact");
  });

  test("la otra densidad es siempre la contraria", () => {
    expect(otherDensity("compact")).toBe("comfortable");
    expect(otherDensity("comfortable")).toBe("compact");
  });
});
