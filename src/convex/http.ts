import { httpRouter } from "convex/server";
import { APP_VERSION, BUILD_NUMBER } from "../version";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Las sondas de salud del taller, que miran Docker, Nginx y `npm run local:check`
 * sin sesión y sin abrir la conexión en vivo.
 *
 * Van en las acciones HTTP —y no en una consulta— porque quien las llama no
 * habla Convex: un contenedor, un proxy inverso o un script que solo sabe hacer
 * `GET`. Por eso también viven **fuera** de la autenticación: una sonda que
 * exige sesión no sirve para saber si el servicio está en pie.
 *
 * Ojo con el puerto: las acciones HTTP se sirven en el *site origin* (`3211` en
 * el entorno local, `CONVEX_SITE_ORIGIN` en el NAS), no en el `3210` de la API.
 * La salud del contenedor de Convex —que existe incluso antes de que haya
 * funciones desplegadas— se sigue mirando en `:3210/version`; `/healthz` y
 * `/readyz` responden por el código ya desplegado, que es otra cosa: sirven para
 * saber si la aplicación funciona, no si el proceso escucha.
 *
 * No cuentan nada del taller: ni filas, ni nombres, ni configuración. Una sonda
 * pública que enumera lo que hay dentro es una fuga, no una sonda.
 */

/** Cabeceras de las dos sondas: JSON y nada de caché. */
const HEALTH_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  // Un proxy que cachea una sonda contesta por ella: deja de mirar el servicio
  // y pasa a mirar su propia copia.
  "Cache-Control": "no-store",
};

function healthResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: HEALTH_HEADERS,
  });
}

/** La versión que se está sirviendo, sin commit ni fecha de compilación. */
const VERSION = { version: APP_VERSION, build: BUILD_NUMBER };

/**
 * ¿Está el servicio en pie? Responde sin tocar la base: es la sonda de
 * *vida* —el proceso atiende peticiones—, y por eso no puede fallar por culpa
 * de un almacenamiento lento. Si el proceso no puede ni contestar, no hay
 * respuesta, y eso también es una respuesta para quien la espera.
 */
http.route({
  path: "/healthz",
  method: "GET",
  handler: httpAction(async () =>
    healthResponse(
      {
        status: "healthy",
        service: "pulso-taller",
        ...VERSION,
        timestamp: Date.now(),
      },
      200,
    ),
  ),
});

/**
 * ¿Puede el servicio hacer su trabajo? Además de estar en pie, comprueba que la
 * base responde con una lectura barata (`health.ready`). Cuando falla, contesta
 * `503` con lo justo —qué comprobación no ha pasado—, sin el error del
 * servidor: quien lee una sonda pública no tiene por qué ver el interior.
 */
http.route({
  path: "/readyz",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const startedAt = Date.now();
    try {
      const probe = await ctx.runQuery(internal.health.ready, {});
      return healthResponse(
        {
          status: "ready",
          service: "pulso-taller",
          ...VERSION,
          checks: { database: { ok: true, latencyMs: probe.latencyMs } },
          timestamp: Date.now(),
        },
        200,
      );
    } catch {
      return healthResponse(
        {
          status: "unready",
          service: "pulso-taller",
          ...VERSION,
          checks: {
            database: { ok: false, latencyMs: Date.now() - startedAt },
          },
          timestamp: Date.now(),
        },
        503,
      );
    }
  }),
});

export default http;
