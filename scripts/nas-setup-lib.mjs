// Las piezas de la puesta en marcha del NAS que se pueden probar sin un NAS: la
// **configuración** (qué host, qué rutas, qué direcciones), el **guion que se
// ejecuta dentro del NAS** (pasos 1 a 5 de `SYNOLOGY.md`, idempotente) y el
// **panel final**, que termina siempre en la URL de la app.
//
// Viven aquí, y no en `nas-setup.mjs`, porque ese archivo habla por SSH con el
// NAS: importarlo desde una prueba intentaría conectarse. Al separarlas, el
// script y las pruebas usan exactamente el mismo texto y la misma regla, y el
// guion del NAS se puede ejecutar de verdad, con dobles en el `PATH`, para
// comprobar que repetirlo no cambia nada.
//
// No importa nada de Node a propósito: son funciones puras.

/** Colores del script; sin nada, el texto sale tal cual (como en las pruebas). */
const NO_COLOR = {
  bold: (text) => text,
  dim: (text) => text,
  green: (text) => text,
  red: (text) => text,
  yellow: (text) => text,
};

/** Nombre con el que la guía llama al proyecto en el NAS. */
export const DEFAULT_PROJECT_PATH = "/volume1/docker/pulso-taller";

/** La cuenta con la que se administra un Synology recién instalado. */
export const DEFAULT_USER = "admin";

/** El nombre de la instancia, igual que en `docker/synology/.env.example`. */
export const DEFAULT_INSTANCE = "pulso-taller";

/** El puerto donde escucha Docker dentro del NAS, para preguntarle si está sano. */
const BACKEND_HEALTH_URL = "http://127.0.0.1:3210/version";

/**
 * Cómo se pide cada opción. En la línea de órdenes manda el flag; si no está, se
 * mira la variable de entorno, para no tener que teclear el host del NAS en cada
 * arranque. Las seis se pueden fijar de las dos maneras.
 */
const VALUE_OPTIONS = {
  "--host": { key: "host", env: "NAS_HOST" },
  "--user": { key: "user", env: "NAS_USER" },
  "--port": { key: "port", env: "NAS_PORT" },
  "--path": { key: "root", env: "NAS_PATH" },
  "--app-url": { key: "appUrl", env: "NAS_APP_URL" },
  "--api-url": { key: "apiUrl", env: "NAS_API_URL" },
  "--instance": { key: "instance", env: "NAS_INSTANCE" },
};

/** Las opciones que no llevan valor: están o no están. */
const SWITCH_OPTIONS = {
  "--check": "check",
  "--doctor": "doctor",
  "--force-compose": "forceCompose",
  "--new-key": "newKey",
  "--no-build": "noBuild",
  "--help": "help",
  "-h": "help",
};

/** Lo que se explica al pedir ayuda; el nombre del comando, tal cual se teclea. */
export function usage(name = "npm run nas --") {
  return [
    "Puesta en marcha del taller en un NAS Synology, de una sola vez.",
    "",
    `${name} --host IP-del-NAS [opciones]`,
    `  ${name} --check --host IP-del-NAS`,
    `  ${name} --doctor --host IP-del-NAS`,
    `  ${name} --host 192.168.1.20 --app-url https://taller.mi-taller.es \\`,
    "    --api-url https://api.mi-taller.es",
    "",
    "Hace, en orden y sin nada a mano, los pasos 1 a 5 de SYNOLOGY.md: deja la",
    "carpeta del proyecto, lleva el código, escribe el docker-compose.yml y el",
    ".env (con su secreto), construye las imágenes, arranca los contenedores,",
    "pide la clave de administrador al backend y espera a que el contenedor de",
    "las funciones las suba. Se puede lanzar tantas veces como haga falta: lo que",
    "ya está hecho no se rehace ni se pisa, y los datos no se tocan nunca.",
    "",
    "Con --check no se cambia nada: mira cómo está el taller —los contenedores, el",
    ".env y si el esquema está al día— y lo cuenta. Ni construye ni arranca ni",
    "sube código: se puede lanzar en cualquier momento, también con gente dentro.",
    "",
    "Con --doctor se mira el entorno del NAS —dónde está el binario de Docker, si",
    "hace falta sudo y qué grupos y qué PATH tiene, si Compose lee el proyecto, qué",
    "contenedores hay y si se puede escribir donde van las copias— y se explica lo",
    "que falta antes de intentar nada. Tampoco cambia nada.",
    "",
    "Opciones:",
    "",
    "  --check                  solo mira cómo está el taller (contenedores, .env",
    "                           y esquema). No cambia nada",
    "  --doctor                 mira el entorno del NAS y explica lo que falta",
    "                           (Docker, sudo y sus grupos, Compose, contenedores y",
    "                           las copias). No cambia nada",
    "  --host IP-del-NAS        el NAS (también NAS_HOST)",
    "  --user admin             la cuenta con la que se entra (NAS_USER)",
    "  --port 22                el puerto de SSH (NAS_PORT)",
    `  --path ${DEFAULT_PROJECT_PATH}`,
    "                           la carpeta del proyecto (NAS_PATH)",
    "  --app-url https://taller.tudominio.com",
    "                           desde dónde se usa la app (NAS_APP_URL)",
    "  --api-url https://api.tudominio.com",
    "                           la dirección pública de la API (NAS_API_URL)",
    "  --instance pulso-taller  el nombre de la instancia (NAS_INSTANCE)",
    "  --force-compose          pisa el docker-compose.yml del NAS con el del",
    "                           repositorio (por defecto se conserva el suyo)",
    "  --new-key                pide otra clave de administrador aunque ya haya",
    "  --no-build               no reconstruye las imágenes: solo arranca lo que",
    "                           ya está construido (el código no se actualiza)",
    "  --help                   esto mismo",
    "",
    "Las direcciones solo hacen falta la primera vez: después manda el .env del",
    "NAS, que no se toca. Con --api-url o --app-url se cambia esa línea a mano.",
  ];
}

/**
 * La configuración completa, ya resuelta: los flags ganan a las variables de
 * entorno, y lo que no se diga se queda en el valor de partida. Devuelve también
 * los errores en vez de cortar: quien llama los enseña todos juntos, que es más
 * útil que arreglarlos de uno en uno.
 */
