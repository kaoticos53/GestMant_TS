#!/usr/bin/env node
/**
 * Arranca el relevo de correo del taller.
 *
 *   npm run mail:relay
 *
 * Es el puente que se configura en Ajustes del taller → Servidor de correo →
 * «Relevo propio»: recibe el sobre por HTTP y lo entrega por SMTP al servidor de
 * correo de la casa. La lógica vive en `mail-relay-lib.mjs`; aquí solo se lee el
 * entorno, se arranca el servidor y se dice por dónde escucha.
 *
 * Lo único que se imprime del servidor SMTP es su dirección y el modo de
 * cifrado: ni la contraseña ni el testigo salen por pantalla, ni al arrancar ni
 * al cerrar. Y si el testigo está apagado, se dice bien claro, porque el relevo
 * queda abierto a cualquiera que lo alcance en la red.
 */

import {
  createRelayServer,
  readRelayConfig,
  resolveSmtp,
  sendSmtp,
  verifySmtp,
} from "./mail-relay-lib.mjs";

const HELP = `Relevo de correo del taller

Uso:
  node scripts/mail-relay.mjs            (o: npm run mail:relay)
  node scripts/mail-relay.mjs --help

Variables de entorno:
  MAIL_RELAY_PORT            puerto del puente (por defecto 8788)
  MAIL_RELAY_HOST            interfaz donde escucha (por defecto 0.0.0.0)
  MAIL_RELAY_PATH            ruta del sobre (por defecto /enviar)
  MAIL_RELAY_TOKEN           testigo que debe traer el backend (recomendado)
  MAIL_RELAY_MAX_BODY_BYTES  tamaño máximo del sobre (por defecto 1 MB)

  SMTP_HOST                  servidor de correo al que entregar (opcional: sin él
                             solo se entregan los sobres que traen el suyo, como
                             Gmail o el buzón de pruebas)
  SMTP_PORT                  su puerto (por defecto 587)
  SMTP_TLS                   auto | starttls | ssl | none (por defecto auto; 465 usa ssl)
  SMTP_USER / SMTP_PASS      credenciales, si el servidor las pide
  SMTP_FROM                  remitente fijo, si el servidor exige uno concreto
  SMTP_HELO                  nombre con el que se saluda (por defecto pulso-taller.local)
  SMTP_REJECT_UNAUTHORIZED   false para certificados propios sin CA (por defecto true)
  SMTP_TIMEOUT_MS            lo que se espera al servidor (por defecto 20000)

El servidor de arriba es el de siempre: el del taller. Un sobre puede traer el
suyo —así funcionan «Gmail (Google)» y «Ethereal (pruebas)» en los ajustes, que
mandan su host, su puerto, su cifrado y sus credenciales para esa entrega—. Si
lo trae, se entrega por él y el remitente SMTP pasa a ser esa misma cuenta,
salvo que SMTP_FROM diga otra cosa.

Al arrancar, y antes de servir nada, el relevo comprueba el servidor de correo:
se conecta, se autentica y corta, sin mandar ningún correo. Deja el resultado en
el registro; si falla, sigue escuchando y lo dice, porque un servidor que aún no
ha levantado no puede dejar al taller sin puente.

La misma comprobación se puede pedir a mano, sin mandar nada:

  curl -X POST http://127.0.0.1:8788/comprobar \
    -H 'Authorization: Bearer <MAIL_RELAY_TOKEN>' \
    -d '{}'

Devuelve 200 con el servidor, el cifrado y el método de autenticación; 401 sin el
testigo y 502 con el motivo si el servidor de correo no contesta o rechaza las
credenciales.

En Ajustes del taller, elige «Relevo propio» —o Gmail, o Ethereal— y pon la
dirección del puente —por ejemplo http://host.docker.internal:8788/enviar si el
backend va en Docker— y, si lo has puesto, el mismo testigo.`;

const SIGNALS = ["SIGINT", "SIGTERM"];

