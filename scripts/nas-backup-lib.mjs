// Las piezas de la copia previa que se pueden probar sin un NAS: la
// **configuración** (qué NAS, qué carpetas, cuántas copias se conservan), la
// **lectura del resumen** que deja el guion y el **panel final**.
//
// El trabajo lo hace `docker/synology/copia-previa.sh`, que corre dentro del NAS
// —con los demás guiones del NAS, que es donde vive Docker—, y se prueba
// ejecutándolo de verdad, con dobles en el `PATH`, como el guion de la puesta en
// marcha. Aquí solo está lo que se puede mirar sin conectar con nadie.
//
// No importa nada de Node a propósito: son funciones puras.

import { parseSummary } from "./nas-setup-lib.mjs";

/** Colores del script; sin nada, el texto sale tal cual (como en las pruebas). */
const NO_COLOR = {
  bold: (text) => text,
  dim: (text) => text,
  green: (text) => text,
  red: (text) => text,
  yellow: (text) => text,
};

/** Dónde vive el proyecto en el NAS, igual que en la puesta en marcha. */
export const DEFAULT_PROJECT_PATH = "/volume1/docker/pulso-taller";

/** Dónde se dejan las copias, como en el apartado de copias de la guía. */
export const DEFAULT_BACKUP_PATH = "/volume1/docker/respaldos";

/** La cuenta con la que se administra un Synology recién instalado. */
export const DEFAULT_USER = "admin";

/** Cuántas copias de cada tipo se conservan si no se dice otra cosa. */
export const DEFAULT_KEEP = 7;

/**
 * Cómo se pide cada opción. En la línea de órdenes manda el flag; si no está, se
 * mira la variable de entorno, para no teclear el host del NAS en cada copia.
 */
const VALUE_OPTIONS = {
  "--host": { key: "host", env: "NAS_HOST" },
  "--user": { key: "user", env: "NAS_USER" },
  "--port": { key: "port", env: "NAS_PORT" },
  "--path": { key: "path", env: "NAS_PATH" },
  "--respaldos": { key: "backups", env: "NAS_RESPALDOS" },
  "--keep": { key: "keep", env: "NAS_KEEP" },
};

/** Las opciones que no llevan valor: están o no están. */
const SWITCH_OPTIONS = {
  "--help": "help",
  "-h": "help",
};

/** Lo que se explica al pedir ayuda; el nombre del comando, tal cual se teclea. */
export function usage(name = "npm run nas:backup --") {
  return [
    "Copia previa del taller, antes de actualizarlo: el export lógico (la base",
    "de datos y los archivos) y la copia en frío del volumen, las dos en el NAS.",
    "",
    `${name} --host IP-del-NAS [opciones]`,
    `  ${name} --host 192.168.1.20 --respaldos /volume1/docker/respaldos`,
    "",
    "Habla por SSH con el NAS y lanza allí `docker/synology/copia-previa.sh`, que",
    "hace el trabajo: primero el export —con el backend en marcha, que es como",
    "tiene que estar para que el CLI le pregunte— y después el volumen, con el",
    "backend parado para que no haya nada a medias dentro del tar. El guion viaja",
    "por la conexión, así que siempre es el de este repositorio y no deja nada en",
    "el NAS. Con las copias hechas, se borran las más viejas: se conservan las",
    `últimas ${DEFAULT_KEEP} de cada tipo.`,
    "",
    "No cambia datos, no toca el .env y no imprime ningún secreto. La clave de",
    "administrador —la que necesita el export— la lleva el contenedor desde el",
    ".env del proyecto, que es donde vive.",
    "",
    "Opciones:",
    "",
    "  --host IP-del-NAS        el NAS (también NAS_HOST)",
    "  --user admin             la cuenta con la que se entra (NAS_USER)",
    "  --port 22                el puerto de SSH (NAS_PORT)",
    `  --path ${DEFAULT_PROJECT_PATH}`,
    "                           la carpeta del proyecto (NAS_PATH)",
    `  --respaldos ${DEFAULT_BACKUP_PATH}`,
    "                           dónde se dejan las copias (NAS_RESPALDOS)",
    `  --keep ${DEFAULT_KEEP}`,
    "                           cuántas copias de cada tipo se conservan",
    "                           (NAS_KEEP); las más viejas se borran",
    "  --help                   esto mismo",
    "",
    "Después de la copia, lo que sigue es actualizar (`npm run nas -- --host …`)",
    "y comprobar cómo ha quedado (`npm run nas:check -- --host …`).",
  ];
}

