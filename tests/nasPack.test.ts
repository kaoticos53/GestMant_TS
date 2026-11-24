import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildOfflineCompose,
  CONVEX_IMAGES,
  LOCAL_IMAGES,
  plannedImages,
  resolvePackConfig,
} from "../scripts/nas-pack-lib.mjs";

describe("nas-pack-lib", () => {
  it("resuelve flags y entorno con valores por defecto seguros", () => {
    const cfg = resolvePackConfig(
      ["--api-url", "https://api.rglara.com/", "--skip-convex-images"],
      {},
    );
    expect(cfg.apiUrl).toBe("https://api.rglara.com");
    expect(cfg.platform).toBe("linux/amd64");
    expect(cfg.outDir).toBe("dist-nas");
    expect(cfg.tarName).toBe("pulso-taller-imagenes.tar");
    expect(cfg.skipConvexImages).toBe(true);
  });

  it("planifica todas las imágenes o solo las locales si se omiten las de Convex", () => {
    expect(plannedImages(false)).toEqual([
      LOCAL_IMAGES.app,
      LOCAL_IMAGES.funciones,
      LOCAL_IMAGES.relevo,
      ...CONVEX_IMAGES,
    ]);
    expect(plannedImages(true)).toEqual([
      LOCAL_IMAGES.app,
      LOCAL_IMAGES.funciones,
      LOCAL_IMAGES.relevo,
    ]);
  });

  it("elimina bloques build y añade pull_policy: never en el compose de Synology", () => {
    const raw = readFileSync(
      join(process.cwd(), "docker", "synology", "docker-compose.yml"),
      "utf8",
    );
    const offline = buildOfflineCompose(raw);

    expect(offline).not.toMatch(/^\s{4}build:/m);
    expect(offline).toContain("image: pulso-taller-app:local\n    pull_policy: never");
    expect(offline).toContain(
      "image: ghcr.io/get-convex/convex-backend:latest\n    pull_policy: never",
    );
    expect(offline).toContain(
      "image: ghcr.io/get-convex/convex-dashboard:latest\n    pull_policy: never",
    );
    expect(offline).toContain("image: pulso-taller-funciones:local\n    pull_policy: never");
    expect(offline).toContain("image: pulso-taller-relevo:local\n    pull_policy: never");
    expect(offline).toContain(
      "./codigo/scripts/mail-relay-sandbox.mjs:/app/mail-relay-sandbox.mjs:ro",
    );
  });

  it("copia todos los módulos del relevo en la carpeta codigo/ del paquete", () => {
    const packScript = readFileSync(
      join(process.cwd(), "scripts", "nas-pack.mjs"),
      "utf8",
    );
    expect(packScript).toContain("mail-relay.mjs");
    expect(packScript).toContain("mail-relay-lib.mjs");
    expect(packScript).toContain("mail-relay-sandbox.mjs");
  });
});
