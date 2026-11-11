import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  POW_DEFAULT_BITS,
  hasLeadingZeroBits,
  signPowChallenge,
  solvePowChallenge,
  verifyPowSignature,
  verifyPowSolution,
} from "../src/lib/humanChallenge";
import { GLOBAL_INTAKE_LIMIT_PER_HOUR } from "../src/lib/incidentIntake";
import { MAX_UPLOADS_PER_HOUR } from "../src/convex/reportUploads";
import { backend } from "./backend";

const baseReportArgs = {
  reporterName: "Laura Peña",
  description: "La cámara del plató 1 pierde señal SDI de forma intermitente.",
  reportedAt: Date.now() - 60_000,
};

afterEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.PULSO_CHALLENGE_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("retos anti-bot invisibles (lib/humanChallenge)", () => {
  test("hasLeadingZeroBits comprueba los ceros iniciales en bytes", () => {
    expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x00, 0xff]), 16)).toBe(
      true,
    );
    expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x0f, 0xff]), 12)).toBe(
      true,
    );
    expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x10, 0xff]), 12)).toBe(
      false,
    );
  });

  test("firma HMAC, resolución PoW y Time-Trap funcionan correctamente", async () => {
    const secret = "test-pow-secret-32-bytes";
    const issuedAt = 1_000_000;
    const expiresAt = issuedAt + 60_000;
    const salt = "0011223344556677";
    const bits = 10;

    const signature = await signPowChallenge(secret, {
      salt,
      issuedAt,
      expiresAt,
      bits,
    });
    expect(
      await verifyPowSignature(
        secret,
        { salt, issuedAt, expiresAt, bits },
        signature,
      ),
    ).toBe(true);
    expect(
      await verifyPowSignature(
        "wrong-secret",
        { salt, issuedAt, expiresAt, bits },
        signature,
      ),
    ).toBe(false);

    const nonce = await solvePowChallenge(salt, bits);

    // Time-Trap: demasiado rápido (< 1500 ms)
    const tooFast = await verifyPowSolution({
      secret,
      salt,
      issuedAt,
      expiresAt,
      bits,
      signature,
      nonce,
      now: issuedAt + 200,
    });
    expect(tooFast.ok).toBe(false);

    // Válido tras el retardo mínimo
    const valid = await verifyPowSolution({
      secret,
      salt,
      issuedAt,
      expiresAt,
      bits,
      signature,
      nonce,
      now: issuedAt + 2_000,
    });
    expect(valid.ok).toBe(true);

    // Caducado
    const expired = await verifyPowSolution({
      secret,
      salt,
      issuedAt,
      expiresAt,
      bits,
      signature,
      nonce,
      now: expiresAt + 1,
    });
    expect(expired.ok).toBe(false);
  });
});

