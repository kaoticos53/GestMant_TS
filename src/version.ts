/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE. NO EDITAR DIRECTAMENTE.
 * Para modificar la versión principal edita el fichero `version.json` en la raíz.
 * El contador de build y los metadatos se calculan automáticamente al compilar (`npm run build`).
 */

export const APP_VERSION = "1.1.0";
export const BUILD_NUMBER = 138;
export const BUILD_TIME = "2026-11-22T09:12:27.673Z";
export const GIT_COMMIT = "60b2b47";

/** Versión resumida para UI (ej: "v1.0.0 (b1)") */
export const FULL_VERSION = "v1.1.0 (b138)";

/** Versión detallada con commit para diagnóstico o depuración (ej: "v1.0.0 (b1 · 440f2a6)") */
export const DETAILED_VERSION = "v1.1.0 (b138 · 60b2b47)";

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
