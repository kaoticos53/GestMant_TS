// Las piezas del arranque local que se pueden probar sin levantar nada: el
// **panel final** —que termina siempre en la URL de la app—, el **veredicto de
// la comprobación de salud** —qué se perdona y qué no— y la **lectura de la
// lista de procesos**, que es lo que permite reconocer un `convex dev` que no
// arrancó este script (el de otro terminal) y reutilizarlo.
//
// Viven aquí, y no en `local-dev.mjs`, porque ese archivo es un script que
// levanta contenedores, despliega y arranca Vite: importarlo desde una prueba
// arrancaría el taller entero. Al separarlas, el script y las pruebas usan
// exactamente el mismo texto y la misma regla, que es lo único que evita que se
// separen con el tiempo.
//
// No importa nada de Node a propósito: son funciones puras.

/** Colores del script; sin nada, el texto sale tal cual (como en las pruebas). */
const NO_COLOR = {
  bold: (text) => text,
  dim: (text) => text,
  green: (text) => text,
};

/**
 * Las líneas del panel «Todo listo», una por línea impresa (los huecos van como
 * línea vacía). **La última es siempre la URL de la app**: es lo que se busca al
 * terminar, así que no puede quedar nada detrás.
 *
 * `browser` dice qué pasó con el navegador: `"opened"` (se abrió), `"failed"`
 * (no se pudo) o `"off"` (desactivado con `--no-open`, y entonces el panel no
 * dice nada del navegador).
 */
export function panelLines(
  {
    appUrl,
    apiUrl,
    dashboardUrl,
    watchLog,
    email,
    fresh = false,
    demo = null,
    repaired = false,
    browser = "off",
    foreignWatchPid = null,
    foreignAppPid = null,
  },
  color = NO_COLOR,
) {
  const lines = [
    "",
    color.bold("Todo listo"),
    // Quién sirve la app se dice igual que con el observador: si no es el Vite
    // de este script, `local:stop` no lo va a parar y hay que saber dónde está.
    foreignAppPid === null
      ? `  App              ${appUrl}`
      : `  App              ${appUrl} (la dejó otro terminal, pid ${foreignAppPid})`,
    `  API de Convex    ${apiUrl}`,
    `  Panel de Convex  ${dashboardUrl}`,
    // Si el observador que vigila no es el de este script —lo dejó otro
    // terminal— no hay log nuestro que enseñar, y decir una ruta que no es la
    // suya confunde más que ayudar.
    foreignWatchPid
      ? `  Observador       src/convex → lo dejó otro terminal (pid ${foreignWatchPid})`
      : `  Observador       src/convex → ${watchLog}`,
  ];
  if (browser === "opened") {
    lines.push(`  Navegador        abierto en ${appUrl}`);
  } else if (browser === "failed") {
    lines.push(
      color.dim(
        "  Navegador        no he podido abrirlo; entra con la URL de abajo",
      ),
    );
  }
  if (demo) {
    lines.push(
      `  Datos de ejemplo ${demo.incidents} incidencias · ${demo.requests} peticiones · ${demo.parts} repuestos`,
    );
  }
  lines.push(
    "",
    `  Entra en ${color.bold(`${appUrl}/auth`)} → pestaña «Contraseña» → «Usar credenciales».`,
    color.dim(
      fresh
        ? `  Usuario ${email} · la cuenta ya está creada y la demo cargada.`
        : `  Usuario ${email} · la cuenta se crea sola en el primer Entrar.`,
    ),
  );
  if (fresh) {
    lines.push(
      color.dim(
        "  La base de datos es nueva: si tenías la app abierta, vuelve a entrar.",
      ),
    );
  }
  if (repaired) {
    lines.push(
      color.dim("  El entorno se ha arreglado sin tocar la base de datos."),
    );
  }
  lines.push(
    "",
    `  ${color.dim("npm run local:check   comprobar el entorno")}`,
    `  ${color.dim("npm run local:stop    parar la app y el observador (Convex) que arrancó este comando")}`,
    `  ${color.dim("npm run local -- --repair  arreglar el entorno sin tocar los datos")}`,
    `  ${color.dim("npm run convex:down   parar los contenedores (los datos se conservan)")}`,
    "",
    `  ${color.bold("Abre la app en")} ${color.bold(color.green(appUrl))}`,
  );
  return lines;
}

