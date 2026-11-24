import { describe, expect, test } from "vitest";
import {
  MAIL_RETRY_DELAYS_MS,
  MAX_MAIL_ATTEMPTS,
  OUTBOX_STATUS_META,
  classifyMailFailure,
  nextRetryDelayMs,
} from "../src/lib/mailRetry";

describe("mailRetry (lógica pura Fase 1)", () => {
  test("clasifica errores transitorios como reintentables", () => {
    expect(
      classifyMailFailure(
        "No se pudo hablar con el servicio de correo (Relevo propio): fetch failed",
      ),
    ).toEqual({ retryable: true, reason: "transient" });

    expect(
      classifyMailFailure(
        "El servicio de correo (Resend) respondió HTTP 503: Service Unavailable",
      ),
    ).toEqual({ retryable: true, reason: "transient" });

    expect(
      classifyMailFailure("El servicio de correo (SendGrid) respondió HTTP 429"),
    ).toEqual({ retryable: true, reason: "transient" });

    expect(classifyMailFailure(undefined)).toEqual({
      retryable: true,
      reason: "transient",
    });
  });

  test("clasifica errores permanentes de configuración o rechazo 4xx/535 como no reintentables", () => {
    expect(
      classifyMailFailure(
        "El correo saliente está apagado en los ajustes del taller.",
      ),
    ).toEqual({ retryable: false, reason: "permanent" });

    expect(
      classifyMailFailure(
        "El servicio de correo (Relevo propio) respondió HTTP 401: Falta el testigo del relevo",
      ),
    ).toEqual({ retryable: false, reason: "permanent" });

    expect(
      classifyMailFailure("El servidor SMTP respondió 535 Authentication failed"),
    ).toEqual({ retryable: false, reason: "permanent" });
  });

  test("calcula el backoff exponencial y respeta MAX_MAIL_ATTEMPTS", () => {
    expect(MAX_MAIL_ATTEMPTS).toBe(4);
    expect(nextRetryDelayMs(1)).toBe(MAIL_RETRY_DELAYS_MS[0]); // 1 min
    expect(nextRetryDelayMs(2)).toBe(MAIL_RETRY_DELAYS_MS[1]); // 5 min
    expect(nextRetryDelayMs(3)).toBe(MAIL_RETRY_DELAYS_MS[2]); // 30 min
    expect(nextRetryDelayMs(4)).toBeNull();
    expect(OUTBOX_STATUS_META.retrying.label).toBe("Reintentando");
    expect(OUTBOX_STATUS_META.failed.label).toBe("Fallido");
  });
});
