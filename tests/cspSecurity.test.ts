import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

describe("Seguridad AppSec: Higiene de CSP y SCA (Fase 3)", () => {
  test("package.json no contiene librerías huérfanas sin invocar (dompurify retirada)", () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
    expect(pkg.dependencies?.dompurify).toBeUndefined();
  });

  test("vite.config.ts contempla la limpieza de comodines localhost/127.0.0.1 en la CSP de producción", () => {
    const viteConfig = readFileSync(join(RAIZ, "vite.config.ts"), "utf8");
    expect(viteConfig).toContain("127\\.0\\.0\\.1");
    expect(viteConfig).toContain("localhost");
    expect(viteConfig).toContain("CWE-1188");
  });
});
