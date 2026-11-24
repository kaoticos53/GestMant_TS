import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import {
  formatBackendError,
  formatUiError,
  getErrorMessage,
  isBackendDetailedErrors,
  isDetailedErrorsEnabled,
  sanitizeUserError,
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

    // Incluso un ConvexError con texto técnico se sanitiza en producción
    expect(
      getErrorMessage(
        new ConvexError(
          "El servicio de correo respondió HTTP 502: connect ECONNREFUSED 127.0.0.1:8788",
        ),
        { detailed: false },
      ),
    ).toBe(
      "No se pudo conectar con el servicio externo. Inténtalo de nuevo más tarde.",
    );

    consoleSpy.mockRestore();
  });

  test("sanitizeUserError, formatUiError y formatBackendError respetan APP_ENV", () => {
    expect(sanitizeUserError("Validator error: Missing field x")).toBe(
      "Se ha producido un error inesperado. Inténtalo de nuevo.",
    );
    expect(
      formatUiError("fetch failed (ECONNREFUSED)", { detailed: false }),
    ).toBe(
      "No se pudo conectar con el servicio externo. Inténtalo de nuevo más tarde.",
    );
    expect(
      formatUiError("fetch failed (ECONNREFUSED)", { detailed: true }),
    ).toBe("fetch failed (ECONNREFUSED)");

    expect(isBackendDetailedErrors("production", "development")).toBe(false);
    expect(isBackendDetailedErrors("development", "production")).toBe(true);
    expect(
      formatBackendError("El servicio respondió HTTP 502: ETIMEDOUT", {
        appEnv: "production",
      }),
    ).toBe(
      "No se pudo conectar con el servicio externo. Inténtalo de nuevo más tarde.",
    );
    expect(
      formatBackendError("El servicio respondió HTTP 502: ETIMEDOUT", {
        appEnv: "development",
      }),
    ).toBe("El servicio respondió HTTP 502: ETIMEDOUT");

    expect(
      sanitizeUserError(
        "No se pudo hablar con el relevo: error sending request for url (http://host.docker.internal:8788/enviar/comprobar): client error (Connect): tcp connect error: Network is unreachable (os error 101)",
      ),
    ).toBe(
      "No se pudo conectar con el servicio externo. Inténtalo de nuevo más tarde.",
    );
  });
});
