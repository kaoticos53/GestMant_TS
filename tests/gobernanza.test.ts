import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("gobernanza del typecheck y de las instrucciones", () => {
  test("el typecheck cubre la app y Convex, y la build no lo salta", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
      devDependencies: { typescript: string };
    };

    expect(pkg.scripts.typecheck).toContain("tsc -b --noEmit");
    expect(pkg.scripts.typecheck).toContain(
      "tsc -p src/convex/tsconfig.json --noEmit",
    );
    expect(pkg.scripts.build).toContain("npm run typecheck");
    expect(pkg.devDependencies.typescript).toMatch(/5\.9/);
  });

  test("la CI usa el comando real y no el no-op del tsconfig raíz", () => {
    const workflow = read(".github/workflows/security.yml");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).not.toContain("npx tsc --noEmit");
  });

  test("las instrucciones vigentes no vuelven a la ruta ni al comando antiguos", () => {
    const agents = read("AGENTS.md");
    const claude = read("CLAUDE.md");
    const cursor = read(".cursorrules");

    expect(agents).toContain("npm run typecheck");
    expect(agents).toContain("TypeScript 5.9");
    expect(agents).not.toContain("d:\\Users\\ricardo");
    expect(agents).not.toContain(
      "src/pages/dashboard/equipment/equipment.test.ts",
    );
    expect(claude).toContain("npm run typecheck");
    expect(claude).not.toContain("d:/Users/ricardo");
    expect(cursor).toContain("npm run typecheck");
  });
});
