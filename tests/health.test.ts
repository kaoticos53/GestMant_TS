import { describe, expect, test } from "vitest";
import { APP_VERSION, BUILD_NUMBER } from "../src/version";
import { backend } from "./backend";

/**
 * Las sondas de salud del taller: la de vida (`/healthz`) y la de
 * disponibilidad (`/readyz`).
 *
 * Se prueban como las llama un contenedor o un proxy —por HTTP, sin sesión—,
 * porque de eso se trata: de que contesten sin hablar Convex y sin contar nada
 * del taller. La sonda de disponibilidad recorre la consulta interna de verdad
 * contra el esquema, así que una tabla o un índice que falten la tumban.
 */

describe("sondas de salud", () => {
  test("`/healthz` contesta que el servicio está en pie, con su versión y sin caché", async () => {
    const t = backend();
    const response = await t.fetch("/healthz");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    // Un proxy que cachee la sonda deja de mirar el servicio.
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as {
      status: string;
      service: string;
      version: string;
      build: number;
      timestamp: number;
    };
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("pulso-taller");
    expect(body.version).toBe(APP_VERSION);
    expect(body.build).toBe(BUILD_NUMBER);
    expect(Number.isFinite(body.timestamp)).toBe(true);
  });

  test("`/readyz` lee la base y contesta que el taller puede trabajar", async () => {
    const t = backend();
    const response = await t.fetch("/readyz");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      checks: { database: { ok: boolean; latencyMs: number } };
    };
    expect(body.status).toBe("ready");
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("las sondas no cuentan nada del taller", async () => {
    const t = backend();
    const body = (await (await t.fetch("/readyz")).json()) as Record<
      string,
      unknown
    >;

    // Lo que se enseña es el estado y la versión: ni filas, ni personas, ni
    // configuración. Si algún día se añade algo más, esta prueba obliga a
    // pensarlo dos veces.
    expect(Object.keys(body).sort()).toEqual([
      "build",
      "checks",
      "service",
      "status",
      "timestamp",
      "version",
    ]);
  });
});
