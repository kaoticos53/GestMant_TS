import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { emailOtp } from "../src/convex/auth/emailOtp";
import { backend } from "./backend";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

describe("Seguridad AppSec: Sesión, OTP y Clickjacking (Fase 2)", () => {
  test("el proveedor emailOtp configura una expiración reducida bajo NIST SP 800-63B (maxAge <= 300s)", () => {
    // maxAge configurado en las opciones no debe superar los 5 minutos (300 segundos)
    const options = (emailOtp as unknown as { options: { maxAge?: number } }).options;
    expect(options.maxAge).toBe(300);
  });

  test("emailOtp genera tokens aleatorios criptográficamente seguros", async () => {
    const generator = (
      emailOtp as unknown as {
        options: { generateVerificationToken: () => Promise<string> };
      }
    ).options.generateVerificationToken;
    expect(typeof generator).toBe("function");

    const token1 = await generator();
    const token2 = await generator();

    expect(token1).toHaveLength(6);
    expect(token2).toHaveLength(6);
    expect(token1).not.toBe(token2);
  });

  test("index.html carga el script externo de Frame Busting sin scripts inline (CWE-1021 y CSP script-src 'self')", () => {
    const html = readFileSync(join(RAIZ, "index.html"), "utf8");
    const frameBuster = readFileSync(
      join(RAIZ, "public", "frame-buster.js"),
      "utf8",
    );

    expect(html).toContain('<script src="/frame-buster.js"></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(frameBuster).toContain("window.top !== window.self");
    expect(frameBuster).toContain("window.top.location = window.self.location");
  });

  test("members.setRole y revokeSessions revocan inmediatamente authSessions y authRefreshTokens", async () => {
    const t = backend();
    const { adminId, techId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
      });
      const techId = await ctx.db.insert("users", {
        name: "Técnico",
        email: "tech@taller.es",
        role: "technician",
        active: true,
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId: techId,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 60_000,
      });
      return { adminId, techId };
    });

    const adminAuthed = t.withIdentity({ subject: `${adminId}|s-admin` });
    await adminAuthed.mutation(api.members.setRole, {
      userId: techId,
      role: "manager",
    });

    const afterRoleChange = await t.run(async (ctx) => ({
      sessions: await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", techId))
        .collect(),
      tokens: await ctx.db.query("authRefreshTokens").collect(),
    }));
    expect(afterRoleChange.sessions).toHaveLength(0);
    expect(afterRoleChange.tokens).toHaveLength(0);

    // Probar también revokeSessions manual por el propio usuario
    await t.run(async (ctx) => {
      const s2 = await ctx.db.insert("authSessions", {
        userId: techId,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId: s2,
        expirationTime: Date.now() + 60_000,
      });
    });
    const techAuthed = t.withIdentity({ subject: `${techId}|s-tech` });
    const res = await techAuthed.mutation(api.members.revokeSessions, {});
    expect(res.revoked).toBe(1);
    const remaining = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", techId))
        .collect(),
    );
    expect(remaining).toHaveLength(0);
  });

  test("otpLimits.admitSend bloquea el OTP bombing sobre la misma dirección", async () => {
    const t = backend();
    await t.mutation(internal.otpLimits.admitSend, {
      email: "Tecnico@Taller.es",
    });
    await expect(
      t.mutation(internal.otpLimits.admitSend, {
        email: "tecnico@taller.es",
      }),
    ).rejects.toThrow(/enviado un código recientemente/i);
  });
});