describe("protección en backend (Turnstile + PoW fallback + exención autenticada)", () => {
  test("con TURNSTILE_SECRET_KEY valida siteverify e impide reutilización (replay)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "cf-secret-test";
    const t = backend();

    // Sin token -> rechazado antes de tocar BD
    await expect(
      t.action(api.incidents.report, baseReportArgs),
    ).rejects.toThrow(/verificación de seguridad/i);

    await expect(
      t.action(api.reportUploads.generateUploadUrl, {}),
    ).rejects.toThrow(/verificación de seguridad/i);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const created = await t.action(api.incidents.report, {
      ...baseReportArgs,
      challenge: { kind: "turnstile", token: "tok-unico-1" },
    });
    expect(created.reference).toBe("INC-0001");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Reutilizar exactamente el mismo token Turnstile falla por anti-replay
    await expect(
      t.action(api.incidents.report, {
        ...baseReportArgs,
        reporterName: "Otra Persona",
        challenge: { kind: "turnstile", token: "tok-unico-1" },
      }),
    ).rejects.toThrow(/ya se había utilizado/i);
  });

  test("con PULSO_CHALLENGE_SECRET usa PoW como fallback y bloquea replay y envíos instantáneos", async () => {
    process.env.PULSO_CHALLENGE_SECRET = "pow-secret-local-test";
    const t = backend();

    const mode = await t.query(api.humanChallenge.mode, {});
    expect(mode.mode).toBe("pow");

    // Sin reto -> rechazado
    await expect(
      t.action(api.incidents.report, baseReportArgs),
    ).rejects.toThrow(/verificación automática/i);

    const issued = await t.action(api.humanChallenge.issuePow, {});
    expect(issued).not.toBeNull();
    expect(issued!.bits).toBe(POW_DEFAULT_BITS);

    const nonce = await solvePowChallenge(issued!.salt, issued!.bits);

    // Recién emitido (< 1500ms) dispara el Time-Trap
    await expect(
      t.action(api.incidents.report, {
        ...baseReportArgs,
        challenge: { kind: "pow", ...issued!, nonce },
      }),
    ).rejects.toThrow(/demasiado rápido/i);

    // Firmar un reto con issuedAt de hace 3s para probar aceptación + anti-replay
    const pastIssuedAt = Date.now() - 3_000;
    const pastExpiresAt = pastIssuedAt + 60_000;
    const pastSalt = "aabbccddeeff00112233445566778899";
    const pastSig = await signPowChallenge(process.env.PULSO_CHALLENGE_SECRET, {
      salt: pastSalt,
      issuedAt: pastIssuedAt,
      expiresAt: pastExpiresAt,
      bits: 10,
    });
    const pastNonce = await solvePowChallenge(pastSalt, 10);

    const upload = await t.action(api.reportUploads.generateUploadUrl, {
      challenge: {
        kind: "pow",
        salt: pastSalt,
        issuedAt: pastIssuedAt,
        expiresAt: pastExpiresAt,
        bits: 10,
        signature: pastSig,
        nonce: pastNonce,
      },
    });
    expect(upload.ticket).toMatch(/^[0-9a-f]{32}$/);

    // Reutilizar la misma prueba PoW queda bloqueado
    await expect(
      t.action(api.incidents.report, {
        ...baseReportArgs,
        challenge: {
          kind: "pow",
          salt: pastSalt,
          issuedAt: pastIssuedAt,
          expiresAt: pastExpiresAt,
          bits: 10,
          signature: pastSig,
          nonce: pastNonce,
        },
      }),
    ).rejects.toThrow(/ya se había utilizado/i);
  });

  test("usuarios autenticados quedan exentos del reto y de la cuota pública aunque esté agotada", async () => {
    process.env.TURNSTILE_SECRET_KEY = "cf-secret-test";
    const t = backend();
    const now = Date.now();

    const userId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        name: "Técnico Taller",
        email: "tecnico@taller.es",
        role: "technician",
        active: true,
      });
      // Llenar la cuota pública de incidencias y de subidas
      for (let i = 0; i < GLOBAL_INTAKE_LIMIT_PER_HOUR; i += 1) {
        await ctx.db.insert("incidents", {
          reference: `INC-FULL-${i}`,
          reporterName: `Visitante ${i}`,
          description: "Incidencia anónima que agota la cuota pública.",
          status: "reported",
          reportedAt: now - 1000,
          createdAt: now - 1000,
          updatedAt: now - 1000,
          history: [{ status: "reported", at: now - 1000, by: `Visitante ${i}` }],
        });
      }
      for (let i = 0; i < MAX_UPLOADS_PER_HOUR; i += 1) {
        await ctx.db.insert("reportUploads", {
          ticket: `ticket-${i}`,
          createdAt: now - 1000,
        });
      }
      return uid;
    });

    const authed = t.withIdentity({ subject: `${userId}|s1` });

    // El usuario autenticado puede crear incidencia y pedir subida sin token Turnstile
    const created = await authed.action(api.incidents.report, baseReportArgs);
    expect(created.reference).toMatch(/^INC-/);

    const upload = await authed.action(
      api.reportUploads.generateUploadUrl,
      {},
    );
    expect(upload.ticket).toMatch(/^[0-9a-f]{32}$/);
  });
});

