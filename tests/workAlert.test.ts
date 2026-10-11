import { describe, expect, it } from "vitest";

import {
  WORK_ALERT_STORAGE_KEY,
  dismissalOf,
  isDismissed,
  readDismissal,
  writeDismissal,
  type AlertStorage,
} from "@/lib/workAlert";

/** Almacenamiento de mentira: el navegador no hace falta para probar la regla. */
function fakeStorage(initial: Record<string, string> = {}): AlertStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("aviso de trabajo sin constancia: cerrarlo y volver a mostrarlo", () => {
  it("guarda las referencias limpias: sin repetidos, sin espacios y ordenadas", () => {
    const dismissal = dismissalOf([" INC-2 ", "INC-1", "INC-2", "  "], 3);
    expect(dismissal).toEqual({
      marginDays: 3,
      references: ["INC-1", "INC-2"],
    });
  });

  it("sin nada guardado no hay nada cerrado", () => {
    expect(readDismissal(fakeStorage())).toBeNull();
    expect(readDismissal(null)).toBeNull();
    expect(isDismissed(null, ["INC-1"], 3)).toBe(false);
  });

  it("va y vuelve del almacenamiento con el mismo contenido", () => {
    const storage = fakeStorage();
    const dismissal = dismissalOf(["INC-2", "INC-1"], 7);

    writeDismissal(storage, dismissal);

    expect(readDismissal(storage)).toEqual(dismissal);
    expect(JSON.parse(storage.data[WORK_ALERT_STORAGE_KEY])).toEqual(dismissal);
  });

  it("olvida lo cerrado cuando se pide volver a mostrarlo", () => {
    const storage = fakeStorage();
    writeDismissal(storage, dismissalOf(["INC-1"], 3));

    writeDismissal(storage, null);

    expect(readDismissal(storage)).toBeNull();
    expect(isDismissed(readDismissal(storage), ["INC-1"], 3)).toBe(false);
  });

  it("un valor guardado que no se entiende no esconde el aviso", () => {
    for (const raw of ["{", "null", "[]", '"3"', '[1,2]', '{"marginDays":3}']) {
      const storage = fakeStorage({ [WORK_ALERT_STORAGE_KEY]: raw });
      expect(readDismissal(storage)).toBeNull();
    }
  });

  it("sigue cerrado mientras se avise de lo mismo, con el mismo margen", () => {
    const dismissal = dismissalOf(["INC-1", "INC-2"], 3);

    expect(isDismissed(dismissal, ["INC-1", "INC-2"], 3)).toBe(true);
    // El orden no importa y una referencia ya vista no lo reabre.
    expect(isDismissed(dismissal, ["INC-2", "INC-1"], 3)).toBe(true);
    expect(isDismissed(dismissal, ["INC-1"], 3)).toBe(true);
  });

  it("vuelve cuando aparece trabajo parado que no se había visto", () => {
    const dismissal = dismissalOf(["INC-1", "INC-2"], 3);

    expect(isDismissed(dismissal, ["INC-1", "INC-2", "INC-3"], 3)).toBe(false);
    expect(isDismissed(dismissal, ["INC-3"], 3)).toBe(false);
  });

  it("vuelve cuando cambia el margen: lo avisado ya significa otra cosa", () => {
    const dismissal = dismissalOf(["INC-1"], 3);

    expect(isDismissed(dismissal, ["INC-1"], 5)).toBe(false);
  });
});
