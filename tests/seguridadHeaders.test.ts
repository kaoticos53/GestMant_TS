import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const INDEX_HTML = join(RAIZ, "index.html");
const NGINX_CONF = join(RAIZ, "docker", "synology", "nginx.conf");

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
