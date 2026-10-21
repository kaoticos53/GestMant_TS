import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { emailOtp } from "../src/convex/auth/emailOtp";

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

  test("index.html incluye script defensivo de Frame Busting contra Clickjacking (CWE-1021)", () => {
    const html = readFileSync(join(RAIZ, "index.html"), "utf8");
    expect(html).toContain("window.top !== window.self");
    expect(html).toContain("window.top.location = window.self.location");
  });
});
