import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { API_CSP_ASSET, API_CSP_TOKEN, apiConnectSources } from "../vite.config";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const INDEX_HTML = join(RAIZ, "index.html");
const NGINX_CONF = join(RAIZ, "docker", "synology", "nginx.conf");
const DOCKERFILE = join(RAIZ, "docker", "synology", "Dockerfile");

describe("seguridad: cabeceras HTTP y Content Security Policy (CSP)", () => {
  test("index.html incluye meta tags de seguridad y Content-Security-Policy estricta", () => {
    const html = readFileSync(INDEX_HTML, "utf8");

    // X-Content-Type-Options: nosniff
    expect(html).toContain('http-equiv="X-Content-Type-Options" content="nosniff"');

    // Referrer-Policy
    expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"');

    // Content-Security-Policy
    expect(html).toContain('http-equiv="Content-Security-Policy"');

    // Directivas esenciales de CSP en index.html
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(html).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(html).toContain("img-src 'self' data: blob: https:");
    expect(html).toContain("connect-src 'self' https://*.convex.cloud wss://*.convex.cloud");
  });

  test("nginx.conf en docker/synology define cabeceras defensivas y anti-clickjacking", () => {
    const conf = readFileSync(NGINX_CONF, "utf8");

    // Anti-clickjacking
    expect(conf).toMatch(/add_header\s+X-Frame-Options\s+"DENY"\s+always;/);

    // MIME sniffing protection
    expect(conf).toMatch(/add_header\s+X-Content-Type-Options\s+"nosniff"\s+always;/);

    // Referrer policy
    expect(conf).toMatch(/add_header\s+Referrer-Policy\s+"strict-origin-when-cross-origin"\s+always;/);

    // HSTS (HTTP Strict Transport Security)
    expect(conf).toMatch(/add_header\s+Strict-Transport-Security\s+"max-age=31536000;\s*includeSubDomains"\s+always;/);

    // CSP con frame-ancestors 'none'
    expect(conf).toContain('add_header Content-Security-Policy');
    expect(conf).toContain("frame-ancestors 'none'");
    expect(conf).toContain("default-src 'self'");
    expect(conf).toContain("connect-src 'self' https://*.convex.cloud wss://*.convex.cloud");
  });
});

/**
 * La CSP autoriza, además de Convex Cloud, la dirección de la API de **esta**
 * instalación: sin ella el navegador no deja que la app llame a su propia API y
 * el aviso que se ve es «No se puede hablar con la API del taller · No responde»,
 * con el backend en pie y contestando a quien pregunte por él directamente.
 *
 * La dirección entra al compilar, que es cuando se sabe (`VITE_CONVEX_URL`), y
 * entra en los dos sitios donde hay una política: el `index.html` y la cabecera de
 * nginx. Aquí se vigila que los dos dejen el hueco, que la regla meta las dos
 * formas de la dirección y que la imagen de nginx reciba el valor de la
 * compilación en lugar de deducirlo por su cuenta.
 */
describe("seguridad: la CSP autoriza la API de esta instalación", () => {
  test("los dos sitios donde hay una política dejan el hueco de la dirección", () => {
    expect(readFileSync(INDEX_HTML, "utf8")).toContain(API_CSP_TOKEN);
    expect(readFileSync(NGINX_CONF, "utf8")).toContain(API_CSP_TOKEN);
  });

  test("la dirección entra en las dos formas: peticiones y conexión en vivo", () => {
    // El caso del NAS con dominio: es el que dejó la app sin datos.
    expect(apiConnectSources("https://api.videoingenieria.es")).toBe(
      "https://api.videoingenieria.es wss://api.videoingenieria.es",
    );

    // Una instalación de red local no acaba autorizando un `https` que no existe:
    // el esquema se copia del que trae la dirección.
    expect(apiConnectSources("http://192.168.0.47:3210")).toBe(
      "http://192.168.0.47:3210 ws://192.168.0.47:3210",
    );

    // El camino y la barra final no son parte de la casa.
    expect(apiConnectSources("https://api.tudominio.com/")).toBe(
      "https://api.tudominio.com wss://api.tudominio.com",
    );

    // Sin dirección no se inventa una entrada, que invalidaría la política entera.
    expect(apiConnectSources(undefined)).toBe("");
    expect(apiConnectSources("")).toBe("");
  });

  test("la política queda rellena, y sin huecos, cuando la compilación la sustituye", () => {
    const address = apiConnectSources("https://api.tudominio.com");

    for (const ruta of [INDEX_HTML, NGINX_CONF]) {
      const rellena = readFileSync(ruta, "utf8")
        .split(API_CSP_TOKEN)
        .join(address);

      expect(rellena).not.toContain(API_CSP_TOKEN);
      expect(rellena).toContain(
        `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud ${address}`,
      );
    }
  });

  test("la imagen de nginx recibe la dirección de la compilación, no la adivina", () => {
    const dockerfile = readFileSync(DOCKERFILE, "utf8");

    // La compilación deja el valor escrito, y la imagen lo lee de ahí...
    expect(dockerfile).toContain(API_CSP_ASSET);

    // ...y lo pone en la cabecera que sirve, borrando el apunte de en medio.
    expect(dockerfile).toContain(`sed -i "s|${API_CSP_TOKEN}|`);
    expect(dockerfile).toContain("/etc/nginx/conf.d/default.conf");
  });
});
