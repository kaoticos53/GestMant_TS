// Funciones puras para empaquetar las imágenes Docker de Pulso Taller en un
// archivo `.tar` listo para importar manualmente en Synology Container Manager.
// Sin dependencias de Node ni efectos secundarios para poder testearlo en memoria.

/** Imágenes externas del backend y panel de Convex. */
export const CONVEX_IMAGES = [
  "ghcr.io/get-convex/convex-backend:latest",
  "ghcr.io/get-convex/convex-dashboard:latest",
];

/** Imágenes locales construidas desde `docker/synology/Dockerfile`. */
export const LOCAL_IMAGES = {
  app: "pulso-taller-app:local",
  funciones: "pulso-taller-funciones:local",
  relevo: "pulso-taller-relevo:local",
};

const OFFLINE_PULL_IMAGES = new Set([
  LOCAL_IMAGES.app,
  LOCAL_IMAGES.funciones,
  LOCAL_IMAGES.relevo,
  ...CONVEX_IMAGES,
]);

/**
 * Parsea los argumentos CLI y variables de entorno para `npm run nas:pack`.
 *
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
export function resolvePackConfig(argv, env = {}) {
  const config = {
    apiUrl: env.NAS_API_URL ?? env.VITE_CONVEX_URL ?? "",
    turnstileKey: env.VITE_TURNSTILE_SITE_KEY ?? "",
    platform: env.NAS_PLATFORM ?? "linux/amd64",
    outDir: env.NAS_PACK_DIR ?? "dist-nas",
    tarName: env.NAS_PACK_TAR ?? "pulso-taller-imagenes.tar",
    skipConvexImages: false,
    pull: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      config.help = true;
    } else if (arg === "--skip-convex-images") {
      config.skipConvexImages = true;
    } else if (arg === "--pull") {
      config.pull = true;
    } else if (arg === "--api-url" && i + 1 < argv.length) {
      config.apiUrl = argv[++i];
    } else if (arg.startsWith("--api-url=")) {
      config.apiUrl = arg.slice("--api-url=".length);
    } else if (arg === "--turnstile-key" && i + 1 < argv.length) {
      config.turnstileKey = argv[++i];
    } else if (arg.startsWith("--turnstile-key=")) {
      config.turnstileKey = arg.slice("--turnstile-key=".length);
    } else if (arg === "--platform" && i + 1 < argv.length) {
      config.platform = argv[++i];
    } else if (arg.startsWith("--platform=")) {
      config.platform = arg.slice("--platform=".length);
    } else if (arg === "--out" && i + 1 < argv.length) {
      config.outDir = argv[++i];
    } else if (arg.startsWith("--out=")) {
      config.outDir = arg.slice("--out=".length);
    } else if (arg === "--tar" && i + 1 < argv.length) {
      config.tarName = argv[++i];
    } else if (arg.startsWith("--tar=")) {
      config.tarName = arg.slice("--tar=".length);
    }
  }

  config.apiUrl = config.apiUrl.trim().replace(/\/+$/, "");
  config.turnstileKey = config.turnstileKey.trim();
  config.platform = config.platform.trim() || "linux/amd64";
  config.outDir = config.outDir.trim() || "dist-nas";
  config.tarName = config.tarName.trim() || "pulso-taller-imagenes.tar";

  return config;
}

/**
 * Devuelve la lista de imágenes a incluir en el `.tar`.
 *
 * @param {boolean} skipConvexImages
 */
export function plannedImages(skipConvexImages) {
  const local = [
    LOCAL_IMAGES.app,
    LOCAL_IMAGES.funciones,
    LOCAL_IMAGES.relevo,
  ];
  return skipConvexImages ? local : [...local, ...CONVEX_IMAGES];
}

/**
 * Transforma `docker/synology/docker-compose.yml` en un compose offline listo
 * para Synology Container Manager: elimina los bloques `build:` (porque las
 * imágenes ya vienen cargadas desde el `.tar`) y fija `pull_policy: never` en
 * los 6 servicios principales para no depender de `ghcr.io`.
 *
 * @param {string} composeYaml
 */
export function buildOfflineCompose(composeYaml) {
  const lines = composeYaml.split(/\r?\n/);
  const output = [];
  let skippingBuild = false;

  for (const line of lines) {
    if (skippingBuild) {
      // Un bloque `build:` termina al encontrar otra clave del servicio (4 espacios + letra)
      if (/^    [a-zA-Z0-9_-]+:/.test(line)) {
        skippingBuild = false;
      } else {
        continue;
      }
    }

    if (/^    build:\s*(#.*)?$/.test(line)) {
      skippingBuild = true;
      continue;
    }

    output.push(line);

    const imageMatch = line.match(/^    image:\s*(\S+)\s*$/);
    if (imageMatch && OFFLINE_PULL_IMAGES.has(imageMatch[1])) {
      output.push("    pull_policy: never");
    }
  }

  return output.join("\n");
}

/** Texto de ayuda del comando `npm run nas:pack`. */
export function packUsage() {
  return [
    "Uso: npm run nas:pack -- --api-url https://api.tudominio.com [opciones]",
    "",
    "Construye todas las imágenes en tu PC, las exporta a un único `.tar` y deja",
    "un paquete listo para importar y crear el proyecto en Container Manager.",
    "",
    "Opciones:",
    "  --api-url <url>        URL pública de la API Convex (obligatoria; o NAS_API_URL)",
    "  --turnstile-key <key>  Clave pública de Cloudflare Turnstile (opcional)",
    "  --platform <arch>      Plataforma del NAS (por defecto: linux/amd64)",
    "  --out <carpeta>        Carpeta de salida (por defecto: dist-nas)",
    "  --tar <archivo>        Nombre del archivo .tar (por defecto: pulso-taller-imagenes.tar)",
    "  --skip-convex-images   No incluir backend/dashboard en el .tar (si ya están en el NAS)",
    "  --pull                 Intentar actualizar backend/dashboard desde ghcr.io",
    "  -h, --help             Muestra esta ayuda",
  ].join("\n");
}
