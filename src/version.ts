/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE. NO EDITAR DIRECTAMENTE.
 * Para modificar la versión principal edita el fichero `version.json` en la raíz.
 * El contador de build y los metadatos se calculan automáticamente al compilar (`npm run build`).
 */

export const APP_VERSION = "1.1.0";
export const BUILD_NUMBER = 80;
export const BUILD_TIME = "2026-10-22T18:53:38.531Z";
export const GIT_COMMIT = "91d2031";

/** Versión resumida para UI (ej: "v1.0.0 (b1)") */
export const FULL_VERSION = "v1.1.0 (b80)";

/** Versión detallada con commit para diagnóstico o depuración (ej: "v1.0.0 (b1 · 440f2a6)") */
export const DETAILED_VERSION = "v1.1.0 (b80 · 91d2031)";

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
