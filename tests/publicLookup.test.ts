import { describe, expect, test } from "vitest";
import {
  LOOKUP_LIMIT_PER_HOUR,
  LOOKUP_WINDOW_MS,
  admitLookup,
  expiredBefore,
  lookupLimitError,
} from "../src/lib/publicLookup";

/**
 * El freno de la consulta pública: cuántas veces se puede seguir un mismo código
 * por hora. Las cuentas se prueban aquí, sin base de datos; el adaptador que lee y
 * escribe la ventana lo prueban `tests/incidents.test.ts` y
 * `tests/guestAccess.test.ts` contra el esquema de verdad.
 */

const AHORA = Date.parse("2026-10-17T10:00:00.000Z");

describe("el freno de la consulta pública por código", () => {
  test("la primera consulta abre la ventana y cuenta una", () => {
    expect(admitLookup(undefined, AHORA)).toEqual({
      allowed: true,
      window: { windowStart: AHORA, count: 1 },
    });
  });

  test("dentro de la hora se cuenta hasta el límite, y la siguiente no pasa", () => {
    const casi = {
      windowStart: AHORA - 10 * 60 * 1000,
      count: LOOKUP_LIMIT_PER_HOUR - 1,
    };
    // La que llega justo al límite sí pasa: el cupo es de treinta, no de
    // veintinueve.
    expect(admitLookup(casi, AHORA)).toEqual({
      allowed: true,
      window: { windowStart: casi.windowStart, count: LOOKUP_LIMIT_PER_HOUR },
    });

    const frenado = admitLookup(
      { ...casi, count: LOOKUP_LIMIT_PER_HOUR },
      AHORA,
    );
    expect(frenado.allowed).toBe(false);
    if (frenado.allowed) return;
    // La ventana empezó hace diez minutos: quedan cincuenta de espera, y se dice.
    expect(frenado.retryInMinutes).toBe(50);
    expect(frenado.error).toContain(
      `${LOOKUP_LIMIT_PER_HOUR} consultas por hora`,
    );
    expect(frenado.error).toContain("50 minutos");
  });

  test("cumplida la hora se abre una ventana nueva, sin tocar nada a mano", () => {
    // Justo en el borde entra: la ventana terminó, no «casi».
    expect(
      admitLookup(
        {
          windowStart: AHORA - LOOKUP_WINDOW_MS,
          count: LOOKUP_LIMIT_PER_HOUR,
        },
        AHORA,
      ),
    ).toEqual({ allowed: true, window: { windowStart: AHORA, count: 1 } });
  });

  test("lo que queda de espera se redondea hacia arriba y nunca es cero", () => {
    // Medio minuto antes de cumplirse la hora: «1 minuto», que es lo que se lee
    // como un freno que sigue ahí («0 minutos» se lee como que ya no).
    const frenado = admitLookup(
      {
        windowStart: AHORA - LOOKUP_WINDOW_MS + 30_000,
        count: LOOKUP_LIMIT_PER_HOUR,
      },
      AHORA,
    );
    expect(frenado.allowed).toBe(false);
    if (frenado.allowed) return;
    expect(frenado.retryInMinutes).toBe(1);
    expect(lookupLimitError(1)).toContain("1 minuto.");
    expect(lookupLimitError(1)).not.toContain("1 minutos");
  });

  test("la frontera de caducidad de la purga es la misma que la del freno", () => {
    // La purga de la noche borra por fecha (`expiredBefore`), y lo que borra
    // tiene que ser exactamente lo que el freno ya ignora: la que empezó justo en
    // la frontera no cuenta —una consulta la reinicia desde cero—…
    expect(expiredBefore(AHORA)).toBe(AHORA - LOOKUP_WINDOW_MS);
    expect(
      admitLookup(
        {
          windowStart: expiredBefore(AHORA),
          count: LOOKUP_LIMIT_PER_HOUR,
        },
        AHORA,
      ),
    ).toEqual({ allowed: true, window: { windowStart: AHORA, count: 1 } });

    // …y la que empezó un milisegundo después sigue frenando: borrarla sería
    // devolverle el cupo a quien estaba esperando su hora.
    const frenado = admitLookup(
      {
        windowStart: expiredBefore(AHORA) + 1,
        count: LOOKUP_LIMIT_PER_HOUR,
      },
      AHORA,
    );
    expect(frenado.allowed).toBe(false);
  });

  test("un reloj que va hacia atrás no reabre la ventana", () => {
    // Un desfase de reloj —o una llamada con la hora de antes— no puede servir
    // para saltarse el cupo: la ventana sigue contando.
    const frenado = admitLookup(
      { windowStart: AHORA, count: LOOKUP_LIMIT_PER_HOUR },
      AHORA - 60 * 1000,
    );
    expect(frenado.allowed).toBe(false);
  });
});
