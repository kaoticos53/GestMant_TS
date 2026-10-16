import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VERSION_CONFIG_FILE = path.join(ROOT_DIR, 'version.json');
const VERSION_TS_FILE = path.join(ROOT_DIR, 'src', 'version.ts');

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'dev';
  }
}

function loadVersionConfig() {
  if (fs.existsSync(VERSION_CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(VERSION_CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[version] Advertencia al leer version.json: ${err.message}. Se usarán valores por defecto.`);
    }
  }

  return {
    version: '1.0.0',
    build: 0,
    lastBuildTime: '',
    gitCommit: '',
  };
}

export function updateVersion({ increment = false, quiet = false } = {}) {
  const config = loadVersionConfig();

  // Asegurar formato base
  if (typeof config.version !== 'string' || !config.version.trim()) {
    config.version = '1.0.0';
  }
  let currentBuild = Number.isInteger(config.build) && config.build >= 0 ? config.build : 0;

  if (increment) {
    currentBuild += 1;
  }

  const gitCommit = getGitCommit();
  const buildTime = new Date().toISOString();

  config.build = currentBuild;
  config.lastBuildTime = buildTime;
  config.gitCommit = gitCommit;

  // 1. Guardar version.json
  fs.writeFileSync(VERSION_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');

  // 2. Generar src/version.ts
  const fullVersion = `v${config.version} (b${config.build})`;
  const detailedVersion = `v${config.version} (b${config.build} · ${gitCommit})`;

  const tsContent = `/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE. NO EDITAR DIRECTAMENTE.
 * Para modificar la versión principal edita el fichero \`version.json\` en la raíz.
 * El contador de build y los metadatos se calculan automáticamente al compilar (\`npm run build\`).
 */

export const APP_VERSION = ${JSON.stringify(config.version)};
export const BUILD_NUMBER = ${config.build};
export const BUILD_TIME = ${JSON.stringify(buildTime)};
export const GIT_COMMIT = ${JSON.stringify(gitCommit)};

/** Versión resumida para UI (ej: "v1.0.0 (b1)") */
export const FULL_VERSION = ${JSON.stringify(fullVersion)};

/** Versión detallada con commit para diagnóstico o depuración (ej: "v1.0.0 (b1 · 440f2a6)") */
export const DETAILED_VERSION = ${JSON.stringify(detailedVersion)};

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
`;

  // Asegurar que src/ existe
  const srcDir = path.dirname(VERSION_TS_FILE);
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  fs.writeFileSync(VERSION_TS_FILE, tsContent, 'utf8');

  // 3. Comprobar presencia en la bitácora de cambios (CHANGELOG.md)
  const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    if (!changelogContent.includes(`## [${config.version}]`)) {
      console.warn(`[version] ADVERTENCIA: La versión ${config.version} no está registrada en CHANGELOG.md. Recuerda añadirla a la bitácora.`);
    }
  }

  if (!quiet) {
    console.log(`[version] ${increment ? 'Compilación registrada' : 'Versión sincronizada'}: ${detailedVersion}`);
  }

  return { config, fullVersion, detailedVersion };
}

// Ejecución directa desde CLI
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const shouldIncrement = args.includes('--increment') || args.includes('-i');
  const isQuiet = args.includes('--quiet') || args.includes('-q');
  updateVersion({ increment: shouldIncrement, quiet: isQuiet });
}
