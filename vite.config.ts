/// <reference types="vitest/config" />
// El bloque de pruebas de abajo (`test`) lo entiende Vitest y no Vite, y por eso
// hace falta la referencia: importar `defineConfig` de `vitest/config` ataría la
// compilación del sitio a que Vitest esté instalado, y esto solo son tipos.
import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";

/**
 * El hueco que la CSP deja donde va la dirección pública de la API, y el archivo
 * donde la compilación escribe lo que hay que poner en él.
 *
 * La política de seguridad del sitio —la del `index.html` y la de nginx, que son
 * la misma dicha dos veces— no puede nombrar la dirección de la API de una
 * instalación concreta: el repositorio no sabe si el taller vive en
 * `api.tudominio.com` o dentro de una red local. Pero dejarla fuera no es una
 * opción: `connect-src` es una lista cerrada, y si la dirección no está en ella
 * el navegador no deja que la app llame a su propia API —ni la conexión en vivo
 * ni la descarga de un parte—. La app se queda entonces diciendo que la API no
 * responde, con el backend en pie y contestando.
 *
 * Así que la dirección entra al compilar, que es cuando ya se sabe
 * (`VITE_CONVEX_URL`, la misma que Vite graba dentro del sitio): aquí se rellena
 * el hueco del `index.html` y se deja el valor en `pulso-csp.txt`, que es lo que
 * lee el `Dockerfile` del NAS para rellenar la cabecera de nginx. Una regla, dos
 * sitios, y el mismo valor en los dos.
 */
export const API_CSP_TOKEN = "__PULSO_API_CONNECT_SRC__";
export const API_CSP_ASSET = "pulso-csp.txt";

/**
 * Las direcciones que hay que autorizar para hablar con la API, en las dos formas
 * que usa el navegador: la de las peticiones —descargar el parte, subir una
 * foto— y la de la conexión en vivo, que va por WebSocket.
 *
 * Van las dos porque la coincidencia de esquemas de una CSP es literal: un
 * `https://` no autoriza el `wss://` de la misma casa. El esquema se copia del
 * valor de origen, para que una instalación local no acabe autorizando un `https`
 * que no sirve; y sin dirección —una compilación sin `VITE_CONVEX_URL`— no se
 * devuelve nada, que deja la política como estaba en lugar de con una entrada
 * inválida dentro.
 */
export function apiConnectSources(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
  if (host === "") return "";
  const plain = /^(http|ws):\/\//i.test(raw);
  return plain ? `http://${host} ws://${host}` : `https://${host} wss://${host}`;
}

/**
 * Mete esa dirección en la CSP del sitio y deja escrita la que le toca a nginx.
 *
 * El hueco se rellena también al servir (`npm run dev`), no solo al compilar: una
 * entrada sin sustituir en una política es una entrada inválida, y el navegador
 * lo cuenta por la consola.
 */
function apiCspPlugin(): Plugin {
  let sources = "";
  // El apunte solo se escribe al compilar: al servir no hay una carpeta de salida
  // donde dejarlo, y el propio Vite avisa de que ahí no pinta nada.
  let building = false;
  return {
    name: "pulso-api-csp",
    configResolved(config) {
      building = config.command === "build";
      sources = apiConnectSources(
        process.env.VITE_CONVEX_URL ?? config.env.VITE_CONVEX_URL,
      );
    },
    transformIndexHtml(html) {
      return html.split(API_CSP_TOKEN).join(sources);
    },
    buildStart() {
      if (!building) return;
      this.emitFile({ type: "asset", fileName: API_CSP_ASSET, source: sources });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vlyPlugin(), tailwindcss(), apiCspPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and lazy loading
        manualChunks: {
          // Vendor chunks for large libraries
          'react-vendor': ['react', 'react-dom', 'react-router'],
          // Large UI library chunks
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          // Heavy optional libraries - separate chunks for better lazy loading
          'framer-motion': ['framer-motion'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@convex-dev/auth/react',
      'framer-motion',
      // vlyPlugin() injects this import at serve time, so the dep scanner
      // never sees it. Without it here the first page load discovers it,
      // re-optimizes and full-reloads the preview mid-screenshot.
      '@vly-ai/integrations',
    ],
  },
  test: {
    // El grafo de funciones de Convex lo carga el arnés y no la primera prueba
    // de cada archivo: ese trabajo era el que agotaba el plazo de esa prueba al
    // correr la suite entera. Por qué se carga, y por qué no se sube el plazo,
    // está en ese mismo archivo: `tests/setup/precalentarModulos.ts`.
    setupFiles: ["tests/setup/precalentarModulos.ts"],
  },
  // Performance hints
  server: { allowedHosts: true,
    // Bind to all interfaces so the browser runtime's server-ready event fires.
    host: true,
    port: 5173,
    // Keep HMR on, but disable full-screen error overlay
    hmr: {
      overlay: false,
    },
  },
});
