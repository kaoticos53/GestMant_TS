import { describe, expect, test } from "vitest";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarWidth,
  maxSidebarWidth,
  readSidebarCollapsed,
  readSidebarWidth,
  writeSidebarCollapsed,
  writeSidebarWidth,
  type WidthStorage,
} from "../src/lib/sidebar";

/** `localStorage` de mentira para probar la preferencia guardada. */
function fakeStorage(initial: Record<string, string> = {}): WidthStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("clampSidebarWidth — ancho del menú lateral", () => {
  test("un ancho razonable se respeta tal cual", () => {
    expect(clampSidebarWidth(300, 1440)).toBe(300);
  });

  test("por debajo del mínimo se sube al mínimo", () => {
    expect(clampSidebarWidth(40, 1440)).toBe(SIDEBAR_WIDTH_MIN);
  });

  test("por encima del máximo se baja al máximo", () => {
    expect(clampSidebarWidth(900, 1440)).toBe(SIDEBAR_WIDTH_MAX);
  });

  test("en ventanas estrechas manda la proporción de la ventana", () => {
    // 40 % de 900 = 360, que está entre el mínimo y el máximo.
    expect(maxSidebarWidth(900)).toBe(360);
    expect(clampSidebarWidth(420, 900)).toBe(360);
    expect(clampSidebarWidth(200, 900)).toBe(SIDEBAR_WIDTH_MIN);
  });

  test("una ventana diminuta nunca deja el panel por debajo del mínimo", () => {
    expect(maxSidebarWidth(320)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampSidebarWidth(100, 320)).toBe(SIDEBAR_WIDTH_MIN);
  });

  test("un ancho no numérico cae al ancho de siempre", () => {
    expect(clampSidebarWidth(Number.NaN, 1440)).toBe(SIDEBAR_WIDTH_DEFAULT);
    expect(clampSidebarWidth(Number.POSITIVE_INFINITY, 1440)).toBe(
      SIDEBAR_WIDTH_DEFAULT,
    );
  });

  test("los píxeles con decimales se redondean", () => {
    expect(clampSidebarWidth(300.6, 1440)).toBe(301);
  });
});

describe("preferencia guardada del ancho", () => {
  test("se guarda y se recupera", () => {
    const storage = fakeStorage();
    expect(readSidebarWidth(storage)).toBeNull();
    writeSidebarWidth(storage, 312);
    expect(readSidebarWidth(storage)).toBe(312);
  });

  test("un valor corrupto no se usa", () => {
    expect(readSidebarWidth(fakeStorage({ "pulso:sidebar-width": "ancho" }))).toBeNull();
    expect(readSidebarWidth(fakeStorage({ "pulso:sidebar-width": "260px" }))).toBe(260);
  });

  test("sin almacenamiento (navegador que lo bloquea) no falla", () => {
    expect(readSidebarWidth(null)).toBeNull();
    expect(() => writeSidebarWidth(null, 300)).not.toThrow();
  });

  test("un almacenamiento que lanza no rompe el panel", () => {
    const broken: WidthStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(readSidebarWidth(broken)).toBeNull();
    expect(() => writeSidebarWidth(broken, 300)).not.toThrow();
  });
});

describe("menú plegado", () => {
  test("por defecto el menú se abre desplegado", () => {
    expect(readSidebarCollapsed(fakeStorage())).toBe(false);
    expect(readSidebarCollapsed(null)).toBe(false);
  });

  test("se recuerda plegado y se puede volver a desplegar", () => {
    const storage = fakeStorage();
    writeSidebarCollapsed(storage, true);
    expect(readSidebarCollapsed(storage)).toBe(true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });

  test("plegar no borra el ancho elegido", () => {
    const storage = fakeStorage();
    writeSidebarWidth(storage, 340);
    writeSidebarCollapsed(storage, true);
    expect(readSidebarWidth(storage)).toBe(340);
  });

  test("un valor desconocido se trata como desplegado", () => {
    expect(
      readSidebarCollapsed(fakeStorage({ "pulso:sidebar-collapsed": "quizá" })),
    ).toBe(false);
  });
});
