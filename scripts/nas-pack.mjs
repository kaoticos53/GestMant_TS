// Empaqueta todas las imágenes Docker de Pulso Taller en un `.tar` desde el PC
// para subirlo manualmente a Synology Container Manager y crear el proyecto allí.
//
//   npm run nas:pack -- --api-url https://api.rglara.com

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOfflineCompose,
  CONVEX_IMAGES,
  LOCAL_IMAGES,
  packUsage,
  plannedImages,
  resolvePackConfig,
} from "./nas-pack-lib.mjs";
import { apiModulesVerdict } from "./nas-setup-lib.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
};

function abort(text, hint) {
  console.error(`\n${c.red("✗")} ${text}`);
  if (hint) console.error(c.dim(hint));
  process.exit(1);
}

function runDocker(args, { capture = false } = {}) {
  const res = spawnSync("docker", args, {
    cwd: root,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
  });
  return res;
}

function hasLocalImage(image) {
  const res = runDocker(["image", "inspect", image], { capture: true });
  return res.status === 0;
}

const config = resolvePackConfig(process.argv.slice(2), process.env);

if (config.help) {
  console.log(packUsage());
  process.exit(0);
}

if (!config.apiUrl || !/^https?:\/\//i.test(config.apiUrl)) {
  abort(
    "Falta --api-url con la dirección pública de la API (p. ej. https://api.rglara.com).",
    "Vite graba VITE_CONVEX_URL dentro de la imagen `app` al compilar. Ejemplo:\n  npm run nas:pack -- --api-url https://api.rglara.com",
  );
}

console.log(c.bold("\nEmpaquetado offline para Synology Container Manager"));
console.log(c.dim(`API: ${config.apiUrl} · Plataforma: ${config.platform}\n`));

// 1. Verificar Docker y módulos generados
const infoRes = runDocker(["info"], { capture: true });
if (infoRes.status !== 0) {
  abort(
    "Docker no está disponible o el daemon no está arrancado.",
    "Abre Docker Desktop en Windows y vuelve a intentarlo.",
  );
}

const generatedApiPath = join(root, "src", "convex", "_generated", "api.d.ts");
const generatedApi = existsSync(generatedApiPath)
  ? readFileSync(generatedApiPath, "utf8")
  : "";
const verdict = apiModulesVerdict(root, generatedApi);
if (!verdict.ok) {
  abort(
    `Faltan módulos en src/convex/_generated/api.d.ts: ${verdict.missing.join(", ")}`,
    "Ejecuta primero `npm run convex:push` o `npx convex codegen` para regenerar el índice.",
  );
}
console.log(`${c.green("✓")} Índice de módulos Convex verificado`);

// 2. Construir las 3 imágenes locales
const buildSpecs = [
  {
    name: "app",
    image: LOCAL_IMAGES.app,
    args: [
      "build",
      "--platform",
      config.platform,
      "-f",
      "docker/synology/Dockerfile",
      "--build-arg",
      `VITE_CONVEX_URL=${config.apiUrl}`,
      "--build-arg",
      `VITE_TURNSTILE_SITE_KEY=${config.turnstileKey}`,
      "-t",
      LOCAL_IMAGES.app,
      ".",
    ],
  },
  {
    name: "funciones",
    image: LOCAL_IMAGES.funciones,
    args: [
      "build",
      "--platform",
      config.platform,
      "-f",
      "docker/synology/Dockerfile",
      "--target",
      "funciones",
      "-t",
      LOCAL_IMAGES.funciones,
      ".",
    ],
  },
  {
    name: "relevo",
    image: LOCAL_IMAGES.relevo,
    args: [
      "build",
      "--platform",
      config.platform,
      "-f",
      "docker/synology/Dockerfile",
      "--target",
      "relevo",
      "-t",
      LOCAL_IMAGES.relevo,
      ".",
    ],
  },
];

for (const spec of buildSpecs) {
  console.log(`\n${c.bold(`Construyendo ${spec.image}...`)}`);
  const res = runDocker(spec.args);
  if (res.status !== 0) {
    abort(`Falló la compilación de la imagen ${spec.image}.`);
  }
}

