/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE. NO EDITAR DIRECTAMENTE.
 * Para modificar la versión principal edita el fichero `version.json` en la raíz.
 * El contador de build y los metadatos se calculan automáticamente al compilar (`npm run build`).
 */

export const APP_VERSION = "1.0.0";
export const BUILD_NUMBER = 12;
export const BUILD_TIME = "2026-10-13T13:53:02.123Z";
export const GIT_COMMIT = "586ac0f";

/** Versión resumida para UI (ej: "v1.0.0 (b1)") */
export const FULL_VERSION = "v1.0.0 (b12)";

/** Versión detallada con commit para diagnóstico o depuración (ej: "v1.0.0 (b1 · 440f2a6)") */
export const DETAILED_VERSION = "v1.0.0 (b12 · 586ac0f)";

export interface VersionInfo {
  version: string;
  build: number;
  buildTime: string;
  gitCommit: string;
  fullVersion: string;
  detailedVersion: string;
}

export const versionInfo: VersionInfo = {
  version: APP_VERSION,
  build: BUILD_NUMBER,
  buildTime: BUILD_TIME,
  gitCommit: GIT_COMMIT,
  fullVersion: FULL_VERSION,
  detailedVersion: DETAILED_VERSION,
};
