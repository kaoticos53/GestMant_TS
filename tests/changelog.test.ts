import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  getAllReleases,
  getLatestRelease,
  getReleaseByVersion,
  formatReleaseDate,
  getCategoryLabel,
} from "../src/lib/changelog";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));

describe("Bitácora de cambios entre versiones (src/lib/changelog.ts)", () => {
  const releases = getAllReleases();

  test("la lista de versiones contiene entregas registradas", () => {
    expect(releases.length).toBeGreaterThanOrEqual(5);
  });

  test("todas las versiones tienen formato SemVer válido (X.Y.Z)", () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    for (const r of releases) {
      expect(
        semverRegex.test(r.version),
        `La versión «${r.version}» no cumple formato SemVer X.Y.Z`,
      ).toBe(true);
    }
  });

  test("todas las entregas tienen una fecha válida en formato ISO YYYY-MM-DD", () => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of releases) {
      expect(
        isoDateRegex.test(r.date),
        `La fecha «${r.date}» de la versión ${r.version} no cumple YYYY-MM-DD`,
      ).toBe(true);

      const parsed = new Date(r.date);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    }
  });

  test("las versiones están ordenadas cronológicamente de más reciente a más antigua", () => {
    for (let i = 0; i < releases.length - 1; i++) {
      const actual = new Date(releases[i].date).getTime();
      const anterior = new Date(releases[i + 1].date).getTime();
      expect(
        actual,
        `La versión ${releases[i].version} (${releases[i].date}) debe ser posterior o igual a ${releases[i + 1].version} (${releases[i + 1].date})`,
      ).toBeGreaterThanOrEqual(anterior);
    }
  });

  test("cada entrega contiene título, resumen y cambios válidos", () => {
    const validCategories = new Set([
      "novedad",
      "mejora",
      "correccion",
      "seguridad",
    ]);

    for (const r of releases) {
      expect(r.title.trim().length).toBeGreaterThan(5);
      expect(r.summary.trim().length).toBeGreaterThan(10);
      expect(r.changes.length).toBeGreaterThan(0);

      for (const change of r.changes) {
        expect(validCategories.has(change.category)).toBe(true);
        expect(change.description.trim().length).toBeGreaterThan(5);
      }
    }
  });

  test("getLatestRelease devuelve la primera versión de la lista", () => {
    const latest = getLatestRelease();
    expect(latest.version).toBe(releases[0].version);
  });

  test("getReleaseByVersion resuelve con y sin prefijo 'v'", () => {
    const r1 = getReleaseByVersion("1.0.0");
    const r2 = getReleaseByVersion("v1.0.0");
    const r3 = getReleaseByVersion("V1.0.0");

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r3).toBeDefined();
    expect(r1?.version).toBe("1.0.0");
    expect(r2?.version).toBe("1.0.0");
    expect(r3?.version).toBe("1.0.0");

    expect(getReleaseByVersion("99.99.99")).toBeUndefined();
  });

  test("formatReleaseDate formatea correctamente en español", () => {
    expect(formatReleaseDate("2026-10-16")).toBe("16 de octubre de 2026");
    expect(formatReleaseDate("2026-10-15")).toBe("15 de octubre de 2026");
    expect(formatReleaseDate("2026-10-11")).toBe("11 de octubre de 2026");
  });

  test("getCategoryLabel devuelve el texto adecuado", () => {
    expect(getCategoryLabel("novedad")).toBe("Novedad");
    expect(getCategoryLabel("mejora")).toBe("Mejora");
    expect(getCategoryLabel("correccion")).toBe("Corrección");
    expect(getCategoryLabel("seguridad")).toBe("Seguridad");
  });

  test("cumplimiento estricto del Vocabulario Ubicuo (GLOSARIO.md)", () => {
    const forbiddenPatterns = [
      /\bticket\b/i,
      /\bavería\b/i,
      /\boperario\b/i,
      /\bmecánico\b/i,
      /\bsolicitud de material\b/i,
      /\bpedido interno\b/i,
    ];

    for (const r of releases) {
      const fullText = [
        r.title,
        r.summary,
        ...(r.highlights ?? []),
        ...r.changes.map((c) => `${c.description} ${c.tag ?? ""}`),
      ].join(" ");

      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(fullText),
          `Se detectó término prohibido ${pattern} en la versión ${r.version}: "${fullText}"`,
        ).toBe(false);
      }
    }
  });

  test("CHANGELOG.md existe y documenta todas las versiones del módulo", () => {
    const changelogPath = join(ROOT_DIR, "CHANGELOG.md");
    expect(existsSync(changelogPath)).toBe(true);

    const content = readFileSync(changelogPath, "utf8");
    for (const r of releases) {
      expect(
        content.includes(`## [${r.version}]`),
        `CHANGELOG.md debe incluir el encabezado para la versión [${r.version}]`,
      ).toBe(true);
      expect(
        content.includes(r.date),
        `CHANGELOG.md debe incluir la fecha ${r.date} para la versión ${r.version}`,
      ).toBe(true);
    }
  });
});
