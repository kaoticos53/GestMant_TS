import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  API_CSP_ASSET,
  API_CSP_TOKEN,
  API_IMG_CSP_ASSET,
  API_IMG_CSP_TOKEN,
  apiConnectSources,
  apiImageSources,
} from "../vite.config";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const INDEX_HTML = join(RAIZ, "index.html");
const NGINX_CONF = join(RAIZ, "docker", "synology", "nginx.conf");
const SECURITY_HEADERS_CONF = join(
  RAIZ,
  "docker",
  "synology",
  "security-headers.conf",
);
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

    // Directivas esenciales de CSP en index.html (sin img-src https: abierto)
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(html).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(html).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(html).toContain("img-src 'self' data: blob: https://*.convex.cloud");
    expect(html).not.toMatch(/img-src[^;]*\shttps:(\s|;)/);
    expect(html).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(html).toContain(
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://challenges.cloudflare.com",
    );
  });

  test("nginx.conf y security-headers.conf definen cabeceras defensivas en todos los bloques location", () => {
    const conf = readFileSync(NGINX_CONF, "utf8");
    const headers = readFileSync(SECURITY_HEADERS_CONF, "utf8");

    expect(conf).toContain("server_tokens off;");
    expect(conf).toContain("include /etc/nginx/snippets/security-headers.conf;");
    // location /assets/ y location = /index.html también incluyen las cabeceras
    // porque definir `add_header Cache-Control` anula la herencia en nginx.
    expect(conf).toMatch(
      /location \/assets\/\s*\{[^}]*include \/etc\/nginx\/snippets\/security-headers\.conf;/s,
    );
    expect(conf).toMatch(
      /location = \/index\.html\s*\{[^}]*include \/etc\/nginx\/snippets\/security-headers\.conf;/s,
    );

    // Anti-clickjacking
    expect(headers).toMatch(/add_header\s+X-Frame-Options\s+"DENY"\s+always;/);

    // MIME sniffing protection
    expect(headers).toMatch(/add_header\s+X-Content-Type-Options\s+"nosniff"\s+always;/);

    // Referrer policy
    expect(headers).toMatch(/add_header\s+Referrer-Policy\s+"strict-origin-when-cross-origin"\s+always;/);

    // Permissions-Policy
    expect(headers).toMatch(/add_header\s+Permissions-Policy\s+"camera=\(\), microphone=\(\), geolocation=\(\)"\s+always;/);

    // HSTS (HTTP Strict Transport Security)
    expect(headers).toMatch(/add_header\s+Strict-Transport-Security\s+"max-age=31536000;\s*includeSubDomains"\s+always;/);

    // CSP con frame-ancestors 'none' y img-src acotado
    expect(headers).toContain("add_header Content-Security-Policy");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("img-src 'self' data: blob: https://*.convex.cloud");
    expect(headers).not.toMatch(/img-src[^;]*\shttps:(\s|;)/);
    expect(headers).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(headers).toContain(
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://challenges.cloudflare.com",
    );
  });
});

/**
 * La CSP autoriza, además de Convex Cloud, la dirección de la API de **esta**
 * instalación tanto para conexiones (`connect-src`) como para imágenes de
 * `_storage` (`img-src`).
 */
describe("seguridad: la CSP autoriza la API de esta instalación", () => {
  test("los dos sitios donde hay una política dejan los huecos de la dirección", () => {
    expect(readFileSync(INDEX_HTML, "utf8")).toContain(API_CSP_TOKEN);
    expect(readFileSync(INDEX_HTML, "utf8")).toContain(API_IMG_CSP_TOKEN);
    expect(readFileSync(SECURITY_HEADERS_CONF, "utf8")).toContain(API_CSP_TOKEN);
    expect(readFileSync(SECURITY_HEADERS_CONF, "utf8")).toContain(API_IMG_CSP_TOKEN);
  });

  test("la dirección entra en las dos formas: peticiones y conexión en vivo", () => {
    expect(apiConnectSources("https://api.videoingenieria.es")).toBe(
      "https://api.videoingenieria.es wss://api.videoingenieria.es",
    );
    expect(apiImageSources("https://api.videoingenieria.es")).toBe(
      "https://api.videoingenieria.es",
    );

    expect(apiConnectSources("http://192.168.0.47:3210")).toBe(
      "http://192.168.0.47:3210 ws://192.168.0.47:3210",
    );
    expect(apiImageSources("http://192.168.0.47:3210")).toBe(
      "http://192.168.0.47:3210",
    );

    expect(apiConnectSources("https://api.tudominio.com/")).toBe(
      "https://api.tudominio.com wss://api.tudominio.com",
    );

    expect(apiConnectSources(undefined)).toBe("");
    expect(apiConnectSources("")).toBe("");
    expect(apiImageSources(undefined)).toBe("");
    expect(apiImageSources("")).toBe("");
  });

  test("la política queda rellena, y sin huecos, cuando la compilación la sustituye", () => {
    const address = apiConnectSources("https://api.tudominio.com");
    const imgAddress = apiImageSources("https://api.tudominio.com");

    for (const ruta of [INDEX_HTML, SECURITY_HEADERS_CONF]) {
      const rellena = readFileSync(ruta, "utf8")
        .split(API_CSP_TOKEN)
        .join(address)
        .split(API_IMG_CSP_TOKEN)
        .join(imgAddress);

      expect(rellena).not.toContain(API_CSP_TOKEN);
      expect(rellena).not.toContain(API_IMG_CSP_TOKEN);
      expect(rellena).toContain(
        `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://challenges.cloudflare.com ${address}`,
      );
      expect(rellena).toContain(
        `img-src 'self' data: blob: https://*.convex.cloud ${imgAddress}`,
      );
    }
  });

  test("la imagen de nginx recibe las direcciones de la compilación, no las adivina", () => {
    const dockerfile = readFileSync(DOCKERFILE, "utf8");

    expect(dockerfile).toContain(API_CSP_ASSET);
    expect(dockerfile).toContain(API_IMG_CSP_ASSET);
    expect(dockerfile).toContain(API_CSP_TOKEN);
    expect(dockerfile).toContain(API_IMG_CSP_TOKEN);
    expect(dockerfile).toContain("/etc/nginx/snippets/security-headers.conf");
  });
});
