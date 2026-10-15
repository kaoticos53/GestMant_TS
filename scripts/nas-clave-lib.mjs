// Las piezas de «la contraseña del NAS, una sola vez», que se pueden probar sin un
// NAS delante: el texto del ayudante que le da la clave a `ssh`, el envoltorio con
// el que `sudo` la recibe por la entrada estándar, y las reglas que deciden cuándo
// hay que preguntarla.
//
// El problema, que es el que traía de cabeza al taller: el comando abre varias
// conexiones al NAS —comprobar que se llega, preparar la carpeta, dejar el
// docker-compose.yml y la plantilla, llevar el código, dejar el guion y ejecutarlo—
// y en un Synology se entra con contraseña, no con clave, así que cada conexión la
// vuelve a pedir. Por dentro, el `sudo` del NAS pregunta otra vez cuando Docker
// necesita root. Siete veces la misma contraseña para poner el taller en pie.
//
// Aquí se pide **una vez** y se reparte por dos caminos:
//
// - a `ssh`, por el **ayudante**: OpenSSH llama al programa que diga
//   `SSH_ASKPASS` en vez de preguntar por la terminal, así que las demás
//   conexiones la reciben de ahí y no molestan a nadie. `SSH_ASKPASS_REQUIRE=force`
//   es la mitad que hace falta para que el ayudante se use **aunque haya terminal
//   delante**, que es el caso normal.
// - a `sudo`, por la **entrada estándar**: `sudo -S` lee la contraseña de ahí. Y
//   como el guion del NAS corre con un `sudo` tapado por una función —la misma
//   palabra, definida dentro del propio guion—, todas sus llamadas la reciben sin
//   preguntar nada.
//
// Lo que NO se hace con ella, a propósito: no se escribe en ningún archivo (ni del
// ordenador ni del NAS: el ayudante la lee del entorno, así que su archivo no lleva
// nada dentro), no viaja en la línea de órdenes —que se ve en `ps`— y no se imprime
// nunca. Vive en la memoria del comando, en el entorno de los `ssh` que abre y en
// el de la shell del NAS mientras dura la faena.
//
// Y sabe renunciar: sin contraseña tecleada —una ejecución desatendida, o una
// cuenta que entra con clave— no se prepara nada de esto y todo funciona como
// antes, preguntando lo que haga falta cuando haga falta.
//
// No importa nada de Node a propósito: son funciones puras.

/** La variable por la que viaja la clave: del comando al ayudante y a la shell. */
export const VAR_CLAVE = "PULSO_CLAVE";

/**
 * Dónde vive el ayudante dentro del ordenador. Es una ruta **del `sh` de MSYS**
 * —el de Git Bash, que es quien ejecuta a `ssh`—, no del Windows de debajo: se
 * crea desde ese mismo `sh`, así que `/tmp` es el suyo y no hay que traducir
 * ninguna ruta de un mundo al otro.
 */
export const AYUDANTE_CARPETA = "/tmp/pulso-taller-clave";
export const AYUDANTE_ARCHIVO = `${AYUDANTE_CARPETA}/ayudante.sh`;

/** Lo que se lee al pedirla, y el aviso de que es la única vez. */
export const PREGUNTA_CLAVE = "Contraseña del NAS (no se verá al escribirla)";
export const AVISO_ANTES =
  "Se teclea una sola vez: con ella entran todas las conexiones y también el sudo de dentro.";
export const AVISO_SSH_SIN_AYUDANTE =
  "tu «ssh» es el de Windows, que no admite el ayudante de contraseña: desde Git Bash se teclea una sola vez, desde aquí la pedirá cada conexión";

/**
 * El ayudante: un programa que contesta la contraseña cuando `ssh` la pide.
 *
 * La lee del entorno —por eso este archivo no lleva ningún secreto dentro y puede
 * quedarse ahí sin cuidado— y contesta **solo** a la pregunta de la contraseña. A
 * cualquier otra cosa —la confirmación de la clave del servidor, cuando el NAS no
 * está todavía en `known_hosts`— no se le contesta nada: eso hay que leerlo y
 * decidirlo, no repetir un secreto a ciegas.
 *
 * Se escribe con finales de línea de Unix: lo ejecuta el `sh` del ordenador, donde
 * un `\r` deja el `#!` roto.
 */