/**
 * Los procesos que ha listado el sistema, en pares pid/comando.
 *
 * El script los pide de dos formas —el JSON de PowerShell en Windows y las
 * líneas de `ps` en Unix— y aquí se leen sin depender de Node, que es lo que
 * permite probar la lectura con salidas de verdad de los dos sistemas.
 */
export function parseProcessList(text, { platform }) {
  if (!text || text.trim() === "") return [];
  return platform === "win32" ? parseWindowsList(text) : parseUnixList(text);
}

/** El JSON de `Get-CimInstance Win32_Process` (un objeto si solo hay uno). */
function parseWindowsList(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return (Array.isArray(parsed) ? parsed : [parsed])
    .map((entry) => ({
      pid: Number(entry?.ProcessId),
      command: String(entry?.CommandLine ?? ""),
    }))
    .filter((entry) => Number.isInteger(entry.pid) && entry.pid > 0);
}

/** Una línea de `ps -A -ww -o pid=,command=`: el pid, espacio, el comando. */
function parseUnixList(text) {
  return text
    .split(/\r?\n/)
    .map((line) => /^\s*(\d+)\s+(\S.*)$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ pid: Number(match[1]), command: match[2].trim() }));
}

/**
 * ¿Cuál de esos procesos es un `convex dev` de **este** proyecto?
 *
 * El CLI de Convex no deja ningún archivo que diga «estoy vigilando» —no hay
 * bloqueo ni pid—, así que la única forma de verlo es mirar los procesos. Se
 * reconoce por la ruta de su CLI dentro del proyecto, que es lo que lo distingue
 * del observador de cualquier otro: la absoluta que deja este arranque
 * (`<proyecto>/node_modules/convex/bin/main.js dev`) o la que pasa por
 * `node_modules/.bin`, que es la que aparece cuando lo abre un `npm run` o un
 * `npx`. Una invocación relativa (`node node_modules/... dev`) no lleva la ruta
 * del proyecto delante y no se puede atribuir a nadie: se deja en paz, que es
 * mejor que reutilizar el observador de otro taller.
 */
/** Un texto para meter en una expresión regular sin que sus caracteres cuenten. */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * ¿Esa orden menciona la carpeta del proyecto como raíz de una ruta?
 *
 * No vale un `includes` a secas: `/taller` está dentro de `/otro/taller`, y dar
 * por nuestro el proceso de otro taller es peor que no encontrar ninguno —el
 * arranque se subiría a un servidor ajeno o dejaría de levantar el suyo—. La
 * carpeta tiene que empezar donde empieza una ruta: al principio, tras un hueco
 * o tras unas comillas.
 */
function mentionsDir(command, dir) {
  return new RegExp(`(?:^|[\\s"'])${escapeRegExp(dir)}(?=/)`).test(command);
}

/** La línea de comandos normalizada: sin barras de Windows y sin distinciones. */
function normalizeCommand(value, platform) {
  return (platform === "win32" ? value.toLowerCase() : value).replace(
    /\\/g,
    "/",
  );
}