export function resolveConfig(argv = [], env = {}) {
  const config = {
    host: "",
    user: DEFAULT_USER,
    port: "22",
    root: DEFAULT_PROJECT_PATH,
    appUrl: "",
    apiUrl: "",
    instance: DEFAULT_INSTANCE,
    check: false,
    doctor: false,
    forceCompose: false,
    newKey: false,
    build: true,
    help: false,
    errors: [],
  };

  // Primero las variables de entorno: son el valor de partida.
  for (const option of Object.values(VALUE_OPTIONS)) {
    const value = env[option.env];
    if (typeof value === "string" && value.trim() !== "") {
      config[option.key] = value.trim();
    }
  }

  // Y después la línea de órdenes, que manda sobre ellas.
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument in SWITCH_OPTIONS) {
      config[SWITCH_OPTIONS[argument]] = true;
      continue;
    }
    const [name, inline] = argument.split("=");
    const option = VALUE_OPTIONS[name];
    if (option) {
      const value = inline ?? argv[index + 1];
      if (value === undefined) {
        config.errors.push(`${name} necesita un valor`);
        continue;
      }
      if (inline === undefined) index += 1;
      config[option.key] = value.trim();
      continue;
    }
    config.errors.push(`no conozco la opción ${argument}`);
  }

  if (config.noBuild) config.build = false;
  delete config.noBuild;

  // Mirar y cambiar son dos cosas distintas: ni --check ni --doctor cambian nada,
  // así que no hay nada que forzar ni clave que pedir, y prometerlo sería peor que
  // no aceptarlo.
  const soloMira = config.check ? "--check" : config.doctor ? "--doctor" : null;
  const noCheck = [
    config.forceCompose ? "--force-compose" : null,
    config.newKey ? "--new-key" : null,
  ].filter(Boolean);
  if (soloMira && noCheck.length > 0) {
    config.errors.push(
      `${soloMira} no cambia nada, así que no se combina con ${noCheck.join(" ni ")}`,
    );
  }
  // Y son dos miradas distintas: el doctor mira el entorno —Docker, sudo, las
  // copias— y la comprobación mira el taller. Juntas no dicen más, dicen menos.
  if (config.check && config.doctor) {
    config.errors.push(
      "--doctor y --check miran cosas distintas: lánzalos por separado",
    );
  }

  // El puerto tiene que ser un puerto, y la carpeta tiene que ser absoluta: las
  // dos cosas se comprueban aquí porque un dedazo se paga más tarde y peor.
  if (
    !/^[0-9]+$/.test(config.port) ||
    Number(config.port) < 1 ||
    Number(config.port) > 65535
  ) {
    config.errors.push(`el puerto de SSH no vale: ${config.port}`);
  }
  config.root = normalizeProjectPath(config.root);
  if (!config.root.startsWith("/")) {
    config.errors.push(
      `la carpeta del proyecto tiene que ser absoluta: ${config.root}`,
    );
  }
  if (/[\s'"]/.test(config.root)) {
    config.errors.push(
      `la carpeta del proyecto no puede llevar espacios ni comillas: ${config.root}`,
    );
  }

  if (!config.help) {
    if (config.host === "") {
      config.errors.push("falta el NAS: --host IP-del-NAS (o NAS_HOST)");
    } else if (/[\s@:]/.test(config.host)) {
      config.errors.push(
        `el host no lleva usuario ni puerto, solo la dirección: ${config.host}`,
      );
    }
    for (const [key, label] of [
      ["appUrl", "--app-url"],
      ["apiUrl", "--api-url"],
    ]) {
      if (config[key] === "") continue;
      const clean = config[key].replace(/\/+$/, "");
      if (!/^https?:\/\/[^\s/]+$/.test(clean)) {
        config.errors.push(
          `${label} tiene que ser una dirección completa sin camino ni barra al final, como https://api.tudominio.com`,
        );
        continue;
      }
      config[key] = clean;
    }
  }

  return config;
}