/** La dirección que se imprime: `0.0.0.0` no se puede teclear en un navegador. */
function displayHost(host) {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

function describeTls(config) {
  if (config.tls === "ssl") return "TLS directo";
  if (config.tls === "starttls") return "STARTTLS obligatorio";
  if (config.tls === "none") return "sin cifrar";
  return "STARTTLS si el servidor lo ofrece";
}

/** Qué método de autenticación aceptó el servidor, si hubo que autenticarse. */
function describeAuth(result) {
  return result.auth === null ? "sin autenticación" : `AUTH ${result.auth}`;
}

/**
 * La comprobación previa del servidor del entorno: conecta, se autentica y corta,
 * sin mandar ningún correo, para que el arranque diga si el relevo puede entregar
 * o qué le falta. No impide arrancar —el servidor de correo puede estar en otra
 * máquina y tardar más que este proceso—, pero deja el motivo escrito antes de
 * que llegue el primer aviso.
 */
async function checkSmtpOnce(config) {
  const target = `${config.smtp.host}:${config.smtp.port}`;
  try {
    const result = await verifySmtp(config.smtp);
    console.log(
      `Comprobación de ${target}: conexión y autenticación correctas (${describeTls(
        config.smtp,
      )}, ${describeAuth(result)}).`,
    );
  } catch (error) {
    console.log(`Comprobación de ${target} fallida: ${error.message}`);
    console.log(
      "El relevo sigue escuchando. Los envíos que traen su propio servidor —Gmail, buzones de pruebas— no dependen de este.",
    );
  }
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  let config;
  try {
    config = readRelayConfig(process.env);
  } catch (error) {
    console.error(`No se puede arrancar el relevo: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const server = createRelayServer({
    config,
    // El servidor del sobre manda sobre el del entorno, pero solo en lo que es
    // suyo: el saludo, los tiempos y el certificado siguen siendo del relevo.
    // `resolveSmtp` decide qué servidor se usa y, si no hay ninguno —ni del
    // entorno ni en el sobre—, contesta con una frase que se puede leer en la
    // pantalla en vez de intentar conectar con un servidor vacío.
    send: (envelope, smtp) =>
      sendSmtp(resolveSmtp(config.smtp, smtp), envelope),
    // La comprobación usa el mismo servidor que la entrega: el del sobre si lo
    // trae, el del entorno si no. Es lo que se pide desde Ajustes del taller.
    verify: (smtp) => verifySmtp(resolveSmtp(config.smtp, smtp)),
    log: (line) => console.log(line),
  });

  server.on("error", (error) => {
    const hint =
      error && error.code === "EADDRINUSE"
        ? ` El puerto ${config.port} ya está ocupado: cambia MAIL_RELAY_PORT o para el otro proceso.`
        : "";
    console.error(
      `El relevo no pudo escuchar en el puerto ${config.port}: ${error.message}${hint}`,
    );
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    const url = `http://${displayHost(config.host)}:${config.port}${config.path}`;
    console.log(`Relevo de correo escuchando en ${url} (${config.host})`);
    if (config.smtp === null) {
      console.log(
        "Sin servidor SMTP propio (falta SMTP_HOST): se entregan los sobres que traen el suyo, como Gmail y el buzón de pruebas. Un sobre sin servidor se rechaza diciendo qué falta.",
      );
    } else {
      console.log(
        `Entrega por SMTP en ${config.smtp.host}:${config.smtp.port} (${describeTls(
          config.smtp,
        )})${config.smtp.from ? `, remitente fijo ${config.smtp.from}` : ""}.`,
      );
    }
    if (config.token === "") {
      console.log(
        "Aviso: no hay MAIL_RELAY_TOKEN, así que cualquiera que alcance este puerto puede mandar correo por él, con el servidor SMTP que quiera en el sobre.",
      );
    } else {
      console.log(
        "Testigo activado: el backend tiene que mandar el mismo MAIL_RELAY_TOKEN.",
      );
    }
    console.log(
      "En Ajustes del taller → Servidor de correo → Relevo propio, pon esa dirección como URL.",
    );
    if (config.smtp !== null) void checkSmtpOnce(config);
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n${signal}: cerrando el relevo...`);
    server.close(() => process.exit(0));
    // Si alguna conexión se queda colgada, no se espera para siempre.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  for (const signal of SIGNALS) process.on(signal, () => shutdown(signal));
}

main();