export function findConvexWatch(processes, { projectDir, platform }) {
  const dir = normalizeCommand(projectDir, platform).replace(/\/+$/, "");
  // El `"?` deja pasar la ruta entrecomillada y el `.bin/../` la del shim; los
  // `\/+` son porque Windows deja barras dobles (`.bin\\..\\vite`) cuando la ruta
  // la monta el lanzador de npm.
  const watch =
    /node_modules\/+(?:\.bin\/+\.\.\/+)?convex\/+bin\/+main\.js"?\s+dev(?:\s|$)/;
  for (const process of processes) {
    const command = normalizeCommand(process.command, platform);
    if (!mentionsDir(command, dir)) continue;
    if (!watch.test(command)) continue;
    return process;
  }
  return null;
}
/**
 * Qué hacer con el observador que ya está vigilando `src/convex`.
 *
 * Dos observadores sobre el mismo deployment se pisan, así que solo puede quedar
 * uno; cuál, y si hay que cerrar algo, depende de tres cosas: de quién es el que
 * está (nuestro, de otro terminal, o ninguno), de si el entorno ha cambiado
 * —clave de administrador rotada, base de datos nueva: el observador se queda
 * con la clave que leyó al arrancar, así que el que esté ya no puede
 * desplegar— y de si se ha pedido hacerse cargo del ajeno (`--take-over`).
 *
 * - `"start"` — no hay ninguno: se arranca el nuestro.
 * - `"reuse"` — hay uno que sirve tal cual (el nuestro, o el ajeno si el entorno
 *   no ha cambiado): se reutiliza y no se arranca otro.
 * - `"restart"` — el nuestro, pero el entorno ha cambiado: hay que pararlo y
 *   volver a arrancarlo con la clave nueva.
 * - `"take-over"` — hay uno ajeno y se ha pedido hacerse cargo: se cierra y se
 *   arranca el nuestro; es la forma de quedarse con uno solo sin ir a buscar la
 *   terminal donde se abrió.
 * - `"alongside"` — hay uno ajeno, el entorno ha cambiado y nadie ha pedido
 *   cerrarlo: se avisa y se arranca el nuestro. Cerrar un proceso que no es
 *   nuestro no se hace por iniciativa propia, solo cuando se pide.
 *
 * Sobre el observador propio el `--take-over` no hace nada: no hay nada ajeno que
 * tomar, así que se queda como estaba (reutilizarlo, o reiniciarlo si el entorno
 * ha cambiado).
 */
export function watchPlan({ kind, restart = false, takeOver = false }) {
  if (kind === "none") return "start";
  if (kind === "own") return restart ? "restart" : "reuse";
  if (takeOver) return "take-over";
  return restart ? "alongside" : "reuse";
}

/**
 * Qué se hace con el resultado de las comprobaciones: devuelve los ids
 * perdonados (con su motivo ya aplicado) y las comprobaciones que fallan.
 *
 * El arranque tiene manga ancha con dos cosas, y ninguna es que la app no
 * funcione:
 *
 * - **No poder *mirar* los contenedores cuando la API responde**. No poder
 *   gestionarlos no deja la app inservible —lo que la app necesita es la API—,
 *   pero si la API tampoco contesta entonces no hay nada que perdonar.
 * - **Un despliegue que no entra**. El backend sigue sirviendo lo último que sí
 *   entró, así que la app se puede usar mientras se arregla el error; parar el
 *   arranque por eso dejaría al usuario sin app y sin el motivo a la vista.
 *
 * El diagnóstico (`--check`) va sin manga ancha: ahí lo que se quiere saber es
 * justo lo que está torcido.
 */
export function healthVerdict(
  results,
  { tolerateUnmanagedContainers = false, tolerateDeployErrors = false } = {},
) {
  const tolerated = new Set();
  const apiHealthy = results.some(
    (result) => result.id === "api" && result.healthy,
  );
  if (tolerateUnmanagedContainers && apiHealthy) {
    for (const result of results) {
      if (!result.healthy && result.id === "containers") {
        tolerated.add(result.id);
      }
    }
  }
  if (tolerateDeployErrors) {
    for (const result of results) {
      if (!result.healthy && result.id === "deploy") {
        tolerated.add(result.id);
      }
    }
  }
  const failures = results.filter(
    (result) => !result.healthy && !tolerated.has(result.id),
  );
  return { tolerated, failures };
}

/**
 * ¿Cuál de esos procesos es un Vite de **este** proyecto?
 *
 * Misma idea que con el observador de Convex: Vite tampoco deja ningún archivo
 * que diga «estoy sirviendo», así que la única forma de saber si el que contesta
 * en el 5173 es el nuestro —o el de otra pestaña, otro terminal, otro lanzador—
 * es mirar los procesos. Se reconoce por la ruta de su CLI dentro del proyecto,
 * que es lo que lo distingue del Vite de cualquier otro: la absoluta que deja
 * este arranque (`<proyecto>/node_modules/vite/bin/vite.js`), la del acceso
 * directo (`node_modules/.bin/vite`) o la que deja un `npm run dev`, que pasa
 * por `node_modules/.bin/../vite/bin/vite.js`.
 */