export function ayudanteContenido() {
  return [
    "#!/bin/sh",
    "# El ayudante de contraseña de SSH: `ssh` lo llama en vez de preguntar por la",
    "# terminal, tantas veces como conexiones abra el comando. La lee del entorno",
    "# --por eso este archivo no lleva ningún secreto-- y solo contesta a eso.",
    'case "$1" in',
    `  *assword* | *contrase*) printf '%s\\n' "$${VAR_CLAVE}" ;;`,
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n");
}

/** La orden que deja el ayudante en su sitio, ejecutada por el `sh` de MSYS. */
export function ordenPrepararAyudante() {
  return [
    `rm -rf ${AYUDANTE_CARPETA}`,
    `mkdir -p ${AYUDANTE_CARPETA}`,
    `cat > ${AYUDANTE_ARCHIVO}`,
    `chmod 700 ${AYUDANTE_ARCHIVO}`,
  ].join(" && ");
}

/** La orden que lo recoge al terminar (no deja nada suelto en `/tmp`). */
export function ordenQuitarAyudante() {
  return `rm -rf ${AYUDANTE_CARPETA}`;
}

/**
 * Lo que se le añade al entorno de cada `ssh`: dónde está el ayudante, que se use
 * aunque haya terminal, y la clave para que la lea. Va **solo** en el entorno de
 * los procesos hijos, nunca en el del comando ni en la línea de órdenes.
 */
export function entornoAyudante(clave) {
  return {
    SSH_ASKPASS: AYUDANTE_ARCHIVO,
    SSH_ASKPASS_REQUIRE: "force",
    [VAR_CLAVE]: clave,
  };
}

/** Cómo se lee la clave por la entrada estándar, en palabras sueltas de la orden. */
export const PALABRAS_CLAVE_LEER = ["read", "-r", `${VAR_CLAVE};`];

/**
 * Y cómo se le pasa a lo que viene después. Es una **asignación**, no el valor: en
 * la línea de órdenes solo va el nombre de la variable, que la shell del NAS
 * resuelve allí mismo. Así la contraseña no aparece nunca en un `ps` —ni en el
 * ordenador ni en el NAS— y una contraseña con espacios, comillas o puntos y comas
 * no rompe nada.
 */
export const PALABRA_CLAVE_PASAR = `${VAR_CLAVE}=$${VAR_CLAVE}`;

/**
 * La orden, con la clave leída antes de empezar: el `read` la toma de la entrada
 * estándar —que es el tubo por el que el comando del ordenador la manda— y la
 * asignación se la deja en el entorno a lo que venga detrás.
 */
export function conClave(orden) {
  return `${PALABRAS_CLAVE_LEER.join(" ")} ${PALABRA_CLAVE_PASAR} ${orden}`;
}

/**
 * El trozo que se les pone delante a los guiones que corren dentro del NAS, para
 * que `sudo` no pregunte: si la clave ha llegado por el entorno, `sudo` pasa a ser
 * una función que se la da por la entrada estándar (`-S`, sin texto de aviso).
 *
 * Es lo único que hay que tocar de un guion para que deje de pedir la contraseña, y
 * no cambia nada cuando se lanza **a mano** en el NAS —que es como se sale de un
 * apuro—: sin clave en el entorno no se define nada y manda el `sudo` de siempre.
 */
export function envoltorioClave() {
  return [
    "# --- La clave del NAS, si el comando la ha traido -----------------------------",
    "# El comando del ordenador la pide una vez y la trae por el entorno de esta",
    "# shell --nunca en la linea de ordenes, que se ve en \\`ps\\`-- cuando ha tenido",
    "# que teclearla para entrar. Con ella, \\`sudo\\` no pregunta nada: se la da por la",
    "# entrada estandar, que es lo que hace \\`-S\\`.",
    "#",
    "# Sin ella --el guion lanzado a mano en el NAS, que es como se recupera un",
    "# apuro--, manda el \\`sudo\\` de siempre y pregunta cuando le toque.",
    `if [ -n "\${${VAR_CLAVE}:-}" ]; then`,
    '  con_clave="si"',
    `  sudo() { printf '%s\\n' "$${VAR_CLAVE}" | command sudo -S -p '' "$@"; }`,
    "else",
    '  con_clave="no"',
    "fi",
  ].join("\n");
}

/**
 * ¿Hace falta preguntar la contraseña después de este intento de entrar?
 *
 * Solo cuando el NAS la pide: OpenSSH contesta `Permission denied (publickey,password)`
 * cuando el intento no lleva clave y no hay dónde teclearla. Un host que no
 * resuelve, un puerto cerrado o una conexión que se agota dicen otra cosa, y
 * preguntar la contraseña ahí sería molestar para nada.
 */
export function haceFaltaClave(texto = "") {
  return /permission denied/i.test(String(texto));
}

/**
 * ¿Este `ssh` podría usar el ayudante? El de Windows —`OpenSSH_for_Windows`— no
 * lo admite —tampoco sabe reutilizar conexiones—, así que desde él la contraseña
 * se teclea una vez por conexión; desde el `ssh` de Git Bash, una sola vez para
 * todo el comando.
 */
export function esSshDeMsys(version = "") {
  return !/_for_windows/i.test(String(version));
}

/**
 * Oculta contraseñas y secretos para que nunca salgan en trazas de error o salidas de consola.
 */
export function ocultarSecretos(texto = "", clave = null) {
  if (!texto) return "";
  let resultado = String(texto);
  if (clave && typeof clave === "string" && clave.length > 0) {
    resultado = resultado.replaceAll(clave, "********");
  }
  // Enmascara patrones comunes de credenciales o tokens (clave=..., password: ..., etc.)
  resultado = resultado.replace(
    /(password|secret|token|clave|secret_key|jwt|authorization)([:=\s]+)([^\s,;]+)/gi,
    "$1$2********",
  );
  return resultado;
}