/** La carpeta del proyecto, sin la barra del final (y sin dejarla vacía). */
export function normalizeProjectPath(path) {
  const clean = String(path ?? "")
    .trim()
    .replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/** Un valor tal cual para la shell, entre comillas simples. */
export function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * El guion con finales de linea de Unix, venga como venga.
 *
 * Los guiones del NAS se editan en Windows y corren en el `sh` de Linux de los
 * contenedores, y ahi un `\r` no es un espacio en blanco: deja el `#!` como
 * `#!/bin/sh\r`, asi que la shell busca un interprete que se llama `/bin/sh\r`
 * --con su retorno de carro pegado--, no lo encuentra y el contenedor sale con
 * «not found» y el codigo 127. Y una comilla de mas: en una linea que acabe en
 * una variable, el `\r` se queda **dentro del valor**.
 *
 * En el repositorio estan en LF, pero el proyecto se edita en Windows y un
 * editor de alli los puede dejar con `\r` sin que nadie lo note. Se quitan aqui,
 * al armar la orden, que es el ultimo sitio por el que pasan antes de cruzar.
 *
 * Lo que entra en la imagen no pasa por aqui y se limpia al construirla: mira el
 * paso de las funciones del `docker/synology/Dockerfile`.
 */
export function sinRetornos(text) {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * Cuanto puede medir un argumento de la linea de ordenes al cruzar de Windows a
 * un `ssh` de MSYS --el de Git Bash--, que es por donde viajan los guiones.
 *
 * No es un limite de Windows ni del NAS: es del paso de un proceso nativo a uno
 * de MSYS, y corta **en silencio**. Medido en Windows con el guion de la copia:
 * 9767 bytes de guion llegaban cortados a los 8186 caracteres --a media palabra,
 * sin error ni aviso--, mientras que relleno plano de 16000 pasaba entero. El
 * corte depende del contenido, asi que se deja un margen de dos a uno: los
 * guiones viajan troceados y se vuelven a juntar en el NAS.
 *
 * Se veia como una comilla sin cerrar en la shell del NAS: la mitad del guion
 * que llegaba estaba a medias.
 */
export const COMMAND_CHUNK = 4000;

/** El guion en trozos que quepan, cada uno, en un argumento de la orden. */
export function commandChunks(text, size = COMMAND_CHUNK) {
  const trozos = [];
  for (let i = 0; i < text.length; i += size) {
    trozos.push(text.slice(i, i + size));
  }
  return trozos;
}

/**
 * Lo que hace el `sh` del NAS con lo que le llega por el tubo: se lo guarda
 * **entero** antes de ejecutar nada.
 *
 * Y no es un detalle: el guion no se le puede dar a `sh -s`, que lee de su
 * entrada segun lo va necesitando, porque cualquier orden de dentro que lea de
 * esa entrada --`docker compose run`, sin ir mas lejos-- se lleva por delante lo
 * que quede de guion. La shell se queda sin nada que leer y termina **en
 * silencio, a medias**. Medido con la copia previa: el export salia bien y el
 * guion moria justo despues, sin un solo mensaje y sin resumen con el que el
 * ordenador pudiera saber que habia pasado.
 *
 * Con el guion ya en una variable, lo que haga cada orden de dentro con la
 * entrada da igual: no queda guion por leer.
 */
const COGER_Y_EJECUTAR = 'pulso_guion=$(cat); eval "$pulso_guion"';

/**
 * La orden que le pasa un guion a la shell del NAS sin dejarlo alli, **en
 * palabras sueltas**: los trozos viajan cada uno por su cuenta y alli un
 * `printf` los vuelve a juntar por el tubo para que los ejecute un `sh -c`.
 *
 * Se devuelven sueltas y no en una linea porque lo que se corta es **cada
 * argumento**: `ssh` las junta con un espacio al otro lado, asi que la orden sale
 * entera sin que ningun argumento se acerque al corte.
 *
 * Y no lleva ningun argumento corto entrecomillado a proposito: al cruzar de
 * Windows a un `ssh` de MSYS, un argumento con comillas y sin espacios pierde las
 * comillas (medido: `'7'` llega como `7`). Los trozos no, porque llevan espacios
 * y Node los protege con comillas dobles; los valores que el guion necesite
 * saber van **escritos dentro del guion** —una linea `CLAVE=valor` delante—, y
 * asi no hay ninguna palabra corta que cruce sola.
 */
export function scriptWords(script) {
  return [
    "printf",
    "%s",
    ...commandChunks(sinRetornos(script)).map(shQuote),
    "|",
    "sh",
    "-c",
    shQuote(COGER_Y_EJECUTAR),
  ];
}

/**
 * Las extensiones con las que el CLI admite un módulo —`entryPoints`, en el
 * paquete `convex/bundler`—: es la primera criba de lo que acaba en el índice.
 */
const MODULE_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".jsx",
];

/** El contenido de un archivo, o `null` si no se puede leer (no es lo normal). */
function readText(fs, path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Lo que hay en la carpeta de las funciones (`src/convex`), listo para contar
 * módulos: cada archivo con su ruta relativa —con barras normales, que es como la
 * nombra el índice en cualquier sistema— y su contenido si es TypeScript, que es
 * lo único que hay que mirar por dentro.
 *
 * Recorre las subcarpetas, como el CLI, y descarta lo que solo se ve en el
 * directorio: una carpeta con su propio `convex.config.ts` es un **componente** de
 * verdad, y lo que tiene dentro no son módulos de esta aplicación.
 *
 * Las herramientas del sistema de archivos entran como argumento (`fs`, con
 * `readdirSync`, `readFileSync` y `existsSync`) para que esto siga siendo una
 * función pura: la prueba le pasa las que quiera y el guion, las de Node.
 */
export function moduleEntries(directory, fs, base = directory) {
  let listing;
  try {
    listing = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const entries = [];
  for (const entry of listing) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      const componente = ["convex.config.ts", "convex.config.js"].some((name) =>
        fs.existsSync(`${path}/${name}`),
      );
      if (!componente) entries.push(...moduleEntries(path, fs, base));
      continue;
    }
    entries.push({
      path: path.slice(base.length + 1),
      source: /\.(ts|tsx)$/.test(entry.name) ? readText(fs, path) : null,
    });
  }
  return entries;
}

/**
 * Los módulos de Convex que hay en el código, con la regla del CLI —la misma que
 * decide después qué aparece en `_generated/api.d.ts`—: entran los archivos con su
 * ruta relativa a `src/convex` y su contenido, y salen los nombres, ordenados
 * (`alerts`, `auth/emailOtp`).
 *
 * El CLI no cuenta todo lo que hay ahí, y esto hace lo mismo por los mismos
 * motivos: `schema.ts` no es una función sino la forma de los datos; `auth.config.ts`
 * y los `*.test.ts` llevan más de un punto, que el CLI lee como «no es un módulo»
 * (y con ellos cae cualquier `.d.ts`); `tsconfig.json` no tiene extensión de
 * entrada; se quedan fuera los archivos ocultos y los que empiezan por `#`; las
 * rutas con espacios; lo que el propio CLI genera (`_generated/`, `_deps/`); y los
 * TypeScript sin un solo `import` o `export`, que no son módulos de nada.
 *
 * Una carpeta que es un componente no llega aquí: la descarta `moduleEntries`,
 * que es quien ve el directorio.
 */
export function moduleNames(entries = []) {
  const names = [];
  for (const entry of entries) {
    const path = String(entry?.path ?? "");
    const base = path.slice(path.lastIndexOf("/") + 1);
    const puntos = (base.match(/\./g) ?? []).length;
    if (
      !MODULE_EXTENSIONS.some((extension) => path.endsWith(extension)) ||
      path.startsWith("_generated/") ||
      path.startsWith("_deps/") ||
      path.includes(" ") ||
      base.startsWith(".") ||
      base.startsWith("#") ||
      base === "schema.ts" ||
      base === "schema.js" ||
      puntos > 1
    ) {
      continue;
    }
    if (
      (path.endsWith(".ts") || path.endsWith(".tsx")) &&
      typeof entry?.source === "string" &&
      !/^\s{0,100}(import|export)/m.test(entry.source)
    ) {
      continue;
    }
    names.push(path.replace(/\.[^/.]+$/, ""));
  }
  return names.sort();
}

/**
 * Los módulos que nombra un índice generado (`_generated/api.d.ts`): las claves
 * del objeto que envuelve `ApiFromModules`, que son las que la app usa como
 * `api.<módulo>.<función>`. Se leen del texto, no del archivo, para que esto siga
 * siendo una función pura.
 */
export function listedModules(text = "") {
  return [
    ...String(text).matchAll(
      /^\s*"?([A-Za-z0-9_/]+)"?\s*:\s*typeof\s+[A-Za-z0-9_]+;\s*$/gm,
    ),
  ]
    .map((match) => match[1])
    .sort();
}

/**
 * El índice de módulos, mirado como el resto de la puesta en marcha: dice si
 * `_generated/api.d.ts` nombra todos los módulos que hay en el código.
 *
 * Importa porque es lo que `tsc -b` lee para saber qué funciones existen: con el
 * índice atrasado, la compilación de la app falla —`api.dashboard` sin tipo— y
 * falla **dentro del NAS**, al construir la imagen, lejos de donde se puede
 * arreglar. Por eso el guion lo mira antes de empaquetar.
 *
 * Y en los dos sentidos, porque los dos rompen igual: un módulo nuevo sin
 * regenerar deja la app sin tipo, y un módulo borrado que el índice sigue nombrando
 * deja un `import` a un archivo que ya no está.
 */
export function apiModulesVerdict({ modules = [], listed = [] } = {}) {
  const base = { id: "modulos", label: "Índice de módulos" };
  const faltan = modules.filter((name) => !listed.includes(name));
  const sobran = listed.filter((name) => !modules.includes(name));
  if (faltan.length === 0 && sobran.length === 0) {
    return {
      ...base,
      ok: true,
      detail: `el índice nombra los ${modules.length} módulos del código`,
    };
  }
  const averia = [];
  if (faltan.length > 0) averia.push(`no nombra ${faltan.join(", ")}`);
  if (sobran.length > 0)
    averia.push(`nombra módulos que ya no están: ${sobran.join(", ")}`);
  return {
    ...base,
    ok: false,
    detail: `_generated/api.d.ts está atrasado: ${averia.join(" · ")}`,
    fix: [
      "Regenera el índice antes de llevarlo al NAS: con el backend a mano,",
      "«npm run convex:up» (una vez) y «npm run convex:push»; o «npx convex codegen»",
      "contra tu deployment. La imagen del NAS compila con lo que hay en «src/convex»",
      "y con este índice: atrasado, la compilación falla dentro del NAS.",
    ].join("\n"),
  };
}

/**
 * El archivo del proyecto que se lleva al NAS: solo lo que hace falta para
 * construirlo. Fuera `node_modules/` (los binarios del ordenador no valen en el
 * NAS), `dist/` (lo construye la imagen) y `.env.local` (lleva la clave de
 * administrador del entorno local), como cuenta el paso 3 de la guía.
 *
 * Devuelve las órdenes de `tar` y `ssh` por separado para que la prueba pueda
 * mirar las dos sin ejecutarlas.
 */
export function tarArgs(root = ".") {
  return [
    "-C",
    root,
    "-czf",
    "-",
    "--exclude=./node_modules",
    "--exclude=./dist",
    "--exclude=./.env.local",
    ".",
  ];
}

/**
 * El pretexto del paso 3, que corre dentro del NAS: descomprime lo que llega por
 * la entrada estándar en una carpeta nueva y **solo entonces** sustituye la
 * anterior, para que un corte a mitad no deje el proyecto a medias. Si no había
 * código, no hay nada que sustituir.
 */
export function unpackCommand(root = DEFAULT_PROJECT_PATH) {
  const codigo = `${root}/codigo`;
  return [
    `rm -rf ${codigo}.nuevo`,
    `mkdir -p ${codigo}.nuevo`,
    `tar xzf - -C ${codigo}.nuevo`,
    `rm -rf ${codigo}.viejo`,
    `[ ! -d ${codigo} ] || mv ${codigo} ${codigo}.viejo`,
    `mv ${codigo}.nuevo ${codigo}`,
    `rm -rf ${codigo}.viejo`,
  ].join(" && ");
}

/**
 * El guion que se ejecuta **dentro** del NAS (se sube a `.setup/setup.sh` y lo
 * lanza el script del ordenador, o a mano si algo se torció). Es el mismo en cada
 * ejecución salvo por los tres interruptores y las dos direcciones, que viajan
 * escritos dentro.
 *
 * Es idempotente de verdad, y esa es la parte difícil de acertar:
 *
 * - el `docker-compose.yml` solo se escribe si falta (o con `--force-compose`),
 *   porque puede llevar cambios propios —los puertos abiertos a la red local—;
 * - el `.env` solo se escribe si no está, y de ahí en adelante solo se **rellena
 *   lo que esté vacío**: el secreto de la instancia y la clave de administrador
 *   se generan una vez y no se rotan nunca (rotarlos dejaría fuera a quien esté
 *   dentro, y la guía lo repite en cada paso).
 * - lo que ya está en pie se reutiliza: preguntar, construir y arrancar se puede
 *   repetir sin tocar los datos (viven en el volumen).
 */
export function setupScript({
  root = DEFAULT_PROJECT_PATH,
  instance = DEFAULT_INSTANCE,
  appUrl = "",
  apiUrl = "",
  forceCompose = false,
  newKey = false,
  build = true,
  healthUrl = BACKEND_HEALTH_URL,
}) {
  return `#!/bin/sh
# Todo lo que hay que hacer DENTRO del NAS para dejar el taller en marcha: los
# pasos 1 a 5 de SYNOLOGY.md, en orden y sin nada manual.
#
# Lo escribe y lo sube el script del ordenador (scripts/nas-setup.mjs), que deja
# al lado el codigo/, el docker-compose.yml del repositorio y la plantilla del
# .env. Se puede volver a lanzar a mano, desde la carpeta del proyecto:
#
#   sh ${root}/.setup/setup.sh
#
# Es idempotente: lo que ya esta hecho no se rehace ni se pisa. En particular
# NUNCA cambia un valor que ya tenga el .env -- ni el secreto de la instancia, ni
# la clave de administrador, ni las direcciones--: solo rellena lo que falte.
#
# Corre con sh, no con bash: en el NAS no hay bash de sobra. Y no usa sudo para
# todo: le pregunta a Docker si le hace falta.

set -eu

RAIZ=${shQuote(root)}
INSTANCIA=${shQuote(instance)}
API_URL=${shQuote(apiUrl)}
APP_URL=${shQuote(appUrl)}
FORZAR_COMPOSE=${shQuote(forceCompose ? "si" : "no")}
CLAVE_NUEVA=${shQuote(newKey ? "si" : "no")}
CONSTRUIR=${shQuote(build ? "si" : "no")}
SALUD=${shQuote(healthUrl)}

ENV="$RAIZ/.env"
COMPOSE="$RAIZ/docker-compose.yml"
NUEVO_COMPOSE="$RAIZ/.setup/docker-compose.yml"
PLANTILLA="$RAIZ/.setup/env.example"

# Los tres interruptores se acaban de leer; los resultados se cuentan al final.
creado_env="no"
secreto_nuevo="no"
clave_estado="conservada"
compose_estado="igual"
funciones_estado="desconocido"

log() { printf 'nas: %s\\n' "$*"; }
fail() { printf 'nas: %s\\n' "$*" >&2; exit 1; }

[ -d "$RAIZ" ] || fail "no existe la carpeta del proyecto: $RAIZ"
[ -f "$NUEVO_COMPOSE" ] || fail "falta $NUEVO_COMPOSE (lo sube scripts/nas-setup.mjs)"
[ -f "$PLANTILLA" ] || fail "falta $PLANTILLA (lo sube scripts/nas-setup.mjs)"
[ -f "$RAIZ/codigo/docker/synology/Dockerfile" ] ||
  fail "no veo el codigo del proyecto en $RAIZ/codigo: vuelve a lanzar el comando desde el ordenador"
cd "$RAIZ"

# --- Con quien se habla con Docker --------------------------------------------
# En un Synology hay que ser root para hablar con Docker, pero no siempre: si el
# usuario esta en el grupo que toca, no hace falta sudo. Se pregunta una vez.
#
# Y no vale con el \`docker\` a secas: el \`sudo\` del NAS impone su propio PATH
# --sin /usr/local/bin, que es donde vive el binario--, asi que \`sudo docker\`
# contesta «command not found» con el taller en pie. Se busca el binario por sus
# rutas de siempre y se llama despues por la que aparezca.
buscar_binario() {
  opcion=$(command -v "$1" 2>/dev/null || true)
  for candidato in "$opcion" "/usr/local/bin/$1" "/var/packages/ContainerManager/target/usr/bin/$1"; do
    if [ -n "$candidato" ] && [ -x "$candidato" ]; then
      echo "$candidato"
      return 0
    fi
  done
  return 1
}

DOCKER=$(buscar_binario docker) ||
  fail "no encuentro el binario docker en el NAS: instala Container Manager desde el Centro de paquetes"
if $DOCKER info >/dev/null 2>&1; then
  SUDO=""
else
  SUDO="sudo"
fi
# El compose nuevo va dentro del propio docker; el antiguo, aparte y con guion.
DOCKER_COMPOSE=$(buscar_binario docker-compose || true)
if $SUDO $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER compose"
elif [ -n "$DOCKER_COMPOSE" ] && $SUDO "$DOCKER_COMPOSE" version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER_COMPOSE"
else
  fail "no encuentro docker compose en el NAS: instala Container Manager desde el Centro de paquetes"
fi
compose() { $SUDO $COMPOSE_CMD "$@"; }
log "docker compose: se usa con la orden «$COMPOSE_CMD»$([ -n "$SUDO" ] && printf ' y con sudo')"

# --- Paso 1: el docker-compose.yml --------------------------------------------
# El unico archivo que no viaja dentro del codigo. Si el NAS ya tiene uno, se
# conserva --puede llevar los puertos abiertos a la red local, que es una de las
# variantes de la guia-- y se avisa de que no es el del repositorio; para
# pisarlo, --force-compose.
if [ ! -f "$COMPOSE" ]; then
  cp "$NUEVO_COMPOSE" "$COMPOSE"
  compose_estado="colocado"
  log "colocado docker-compose.yml"
elif [ "$FORZAR_COMPOSE" = "si" ]; then
  cp "$NUEVO_COMPOSE" "$COMPOSE"
  compose_estado="refrescado"
  log "docker-compose.yml refrescado desde el repositorio (--force-compose)"
elif cmp -s "$NUEVO_COMPOSE" "$COMPOSE"; then
  log "docker-compose.yml: el del NAS es el del repositorio"
else
  compose_estado="conservado"
  log "docker-compose.yml: se conserva el del NAS, que tiene cambios propios"
  log "  (para pisarlo con el del repositorio: vuelve a lanzar con --force-compose)"
fi

# --- Paso 2: el .env -----------------------------------------------------------
if [ ! -f "$ENV" ]; then
  cp "$PLANTILLA" "$ENV"
  creado_env="si"
  log "escrito el .env a partir de la plantilla del repositorio"
else
  log "el .env ya estaba: se conserva tal cual (no se pisa ningun valor que tenga)"
fi

# Lee el valor de una clave del .env (vacio si no esta).
valor_de() { sed -n "s/^$1=//p" "$ENV" 2>/dev/null | head -n 1 || true; }

# Escribe el valor de una clave en su sitio, sin mover la linea ni tocar las
# demas (si no existe, se anade al final). Con awk y no con sed porque el valor
# puede llevar cualquier cosa, el pico de la clave de administrador incluido.
pon_valor() {
  clave=$1
  valor=$2
  tmp="$ENV.nuevo"
  awk -v c="$clave" -v v="$valor" '
    index($0, c "=") == 1 { print c "=" v; puesto = 1; next }
    { print }
    END { if (!puesto) print c "=" v }
  ' "$ENV" > "$tmp"
  mv "$tmp" "$ENV"
}

# El secreto de la instancia: se genera una vez y no se cambia nunca (al rotarlo
# dejan de valer las claves de administrador y todas las sesiones abiertas).
if [ -z "$(valor_de INSTANCE_SECRET)" ]; then
  secreto=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \\n')
  [ -n "$secreto" ] || fail "no he podido generar el secreto de la instancia (ni openssl ni /dev/urandom)"
  pon_valor INSTANCE_SECRET "$secreto"
  secreto_nuevo="si"
  log "generado INSTANCE_SECRET (32 bytes en hexadecimal). Guardalo con las contrasenas del taller"
  log "  y no lo cambies nunca: al rotarlo habria que volver a entrar en la app"
fi
if [ -z "$(valor_de INSTANCE_NAME)" ]; then
  pon_valor INSTANCE_NAME "$INSTANCIA"
fi

# Las direcciones: mandan las del .env, que es lo que hay instalado. Solo se
# escriben si no habia nada o si se ha pedido otra a proposito en la linea de
# ordenes; nunca se pisan por venir en un flag de mas.
if [ -n "$API_URL" ] && [ "$(valor_de CONVEX_CLOUD_ORIGIN)" != "$API_URL" ]; then
  pon_valor CONVEX_CLOUD_ORIGIN "$API_URL"
  log "CONVEX_CLOUD_ORIGIN = $API_URL"
fi
if [ -n "$APP_URL" ] && [ "$(valor_de SITE_URL)" != "$APP_URL" ]; then
  pon_valor SITE_URL "$APP_URL"
  log "SITE_URL = $APP_URL"
fi

# Sin direccion no se puede construir: la app lleva grabada la de la API dentro,
# asi que compilarla con el ejemplo de la plantilla dejaria el sitio roto.
api=$(valor_de CONVEX_CLOUD_ORIGIN)
sitio=$(valor_de SITE_URL)
# Se mira si lo que hay es el ejemplo de la plantilla *y nadie lo ha dicho a
# proposito*: si las direcciones vienen de la linea de ordenes, mandan ellas,
# aunque el taller viva de verdad en tudominio.com.
api_de_ejemplo="no"
if [ -z "$API_URL" ] && [ "$api" = "https://api.tudominio.com" ]; then
  api_de_ejemplo="si"
fi
sitio_de_ejemplo="no"
if [ -z "$APP_URL" ] && [ "$sitio" = "https://taller.tudominio.com" ]; then
  sitio_de_ejemplo="si"
fi
if [ "$api_de_ejemplo" = "si" ] || [ "$sitio_de_ejemplo" = "si" ]; then
  log "el .env tiene todavia las direcciones de ejemplo de la plantilla (tudominio.com)."
  log "Escribe las de verdad en $ENV y vuelve a lanzar el comando, o pasale las dos en la"
  log "linea de ordenes (--api-url https://api.mi-taller.es --app-url https://taller.mi-taller.es)."
  fail "el .env sigue con las direcciones de ejemplo"
fi
case "$api" in
  http://* | https://*) ;;
  *)
    log "el .env todavia no tiene la direccion publica de la API (CONVEX_CLOUD_ORIGIN)."
    log "Es lo esperado la primera vez: escribela en $ENV con la direccion de verdad"
    log "(por ejemplo https://api.tudominio.com) y vuelve a lanzar el comando."
    fail "falta CONVEX_CLOUD_ORIGIN en el .env"
    ;;
esac
case "$sitio" in
  http://* | https://*) ;;
  *)
    fail "falta SITE_URL en el .env: la direccion desde la que se usa la app"
    ;;
esac
chmod 600 "$ENV"
log "direcciones: API $api · app $sitio"

# --- Paso 3: el codigo ---------------------------------------------------------
# Ya esta subido (lo descomprime el script del ordenador antes de llamarme); si
# no, se ha avisado arriba.
log "codigo en $RAIZ/codigo"

# --- Paso 4: construir y arrancar ----------------------------------------------
if [ "$CONSTRUIR" = "si" ]; then
  log "construyendo y arrancando los contenedores (la primera vez tarda unos minutos)..."
  compose up -d --build ||
    fail "los contenedores no han arrancado: mira sus registros con «$COMPOSE_CMD logs backend»"
else
  log "arrancando los contenedores sin construir (--no-build): el codigo no se actualiza"
  compose up -d || fail "los contenedores no han arrancado"
fi

# El vigilante mira «codigo/src/convex», montado desde el NAS. El codigo acaba de
# llegar como carpeta nueva --se descomprime al lado y se sustituye entera, para
# que un corte a mitad no deje el proyecto a medias--, y un montaje de Docker
# apunta a la carpeta que existia cuando se creo el contenedor: sin recrearlo, se
# quedaria mirando al codigo viejo y no volveria a subir nada. Se recrea para que
# mire el nuevo; al arrancar no sube nada por su cuenta (apunta como esta el
# codigo y espera al primer cambio: el primer envio es del contenedor de arriba).
# En una instalacion anterior, sin ese servicio, no aparece y no se toca nada.
if [ -n "$(compose ps -a -q vigilante 2>/dev/null || true)" ]; then
  compose up -d --force-recreate vigilante ||
    log "no he podido recrear el vigilante: mira «$COMPOSE_CMD up -d --force-recreate vigilante»"
fi

# El backend tiene que estar en pie antes de pedirle la clave. Se pregunta por lo
# mismo que su healthcheck —su version— y se espera con paciencia, que un NAS
# tambien arranca despacio.
preguntar_backend() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "$SALUD" 2>/dev/null
  else
    wget -q -O /dev/null "$SALUD" 2>/dev/null
  fi
}
intento=1
while [ "$intento" -le 60 ]; do
  if preguntar_backend; then
    log "el backend responde: $SALUD"
    break
  fi
  [ "$intento" -lt 60 ] || fail "el backend no contesta en $SALUD: mira los registros del servicio «backend»"
  [ $((intento % 15)) -ne 0 ] || log "esperando al backend... ($intento/60)"
  intento=$((intento + 1))
  sleep 2
done

# --- Paso 5: la clave de administrador y el despliegue -------------------------
# La clave la firma el backend con el secreto de la instancia, asi que se puede
# volver a pedir cuando haga falta; las anteriores siguen valiendo. Solo se pide
# si no habia ninguna o si se ha pedido una nueva a proposito.
if [ "$CLAVE_NUEVA" = "si" ] || [ -z "$(valor_de CONVEX_ADMIN_KEY)" ]; then
  salida=$(compose exec -T backend ./generate_admin_key.sh 2>/dev/null || true)
  clave=$(printf '%s\\n' "$salida" | tr -d '\\r' | grep -v '^[[:space:]]*$' | tail -n 1 || true)
  [ -n "$clave" ] ||
    fail "el backend no ha dado ninguna clave de administrador: mira «$COMPOSE_CMD logs backend»"
  pon_valor CONVEX_ADMIN_KEY "$clave"
  clave_estado="pedida"
  log "pedida la clave de administrador al backend y escrita en el .env (no se imprime)"
fi

# La clave viaja al contenedor de las funciones por su entorno, asi que hay que
# recrearlo para que la vea: arrancar otra vez basta, y sin clave nueva no cambia
# nada.
compose up -d

# Y ahora se espera a que el contenedor de las funciones acabe: sube el esquema y
# las funciones, termina y se para. Su salida limpia es la senal de que el paso 5
# esta hecho; si sale con error, lo dice y se ensenan sus ultimas lineas.
#
# Se pregunta con -a porque el contenedor puede estar ya parado (lo normal: el
# recado esta hecho) y asi sigue contando, con su codigo de salida. Sin -a,
# «compose ps» solo ensena los que estan en marcha y pareceria que no existe.
id=$(compose ps -a -q funciones 2>/dev/null || true)
if [ -z "$id" ]; then
  funciones_estado="sin-arrancar"
  log "no encuentro el contenedor de las funciones: mira «$COMPOSE_CMD ps -a»"
else
  intento=1
  while [ "$intento" -le 150 ]; do
    en_marcha=$($SUDO $DOCKER inspect -f '{{.State.Running}}' "$id" 2>/dev/null || printf 'false')
    [ "$en_marcha" = "true" ] || break
    [ $((intento % 15)) -ne 0 ] || log "subiendo el esquema y las funciones... ($intento/150)"
    intento=$((intento + 1))
    sleep 2
  done
  if [ "$en_marcha" = "true" ]; then
    # Sigue subiendo cuando se acaba la paciencia: no se da por bueno ni se da por
    # roto; se deja apuntado, con donde mirarlo.
    funciones_estado="sigue"
    log "el contenedor de las funciones sigue en marcha despues de cinco minutos"
    log "  (como va, con «$COMPOSE_CMD logs -f funciones»; el esquema y las funciones"
    log "  suelen subir bastante antes)"
  else
    codigo_salida=$($SUDO $DOCKER inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || printf '?')
    if [ "$codigo_salida" != "0" ]; then
      printf '\n'
      compose logs --tail=30 funciones || true
      funciones_estado="error"
      fail "el contenedor de las funciones ha salido con error ($codigo_salida): mira los avisos de arriba y el apartado «Problemas frecuentes» de SYNOLOGY.md"
    fi
    funciones_estado="al-dia"
    log "listo: el esquema y las funciones estan al dia"
  fi
fi

# --- Y hasta aqui los pasos 1 a 5 ----------------------------------------------
# El 6 (el HTTPS del proxy inverso de DSM) se hace con el raton, en DSM, y el 7 es
# entrar y comprobar. Eso no lo puede hacer este script.
log "los contenedores estan en pie; queda el paso 6 de la guia: el HTTPS del proxy inverso de DSM"
# El resumen va como ultima linea y con una marca inconfundible: es lo que lee el
# script del ordenador para armar el panel final (y para saber que se ha llegado
# al final de verdad). Las direcciones van aqui para que el panel las ensene tal
# como han quedado, y no como se pidieron.
printf 'PULSO_SETUP env=%s secreto=%s clave=%s compose=%s funciones=%s construido=%s api=%s app=%s\\n' \\
  "$creado_env" "$secreto_nuevo" "$clave_estado" "$compose_estado" "$funciones_estado" "$CONSTRUIR" \\
  "$api" "$sitio"
`;
}

/**
 * El guion que se ejecuta **dentro** del NAS para mirar como esta el taller, sin
 * tocar nada: no escribe archivos, no construye ni arranca contenedores, no sube
 * codigo y no pide claves. Solo lee —el `.env`, el proyecto de Compose y el
 * estado de los contenedores— y deja lo que ha visto en una ultima linea
 * (`PULSO_CHECK ...`) que lee el script del ordenador.
 *
 * Viaja como argumento de la conexion, no se sube a ningun sitio: la
 * comprobacion no deja ni un archivo en el NAS. Por eso no depende de que la
 * puesta en marcha haya pasado por ahi (sus guiones viven en `.setup/`).
 *
 * Del `.env` solo salen **nombres**: que claves faltan y si las direcciones son
 * todavia las de la plantilla. Ningun valor viaja en el resumen —tampoco la
 * clave de administrador—, asi que el panel puede ensenarlo sin cuidado.
 *
 * Lo unico que no se puede saber desde dentro es si el backend tiene el esquema
 * de este ordenador: eso lo decide quien llama, comparando la fecha del ultimo
 * envio (que va en el resumen) con la del codigo que tiene delante.
 */
export function checkScript({
  root = DEFAULT_PROJECT_PATH,
  healthUrl = BACKEND_HEALTH_URL,
} = {}) {
  return `#!/bin/sh
# Como esta el taller, sin tocar nada. Lo lanza el comando del ordenador con
# --check y no se queda en el NAS: viaja por la conexion, como argumento.
#
# Corre con sh, no con bash: en el NAS no hay bash de sobra. Y no usa sudo para
# todo: le pregunta a Docker si le hace falta, igual que la puesta en marcha.

set -u

RAIZ=${shQuote(root)}
SALUD=${shQuote(healthUrl)}
ENV="$RAIZ/.env"
COMPOSE="$RAIZ/docker-compose.yml"

log() { printf 'nas: %s\\n' "$*"; }

# Los datos del resumen, con su valor de partida: lo que no se pueda mirar queda
# como desconocido en vez de inventado.
raiz="no"
docker_estado="no"
salud="no"
contenedores=""
env_estado="no"
faltan=""
plantilla="no"
api=""
sitio=""
funciones="desconocido"
salida=""
fin=""

if [ ! -d "$RAIZ" ]; then
  log "no existe la carpeta del proyecto: $RAIZ"
  printf 'PULSO_CHECK raiz=no\\n'
  exit 0
fi
raiz="si"
log "carpeta del proyecto: $RAIZ"

# Y se entra en ella. Lo que se le pregunta a Compose --qué contenedores hay--
# solo se sabe desde dentro, contra el docker-compose.yml de la carpeta: desde
# fuera contesta «no configuration file provided: not found» y parecería que no
# hay ni uno. Este guion llega por SSH desde donde entre el usuario, así que la
# carpeta no es un detalle que se pueda dar por hecho.
cd "$RAIZ" 2>/dev/null || log "no he podido entrar en $RAIZ: los contenedores quedan a medias"

# --- Con quien se habla con Docker -------------------------------------------
# La misma pregunta que hace la puesta en marcha, sin cambiar nada: en un
# Synology hace falta root para hablar con Docker, aunque no siempre (si el
# usuario esta en el grupo que toca, no).
#
# Y no vale con el \`docker\` a secas: el \`sudo\` del NAS impone su propio PATH
# --sin /usr/local/bin, que es donde vive el binario--, asi que \`sudo docker\`
# contestaria «command not found» con el taller en pie. Se busca el binario por
# sus rutas de siempre y se llama despues por la que aparezca.
buscar_binario() {
  opcion=$(command -v "$1" 2>/dev/null || true)
  for candidato in "$opcion" "/usr/local/bin/$1" "/var/packages/ContainerManager/target/usr/bin/$1"; do
    if [ -n "$candidato" ] && [ -x "$candidato" ]; then
      echo "$candidato"
      return 0
    fi
  done
  return 1
}

DOCKER=$(buscar_binario docker || true)
DOCKER_COMPOSE=$(buscar_binario docker-compose || true)
if [ -n "$DOCKER" ] && $DOCKER info >/dev/null 2>&1; then
  SUDO=""
else
  SUDO="sudo"
fi
# El compose nuevo va dentro del propio docker; el antiguo, aparte y con guion.
if [ -n "$DOCKER" ] && $SUDO $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER compose"
  docker_estado="si"
elif [ -n "$DOCKER_COMPOSE" ] && $SUDO "$DOCKER_COMPOSE" version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER_COMPOSE"
  docker_estado="si"
else
  log "no encuentro docker compose: sin Container Manager no hay contenedores que mirar"
fi

if [ "$docker_estado" = "si" ]; then
  # Los que se quedan, uno a uno y con -a: un contenedor parado sigue siendo
  # parte de la respuesta (parado no es lo mismo que no estar). El del vigilante
  # de las funciones va el ultimo: si la instalacion es de antes de que existiera,
  # no aparece y no pasa nada (quien lo mira lo tiene en cuenta).
  for servicio in app backend dashboard vigilante; do
    id=$($SUDO $COMPOSE_CMD ps -a -q "$servicio" 2>/dev/null || true)
    estado="falta"
    if [ -n "$id" ]; then
      estado=$($SUDO $DOCKER inspect -f '{{.State.Status}}' "$id" 2>/dev/null || printf 'desconocido')
      [ "$estado" = "running" ] || estado="parado"
    fi
    if [ -z "$contenedores" ]; then
      contenedores="$servicio:$estado"
    else
      contenedores="$contenedores,$servicio:$estado"
    fi
  done
  log "contenedores: $contenedores"

  # Y el que pasa: sube el esquema y las funciones, termina y se para. Su salida
  # limpia es la senal de que el ultimo envio entro; su fecha, la de cuando.
  id=$($SUDO $COMPOSE_CMD ps -a -q funciones 2>/dev/null || true)
  if [ -z "$id" ]; then
    funciones="falta"
  else
    estado=$($SUDO $DOCKER inspect -f '{{.State.Status}}' "$id" 2>/dev/null || printf 'desconocido')
    case "$estado" in
      running) funciones="en-marcha" ;;
      exited) funciones="terminado" ;;
      *) funciones="$estado" ;;
    esac
    salida=$($SUDO $DOCKER inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || printf '')
    fin=$($SUDO $DOCKER inspect -f '{{.State.FinishedAt}}' "$id" 2>/dev/null || printf '')
  fi
  if [ -z "$salida" ]; then
    log "funciones: $funciones"
  else
    log "funciones: $funciones (salida $salida)"
  fi

  # El backend se pregunta por su version, que es lo que publica su healthcheck.
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "$SALUD" 2>/dev/null && salud="si"
  else
    wget -q -O /dev/null "$SALUD" 2>/dev/null && salud="si"
  fi
  log "el backend $([ "$salud" = "si" ] && printf 'responde' || printf 'no responde') en $SALUD"
fi

# --- El .env ------------------------------------------------------------------
# Del .env solo se miran los nombres: que esten las claves que hacen falta y que
# las direcciones no sean las de la plantilla. Ningun valor sale de aqui.
if [ -f "$ENV" ]; then
  env_estado="si"
  valor_de() { sed -n "s/^$1=//p" "$ENV" 2>/dev/null | head -n 1 || true; }
  for clave in INSTANCE_NAME INSTANCE_SECRET CONVEX_CLOUD_ORIGIN SITE_URL CONVEX_ADMIN_KEY; do
    [ -n "$(valor_de "$clave")" ] && continue
    if [ -z "$faltan" ]; then
      faltan="$clave"
    else
      faltan="$faltan,$clave"
    fi
  done
  api=$(valor_de CONVEX_CLOUD_ORIGIN)
  sitio=$(valor_de SITE_URL)
  if [ "$api" = "https://api.tudominio.com" ] || [ "$sitio" = "https://taller.tudominio.com" ]; then
    plantilla="si"
  fi
  if [ -z "$faltan" ]; then
    log "el .env esta completo"
  else
    log "al .env le falta: $faltan"
  fi
else
  log "no hay .env en $ENV: el proyecto de Container Manager no puede arrancar"
fi

# El resumen va en una sola linea y sin huecos: lo lee el script del ordenador
# palabra a palabra. Donde no hay nada se pone «ninguno», que no es lo mismo que
# venir vacio.
if [ -z "$faltan" ]; then
  faltan="ninguno"
fi
printf 'PULSO_CHECK raiz=%s docker=%s salud=%s contenedores=%s env=%s faltan=%s plantilla=%s api=%s sitio=%s funciones=%s salida=%s fin=%s\\n' \\
  "$raiz" "$docker_estado" "$salud" "$contenedores" "$env_estado" "$faltan" "$plantilla" \\
  "$api" "$sitio" "$funciones" "$salida" "$fin"
`;
}

/**
 * Lee el resumen que un guion del NAS deja como ultima linea, con su marca
 * delante (`PULSO_SETUP ...`, `PULSO_CHECK ...` o `PULSO_BACKUP ...` —el lector
 * es el mismo para los tres—). Devuelve `null` si no
 * aparece: quien llama lo trata como «el guion no ha terminado», que es lo que
 * es. La seudo-terminal del SSH devuelve cada linea terminada en `\r`, asi que
 * se quita antes de mirarla.
 */
export function parseSummary(text, marker) {
  const line = String(text ?? "")
    .split("\n")
    .map((one) => one.replace(/\r$/, ""))
    .reverse()
    .find((one) => one.startsWith(marker));
  if (!line) return null;
  const result = {};
  for (const pair of line.slice(marker.length).trim().split(/\s+/)) {
    const at = pair.indexOf("=");
    if (at > 0) result[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return result;
}

/** El resumen de la puesta en marcha (`PULSO_SETUP ...`). */
export function parseSetupResult(text) {
  return parseSummary(text, "PULSO_SETUP ");
}

/** El resumen de la comprobación (`PULSO_CHECK ...`). */
export function parseCheckResult(text) {
  return parseSummary(text, "PULSO_CHECK ");
}

/**
 * El panel con el que termina el comando. **La ultima linea es siempre la URL de
 * la app**: es lo que se busca al terminar, así que no puede quedar nada detrás
 * (igual que en el arranque local).
 */
export function panelLines(
  {
    appUrl,
    apiUrl,
    host,
    user,
    root = DEFAULT_PROJECT_PATH,
    result = {},
    firstTime = false,
  },
  color = NO_COLOR,
) {
  const lines = [
    "",
    color.bold("NAS listo"),
    `  App              ${appUrl}`,
    `  API de Convex    ${apiUrl}`,
    `  Panel de Convex  http://${host}:6791  (solo desde la red local)`,
    `  Proyecto         ${user}@${host}:${root}`,
    // El vigilante solo se nombra cuando el compose es el del repositorio: es el
    // que lo trae. Si se conservo el del NAS, este guion no sabe si esa
    // instalacion lo tiene, y darlo por hecho seria mentir en el panel —el
    // aviso de abajo lo dice sin afirmar nada—.
    result.compose === "conservado"
      ? "  Contenedores     app · backend · dashboard en pie · funciones terminado (exited 0)"
      : "  Contenedores     app · backend · dashboard y el vigilante en pie · funciones terminado (exited 0)",
  ];

  if (result.env === "si") {
    lines.push(
      color.yellow(
        "  !                el .env se ha escrito ahora: las direcciones salen de las que le hayas pasado",
      ),
    );
  }
  if (result.secreto === "si") {
    lines.push(
      "  Secreto          INSTANCE_SECRET recien generado: guardalo con las contrasenas del taller",
      color.dim(
        "                   y no lo cambies nunca (cerraria todas las sesiones)",
      ),
    );
  }
  if (result.clave === "pedida") {
    lines.push(
      "  Clave            pedida al backend y escrita en el .env (CONVEX_ADMIN_KEY)",
    );
  }
  if (result.compose === "conservado") {
    lines.push(
      color.yellow(
        "  !                docker-compose.yml: se ha conservado el del NAS, con sus cambios",
      ),
      color.dim(
        "                   (para pisarlo con el del repositorio: --force-compose)",
      ),
      color.dim(
        "                   si el tuyo no trae el servicio «vigilante», los cambios en src/convex",
      ),
      color.dim(
        "                   no se suben solos: mira «docker compose ps -a» y SYNOLOGY.md",
      ),
    );
  }
  if (result.funciones === "sin-arrancar") {
    lines.push(
      color.yellow(
        "  !                no he encontrado el contenedor de las funciones",
      ),
      color.dim("                   mira «docker compose ps -a» en el NAS"),
    );
  }
  if (result.funciones === "sigue") {
    lines.push(
      color.yellow(
        "  !                el contenedor de las funciones sigue subiendo el codigo",
      ),
      color.dim(
        "                   siguelo con «docker compose logs -f funciones» en el NAS",
      ),
    );
  }
  if (result.construido === "no") {
    lines.push(
      color.yellow(
        "  !                se ha arrancado sin construir (--no-build)",
      ),
      color.dim(
        "                   el codigo nuevo todavia no esta dentro de las imagenes",
      ),
    );
  }

  lines.push(
    "",
    `  Falta el paso 6 de la guia: el HTTPS del proxy inverso de DSM (2 reglas, con`,
    `  WebSocket en la de la API). Los detalles, en ${color.bold("SYNOLOGY.md")}.`,
  );
  if (firstTime) {
    lines.push(
      `  La primera vez, la app todavia no tiene usuarios: entra en ${color.bold(`${appUrl}/auth`)}`,
      "  y usa la pestana de contrasena o el acceso como invitado.",
    );
  }
  lines.push("", `  Abre la app en ${color.bold(appUrl)}`);
  return lines;
}

/* ------------------------------------------------------------------ */
/* --check: cómo está el taller                                        */
/* ------------------------------------------------------------------ */

/** Lo que cuenta el resumen de cada servicio: `app:running,backend:parado`. */
function serviceStates(contenedores = "") {
  const states = new Map();
  for (const piece of String(contenedores).split(",")) {
    const at = piece.indexOf(":");
    if (at > 0) states.set(piece.slice(0, at), piece.slice(at + 1));
  }
  return states;
}

/** «en pie», «parado», «no está»: el estado de un contenedor, en palabras. */
export function stateWords(state) {
  if (state === "running") return "en pie";
  if (state === "parado") return "parado";
  if (state === undefined || state === "falta") return "no está";
  return `en «${state}»`;
}

/**
 * Los contenedores del taller. Los tres que se quedan tienen que estar en pie
 * —la app, el backend y el panel de Convex— y el backend, además, tiene que
 * contestar en su puerto: es el que sostiene todo lo demás. El cuarto, el de las
 * funciones, es un recado que pasa y se va; de él se ocupa la comprobación del
 * esquema.
 */
export function containerVerdict(result = {}) {
  const base = { id: "containers", label: "Contenedores" };
  if (result.raiz === "no") {
    return {
      ...base,
      ok: false,
      detail: "no hay ninguna instalación en esa carpeta",
      fix: "para ponerla en marcha: npm run nas -- --host … --app-url … --api-url …",
    };
  }
  if (result.docker !== "si") {
    return {
      ...base,
      ok: false,
      detail: "no encuentro docker compose en el NAS",
      fix: "instala Container Manager desde el Centro de paquetes y vuelve a mirar",
    };
  }

  const states = serviceStates(result.contenedores);
  const names = ["app", "backend", "dashboard"];
  const down = names.filter((name) => states.get(name) !== "running");
  if (down.length > 0) {
    return {
      ...base,
      ok: false,
      detail: names
        .map((name) => `${name} ${stateWords(states.get(name))}`)
        .join(" · "),
      fix: "levántalos con: npm run nas -- (o el botón de arrancar de Container Manager)",
    };
  }
  if (result.salud !== "si") {
    return {
      ...base,
      ok: false,
      detail:
        "app · backend · dashboard en pie, pero la API no responde en su puerto",
      fix: "mira los registros del contenedor backend en el NAS: docker compose logs backend",
    };
  }

  // El vigilante de las funciones: es el que vuelve a subir el código cuando
  // cambia, así que si está, tiene que estar en pie. Si no aparece —una
  // instalación de antes de que existiera, con su compose conservado— no se dice
  // nada: no se puede echar en falta lo que nunca se pidió.
  const vigilante = states.get("vigilante");
  if (vigilante !== undefined && vigilante !== "running") {
    return {
      ...base,
      ok: false,
      detail: `app · backend · dashboard en pie, pero el vigilante de las funciones ${stateWords(
        vigilante,
      )}`,
      fix: "levántalo en el NAS con «docker compose up -d vigilante», o vuelve a lanzar la puesta en marcha: npm run nas -- --host …",
    };
  }

  return {
    ...base,
    ok: true,
    detail:
      vigilante === "running"
        ? "app · backend · dashboard en pie · el vigilante de las funciones en marcha · la API responde en su puerto"
        : "app · backend · dashboard en pie · la API responde en su puerto",
  };
}

/**
 * El `.env` del proyecto: que exista, que no le falte ninguna de las claves que
 * hacen falta y que las direcciones no sean todavía las de la plantilla. Se dice
 * **qué** falta y nunca cuánto vale: del `.env` solo salen nombres.
 */
export function envVerdict(result = {}) {
  const base = { id: "env", label: ".env" };
  if (result.raiz === "no") {
    return {
      ...base,
      ok: false,
      detail: "sin carpeta del proyecto no hay .env que mirar",
    };
  }
  if (result.env !== "si") {
    return {
      ...base,
      ok: false,
      detail: "no hay .env en la carpeta del proyecto",
      fix: "lo escribe la puesta en marcha: npm run nas -- --host … --app-url … --api-url …",
    };
  }

  const missing = String(result.faltan ?? "")
    .split(",")
    .filter((name) => name !== "" && name !== "ninguno");
  if (missing.length > 0) {
    return {
      ...base,
      ok: false,
      detail: `le falta${missing.length === 1 ? "" : "n"} ${missing.join(", ")}`,
      fix: "rellena esas líneas en el .env del NAS y vuelve a lanzar la puesta en marcha",
    };
  }
  if (result.plantilla === "si") {
    return {
      ...base,
      ok: false,
      detail:
        "completo, pero con las direcciones de la plantilla (tudominio.com)",
      fix: "escribe las del taller (CONVEX_CLOUD_ORIGIN y SITE_URL) y vuelve a lanzar la puesta en marcha",
    };
  }
  return {
    ...base,
    ok: true,
    detail:
      "completo: instancia, secreto, direcciones y clave de administrador",
  };
}

/**
 * Si el backend tiene el esquema de este ordenador. Lo que se puede saber desde
 * el NAS es cómo acabó el último envío —el contenedor de las funciones sube el
 * esquema y se va— y cuándo terminó; con eso, y la fecha del código que hay aquí
 * delante (`codeMtime`, la del archivo más reciente de `src/convex`), queda claro
 * si falta volver a lanzar la puesta en marcha.
 *
 * La fecha del código sirve porque el código viaja al NAS con sus fechas: lo
 * empaqueta `tar`.
 */
export function schemaVerdict(result = {}, { codeMtime = null } = {}) {
  const base = { id: "schema", label: "Esquema" };
  if (result.raiz === "no") {
    return {
      ...base,
      ok: false,
      detail: "no hay instalación de la que hablar",
    };
  }
  if (result.docker !== "si") {
    return {
      ...base,
      ok: false,
      detail: "sin Container Manager no se sabe si el esquema llegó a subirse",
    };
  }

  const funciones = result.funciones ?? "desconocido";
  if (funciones === "en-marcha") {
    return {
      ...base,
      ok: true,
      detail:
        "el contenedor de las funciones está subiendo el código ahora mismo",
    };
  }
  if (funciones === "falta") {
    return {
      ...base,
      ok: false,
      detail:
        "no hay contenedor de las funciones: el esquema no se ha subido nunca",
      fix: "lanza la puesta en marcha: npm run nas -- --host …",
    };
  }
  if (funciones !== "terminado") {
    return {
      ...base,
      ok: false,
      detail: `el contenedor de las funciones está «${funciones}»`,
      fix: "míralo en el NAS con: docker compose logs funciones",
    };
  }

  const salida = result.salida ?? "";
  if (salida !== "" && salida !== "0") {
    return {
      ...base,
      ok: false,
      detail: `la última subida salió con error (salida ${salida})`,
      fix: "los avisos están en los registros del contenedor funciones; la puesta en marcha lo reintenta",
    };
  }

  const fin = Date.parse(result.fin ?? "");
  if (!Number.isFinite(fin)) {
    return {
      ...base,
      ok: false,
      detail: "no se sabe cuándo terminó la última subida",
    };
  }
  if (codeMtime !== null && Number.isFinite(codeMtime) && codeMtime > fin) {
    return {
      ...base,
      ok: false,
      detail: "hay cambios en src/convex posteriores a la última subida",
      fix: "vuelve a lanzar la puesta en marcha: npm run nas -- --host …",
    };
  }
  return {
    ...base,
    ok: true,
    detail: "el último envío entró después del último cambio en src/convex",
  };
}

/** Las tres cosas que mira `--check`: los contenedores, el `.env` y el esquema. */
export function checkReport(result = {}, { codeMtime = null } = {}) {
  return [
    containerVerdict(result),
    envVerdict(result),
    schemaVerdict(result, { codeMtime }),
  ];
}

/**
 * El panel con el que termina `--check`: cada comprobación con su marca, lo que
 * hay que hacer cuando algo no está bien y, al final, la dirección de la app —o
 * lo que falta para tenerla—, que es lo que se busca al mirar cómo está el
 * taller.
 */
export function checkPanelLines(
  {
    host,
    user,
    root = DEFAULT_PROJECT_PATH,
    result = {},
    codeMtime = null,
    report = null,
  },
  color = NO_COLOR,
) {
  const findings = report ?? checkReport(result, { codeMtime });
  const lines = [
    "",
    color.bold("Cómo está el taller"),
    `  NAS              ${user}@${host}:${root}`,
  ];
  for (const finding of findings) {
    const mark = finding.ok ? color.green("✓") : color.red("✗");
    lines.push(`  ${finding.label.padEnd(17)}${mark} ${finding.detail}`);
    if (!finding.ok && finding.fix) {
      lines.push(`  ${" ".repeat(17)}${color.dim(finding.fix)}`);
    }
  }

  const broken = findings.filter((finding) => !finding.ok);
  lines.push(
    "",
    broken.length === 0
      ? "  Todo en pie: el taller está en marcha y el esquema al día."
      : `  ${broken.length} ${
          broken.length === 1 ? "cosa que mirar" : "cosas que mirar"
        }: los arreglos, arriba.`,
    color.dim(
      "  Del .env no se ha leído ningún valor: solo los nombres de lo que falta.",
    ),
    "",
  );

  const site = result.sitio ?? "";
  lines.push(
    site === ""
      ? `  Escribe SITE_URL en el .env del NAS y lanza la puesta en marcha: npm run nas -- --host ${host}`
      : `  Abre la app en ${color.bold(site)}`,
  );
  return lines;
}