/**
 * La configuración completa, ya resuelta: los flags ganan a las variables de
 * entorno y lo que no se diga se queda en el valor de partida. Devuelve también
 * los errores, en vez de cortar, para enseñarlos todos juntos.
 */
export function resolveConfig(argv = [], env = {}) {
  const config = {
    host: "",
    user: DEFAULT_USER,
    port: "22",
    path: DEFAULT_PROJECT_PATH,
    backups: DEFAULT_BACKUP_PATH,
    keep: String(DEFAULT_KEEP),
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

  // El puerto tiene que ser un puerto, las copias que se conservan un número
  // entero, y las dos carpetas absolutas y sin espacios: el guion del NAS lleva
  // las rutas entre los datos del resumen —que se parten por espacios— y las
  // usa para listar las copias viejas.
  if (
    !/^[0-9]+$/.test(config.port) ||
    Number(config.port) < 1 ||
    Number(config.port) > 65535
  ) {
    config.errors.push(`el puerto de SSH no vale: ${config.port}`);
  }

  if (!/^[0-9]+$/.test(config.keep) || Number(config.keep) < 1) {
    config.errors.push(
      `--keep tiene que ser al menos 1: ${config.keep} (cuántas copias se conservan de cada tipo)`,
    );
  }

  config.path = config.path.replace(/\/+$/, "");
  config.backups = config.backups.replace(/\/+$/, "");
  for (const [key, label] of [
    ["path", "la carpeta del proyecto"],
    ["backups", "la carpeta de las copias"],
  ]) {
    const value = config[key];
    if (!value.startsWith("/")) {
      config.errors.push(`${label} tiene que ser absoluta: ${value}`);
    } else if (/[\s,'"]/.test(value)) {
      config.errors.push(
        `${label} no puede llevar espacios ni comas: ${value}`,
      );
    }
  }

  if (!config.help) {
    if (config.host === "") {
      config.errors.push("falta el NAS: --host IP-del-NAS (o NAS_HOST)");
    } else if (/[\s@:]/.test(config.host)) {
      config.errors.push(
        `el NAS no puede ser un usuario ni llevar puerto: ${config.host} (el usuario va en --user)`,
      );
    }
  }

  return config;
}

/** El resumen de la copia (`PULSO_BACKUP ...`), o `null` si no aparece. */
export function parseBackupResult(text) {
  return parseSummary(text, "PULSO_BACKUP ");
}

/**
 * El panel con el que termina la copia: qué se ha copiado, dónde está y qué toca
 * después. **La última línea es dónde están las copias**, que es lo que se busca
 * al terminar, y lo que se lee si algo falla luego.
 */
export function panelLines(
  {
    host,
    user = DEFAULT_USER,
    path = DEFAULT_PROJECT_PATH,
    backups = DEFAULT_BACKUP_PATH,
    result = {},
  },
  color = NO_COLOR,
) {
  const lines = [
    "",
    color.bold("Copia previa hecha"),
    `  NAS          ${user}@${host}:${path}`,
    `  Respaldos    ${backups}`,
  ];

  if (result.datos) {
    lines.push(
      `  Volumen      ${result.datos}`,
      color.dim(
        "               (en frío: base de datos, archivos y funciones)",
      ),
    );
  }
  if (result.export) {
    lines.push(
      `  Lógico       ${result.export}`,
      color.dim("               (se vuelve a cargar con «npx convex import»)"),
    );
  }
  if (result.volumen) {
    lines.push(`  Del volumen  ${result.volumen}`);
  }

  const keep = result.conservar ?? DEFAULT_KEEP;
  lines.push(
    `  Se conservan ${keep} de cada tipo`,
    color.dim("               (las más viejas se van borrando)"),
  );
  if (result.borrados && result.borrados !== "0") {
    lines.push(color.dim(`  Borradas     ${result.borrados} copias viejas`));
  }

  lines.push(
    "",
    "  Siguiente    actualizar el taller:",
    color.bold(`               npm run nas -- --host ${host}`),
    color.dim(
      `               y después comprobarlo: npm run nas:check -- --host ${host}`,
    ),
    "",
    `  Copias en    ${user}@${host}:${backups}`,
  );

  return lines;
}