// 3. Comprobar o descargar las imágenes de Convex
if (!config.skipConvexImages) {
  console.log(`\n${c.bold("Comprobando imágenes de Convex...")}`);
  for (const image of CONVEX_IMAGES) {
    const localExists = hasLocalImage(image);
    if (localExists && !config.pull) {
      console.log(`   ${c.green("✓")} Usando copia local en Docker: ${image}`);
      continue;
    }

    console.log(`   Descargando ${image}...`);
    const pullRes = runDocker(["pull", "--platform", config.platform, image]);
    if (pullRes.status !== 0) {
      if (localExists) {
        console.log(
          `   ${c.yellow("!")} No se pudo descargar ${image}; se usa la copia local en caché.`,
        );
      } else {
        abort(
          `No se pudo descargar ${image} y no está en caché local.`,
          "Si ya tienes `backend` y `dashboard` en el NAS, vuelve a ejecutar con --skip-convex-images.",
        );
      }
    }
  }
}

// 4. Preparar carpeta de salida y exportar el .tar
const outDirAbs = resolve(root, config.outDir);
mkdirSync(outDirAbs, { recursive: true });
const tarPathAbs = join(outDirAbs, config.tarName);
const images = plannedImages(config.skipConvexImages);

console.log(`\n${c.bold(`Empaquetando ${images.length} imágenes en ${config.tarName}...`)}`);
const saveRes = runDocker(["save", "-o", tarPathAbs, ...images]);
if (saveRes.status !== 0) {
  abort(`No se pudo crear el archivo ${tarPathAbs}.`);
}
const sizeMb = (statSync(tarPathAbs).size / (1024 * 1024)).toFixed(1);
console.log(`   ${c.green("✓")} ${tarPathAbs} (${sizeMb} MB)`);

// 5. Generar docker-compose.yml offline, .env.example y archivos mínimos de montaje
const composeSrc = readFileSync(
  join(root, "docker", "synology", "docker-compose.yml"),
  "utf8",
);
const offlineCompose = buildOfflineCompose(composeSrc);
writeFileSync(join(outDirAbs, "docker-compose.yml"), offlineCompose, "utf8");
copyFileSync(
  join(root, "docker", "synology", ".env.example"),
  join(outDirAbs, ".env.example"),
);

// Archivos mínimos montados por `relevo` y `vigilante`
const codigoDir = join(outDirAbs, "codigo");
mkdirSync(join(codigoDir, "scripts"), { recursive: true });
copyFileSync(
  join(root, "scripts", "mail-relay.mjs"),
  join(codigoDir, "scripts", "mail-relay.mjs"),
);
copyFileSync(
  join(root, "scripts", "mail-relay-lib.mjs"),
  join(codigoDir, "scripts", "mail-relay-lib.mjs"),
);
cpSync(join(root, "src", "convex"), join(codigoDir, "src", "convex"), {
  recursive: true,
});

console.log(`   ${c.green("✓")} docker-compose.yml (sin build, con pull_policy: never)`);
console.log(`   ${c.green("✓")} .env.example y carpeta mínima codigo/`);

console.log(c.bold("\nPasos en Synology Container Manager:"));
console.log(`  1. Sube ${c.bold(config.tarName)} al NAS e impórtalo en:`);
console.log("     Container Manager → Imagen → Agregar → Desde archivo.");
console.log(
  `  2. Copia ${c.bold("docker-compose.yml")}, ${c.bold(".env.example")} y ${c.bold("codigo/")} a /volume1/docker/pulso-taller`,
);
console.log(
  "     (si ya tienes tu `.env` en el NAS, consérvalo; si es nuevo, renombra `.env.example` a `.env` y rellénalo).",
);
console.log(
  "  3. En Container Manager → Proyecto → Crear (o Construir/Reiniciar si ya existe), elige esa carpeta y arranca.",
);
console.log(
  "     Si es una actualización, asegúrate de iniciar el contenedor `funciones` una vez para subir el esquema.",
);