export function findVite(processes, { projectDir, platform }) {
  const dir = normalizeCommand(projectDir, platform).replace(/\/+$/, "");
  const vite =
    /node_modules\/+(?:\.bin\/+vite|(?:\.bin\/+\.\.\/+)?vite\/+bin\/+vite\.js)"?(?:\s|$)/;
  for (const process of processes) {
    const command = normalizeCommand(process.command, platform);
    if (!mentionsDir(command, dir)) continue;
    if (!vite.test(command)) continue;
    return process;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Quién ocupa los puertos                                             */
/* ------------------------------------------------------------------ */

/**
 * Quién publica cada uno de esos puertos, leído de la lista de contenedores.
 *
 * El arranque pide esa lista con este formato —nombre, puertos y las etiquetas
 * de Compose— separado por tabuladores, y aquí se busca qué contenedor tiene
 * publicado cada puerto. Es lo que convierte un «port is already allocated» en
 * «lo tiene el contenedor X del proyecto Y, arrancado desde Z»: sin eso, el
 * choque de puertos (lo único que de verdad compite) se queda en un error opaco.
 *
 * Los puertos pueden venir en rango (`3210-3211->3210-3211/tcp`), así que la
 * comparación es con el rango de puertos del anfitrión.
 */
export function portHolders(containerList, ports) {
  const wanted = new Set(ports.map((port) => Number(port)));
  const holders = [];
  // El mismo puerto sale dos veces por contenedor (la dirección de IPv4 y la de
  // IPv6): se cuenta una.
  const seen = new Set();
  for (const raw of String(containerList ?? "").split(/\r?\n/)) {
    const [name, published = "", project = "", dir = ""] = raw
      .split("\t")
      .map((field) => field.trim());
    if (!name) continue;
    for (const map of published.split(",")) {
      const match =
        /(?:^|.*:)(\d+)(?:-(\d+))?->(\d+)(?:-(\d+))?\/(?:tcp|udp)$/.exec(
          map.trim(),
        );
      if (!match) continue;
      const from = Number(match[1]);
      const to = match[2] === undefined ? from : Number(match[2]);
      for (const port of wanted) {
        if (port < from || port > to) continue;
        const key = `${name}|${port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        holders.push({
          port,
          name,
          project: project === "" ? null : project,
          dir: dir === "" ? null : dir,
        });
      }
    }
  }
  return holders;
}

/**
 * Cómo se nombra al contenedor que ocupa un puerto: nombre, de qué proyecto es
 * (cuando lo deja dicho Compose) y desde qué carpeta se arrancó.
 *
 * Es lo que convierte «port is already allocated» en «lo tiene este contenedor,
 * de este proyecto, arrancado desde aquí»: el nombre para pararlo y la carpeta
 * para saber si es el tuyo o el de otro taller. Se compone en un solo sitio
 * porque lo dicen dos mensajes distintos —el choque al levantar los contenedores
 * y la comprobación de salud cuando el puerto lo sirve otro—, y las dos veces
 * tiene que salir igual.
 */
export function holderLabel(holder) {
  return `el contenedor ${holder.name}${
    holder.project === null ? "" : ` del proyecto «${holder.project}»`
  }${holder.dir === null ? "" : `, arrancado desde ${holder.dir}`}`;
}

/* ------------------------------------------------------------------ */
/* El motor de Docker                                                  */
/* ------------------------------------------------------------------ */

/**
 * Qué le pasa al motor de Docker, a partir de sus dos sondas: el CLI (`docker
 * --version`, que no necesita motor) y el servidor (`docker version`, que sí).
 *
 * - `missing` — no hay CLI: no hay nada que arrancar.
 * - `ok` — el servidor responde.
 * - `down` — la orden falla en seguida: Docker Desktop cerrado, motor parado.
 * - `hung` — la orden se queda colgada hasta agotar su tiempo: el motor está
 *   ahí pero no contesta, que es justo lo que no se arregla esperando.
 */
export function dockerEngineState({ cliOk, serverOk, timedOut = false }) {
  if (!cliOk) return "missing";
  if (serverOk) return "ok";
  return timedOut ? "hung" : "down";
}

/**
 * Qué toca hacer con ese estado.
 *
 * Lo importante es **no tocar un motor que no hace falta**: si el backend ya
 * responde, reiniciarlo pararía lo único que funciona, así que se deja en paz y
 * se avisa (`keep`). Cuando no responde y aquí se sabe reiniciarlo, se reinicia
 * (`restart`); cuando no se sabe —Linux sin Docker Desktop necesita permisos de
 * administrador—, se le dice al usuario lo que tiene que hacer (`manual`).
 */
export function dockerEngineAction({ state, backendHealthy, canRestart }) {
  if (state === "ok") return "ok";
  if (backendHealthy) return "keep";
  return canRestart ? "restart" : "manual";
}

/**
 * Cómo se arranca o se reinicia el motor en cada sistema, de mejor a peor: el
 * CLI de Docker Desktop (`docker desktop start|restart`, que es la forma que
 * Docker documenta para esto y la única que sirve igual en los tres sistemas),
 * abrir su aplicación, o nada —y entonces `manual` dice qué hacer a mano—.
 *
 * Un motor *colgado* hay que reiniciarlo (está ahí pero no contesta); uno que no
 * está, basta con arrancarlo. De ahí que el plan dependa del estado.
 *
 * Devuelve `steps` (lo que hay que ejecutar, en orden) y `manual` (lo que se le
 * cuenta al usuario si no se puede hacer desde aquí).
 */
export function dockerRestartPlan({
  platform,
  state,
  desktopCli = false,
  appPath = null,
}) {
  const colgado = state === "hung";
  if (desktopCli) {
    const sub = colgado ? "restart" : "start";
    return {
      steps: [
        {
          label: `${colgado ? "reiniciar" : "arrancar"} Docker Desktop (\`docker desktop ${sub}\`)`,
          command: "docker",
          args: ["desktop", sub],
        },
      ],
      manual:
        "Ábrelo a mano desde el menú de inicio y vuelve a ejecutar el comando.",
    };
  }
  if (platform === "win32") {
    if (appPath === null) {
      return {
        steps: [],
        manual: "Abre Docker Desktop desde el menú de inicio.",
      };
    }
    const steps = [];
    if (colgado) {
      steps.push({
        label: "cerrar Docker Desktop",
        command: "taskkill",
        args: ["/IM", "Docker Desktop.exe", "/T", "/F"],
      });
    }
    steps.push({ label: "abrir Docker Desktop", command: appPath, args: [] });
    return { steps, manual: "Ábrelo a mano desde el menú de inicio." };
  }
  // En macOS `open` lo abre si no está, pero no cierra uno colgado: para eso
  // habría que quitarlo desde su propio menú, que es cosa del usuario.
  if (platform === "darwin") {
    if (colgado) {
      return {
        steps: [],
        manual:
          "Ciérralo tú (icono de Docker Desktop → «Quit Docker Desktop») y vuelve a ejecutar el comando.",
      };
    }
    return {
      steps: [
        { label: "abrir Docker", command: "open", args: ["-a", "Docker"] },
      ],
      manual: "Abre Docker Desktop desde Aplicaciones.",
    };
  }
  return {
    steps: [],
    manual:
      "Arranca el motor a mano; en Linux necesita permisos de administrador (`sudo systemctl restart docker`).",
  };
}

/* ------------------------------------------------------------------ */
/* El último despliegue del observador                                 */
/* ------------------------------------------------------------------ */

/** Los colores con los que el CLI de Convex escribe en su log. */
const ANSI = /\u001b\[[0-9;]*m/g;

/** Cada intento de despliegue empieza con este texto. */
const PREPARING = /Preparing Convex functions/;

/** Y termina bien con este otro. */
const READY = /Convex functions ready!/;

/** El símbolo con el que el CLI anuncia un fallo (`logFailure`): ✖. */
const FAILURE = /^\s*(?:-\s*)?\u2716/;

/** Un log de función de la app, que no es un fallo del observador. */
const RUNTIME_LOG = /^\d{1,2}\/\d{1,2}\/\d{4},/;

/**
 * Con el log redirigido a un archivo (sin terminal), el CLI escribe el texto de
 * su ruedecilla con un «- » delante.
 */
const SPINNER_PREFIX = /^-\s*/;

/**
 * Lo que el CLI escribe entre la marca del fallo y el error de verdad, que es
 * donde está lo que hay que arreglar (el aviso de `tsc` y su recuento).
 */
const CHATTER = [
  /^To ignore failing typecheck/,
  /^Collecting TypeScript errors$/,
];

/** Cuánto se enseña de un error: lo justo para reconocerlo en una línea. */
const DETAIL_LIMIT = 160;

const clip = (text) =>
  text.length > DETAIL_LIMIT
    ? `${text.slice(0, DETAIL_LIMIT).trimEnd()}…`
    : text;

/**
 * Qué cuenta el log de `convex dev` de su último despliegue.
 *
 * El observador empuja una vez por cambio: empieza con «Preparing Convex
 * functions...» y acaba con «✔ … Convex functions ready!» o con un error detrás
 * de su marca `✖`. Cuando lo último que escribió es un fallo —un esquema que el
 * backend rechaza, por ejemplo— se queda esperando al siguiente guardado y
 * vuelve a intentarlo: los cambios se quedan sin aplicar y, sin leer esto, nadie
 * se entera.
 *
 * Devuelve:
 *
 * - `state: "ready"` — el último intento entró; `at`, la hora que el CLI puso
 *   en esa línea (o `null` si no se lee).
 * - `state: "failed"` — no entró; `message` es la línea del CLI sin su marca y
 *   `detail` la primera línea de después (el error en crudo, ya recortado).
 * - `state: "pending"` — hay un intento empezado y todavía sin desenlace.
 * - `state: "unknown"` — el log no dice nada (vacío, o de otro programa).
 *
 * La comparación es por orden: lo que vale es lo último de las dos marcas. Un
 * fallo viejo seguido de un despliegue bueno es un entorno sano —el observador
 * se recuperó al guardar—, y por eso no se avisa de él.
 */
export function deployState(logText) {
  const lines = String(logText ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(ANSI, "").trimEnd());

  let readyAt = -1;
  let failureAt = -1;
  let preparingAt = -1;
  lines.forEach((line, index) => {
    if (READY.test(line)) {
      readyAt = index;
    } else if (FAILURE.test(line)) {
      failureAt = index;
    } else if (PREPARING.test(line)) {
      preparingAt = index;
    }
  });

  if (failureAt > readyAt) {
    return {
      state: "failed",
      at: null,
      message: lines[failureAt].replace(FAILURE, "").trim(),
      detail: failureDetail(lines, failureAt),
    };
  }
  if (readyAt !== -1) {
    return {
      state: "ready",
      at: /\d{1,2}:\d{2}:\d{2}/.exec(lines[readyAt])?.[0] ?? null,
      message: null,
      detail: null,
    };
  }
  if (preparingAt !== -1) {
    return { state: "pending", at: null, message: null, detail: null };
  }
  return { state: "unknown", at: null, message: null, detail: null };
}

/**
 * La primera línea con algo útil después del fallo: es donde el CLI escribe el
 * error de verdad («Schema validation failed.» y, debajo, el documento que no
 * encaja; en un `tsc` roto, el aviso de `--typecheck=disable`, el recuento y, al
 * fin, el primer error con su fichero). Se saltan los avisos del propio CLI y
 * los logs de función, que seguirían un fallo sin decir nada de él.
 */
function failureDetail(lines, index) {
  for (let i = index + 1; i < lines.length && i <= index + 5; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    const text = line.replace(SPINNER_PREFIX, "");
    if (CHATTER.some((pattern) => pattern.test(text))) continue;
    // Un intento nuevo significa que el fallo no dejó error propio detrás.
    if (PREPARING.test(text)) return null;
    return RUNTIME_LOG.test(line) ? null : clip(line);
  }
  return null;
}
