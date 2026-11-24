import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import {
  getErrorMessage,
  isDetailedErrorsEnabled,
} from "../src/lib/workshop";

describe("Visibilidad de errores por entorno (VITE_APP_ENV / PROD)", () => {
  test("oculta detalles en producción y los muestra en desarrollo", () => {
    expect(
      isDetailedErrorsEnabled({ VITE_APP_ENV: "production", DEV: true }),
    ).toBe(false);
    expect(
      isDetailedErrorsEnabled({ VITE_APP_ENV: "development", PROD: true }),
    ).toBe(true);
    expect(isDetailedErrorsEnabled({ PROD: true, DEV: false })).toBe(false);
    expect(isDetailedErrorsEnabled({ DEV: true })).toBe(true);
    expect(
      isDetailedErrorsEnabled({
        VITE_APP_ENV: "production",
        VITE_ERROR_DETAILS: "true",
      }),
    ).toBe(true);
  });

  test("getErrorMessage conserva mensajes de negocio y oculta errores técnicos en producción", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Error de negocio (ConvexError) siempre se muestra limpio
    expect(
      getErrorMessage(new ConvexError("Stock insuficiente"), {
        detailed: false,
      }),
    ).toBe("Stock insuficiente");

    // Error de negocio envuelto en Error de Convex siempre se extrae limpio
    expect(
      getErrorMessage(
        new Error(
          "[CONVEX M(partRequests:approve)] Uncaught ConvexError: Permiso denegado\n at handler",
        ),
        { detailed: false },
      ),
    ).toBe("Permiso denegado");

    // Error técnico: detallado en desarrollo, genérico en producción
    const techError = new Error(
      "[CONVEX M(incidents:close)] Server Error: TypeError: Cannot read properties of undefined",
    );
    expect(getErrorMessage(techError, { detailed: true })).toContain(
      "TypeError: Cannot read",
    );
    expect(getErrorMessage(techError, { detailed: false })).toBe(
      "Se ha producido un error inesperado. Inténtalo de nuevo.",
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});
