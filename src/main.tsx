import { Toaster } from "@/components/ui/sonner";
import { ApiAddressNotice } from "@/components/ApiAddressNotice";
import { PwaUpdateBanner } from "@/components/PwaUpdateBanner";
import { offerUpdate } from "@/lib/pwaUpdate";
import { RequireAuth } from "@/components/RequireAuth";
import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect, lazy, Suspense } from "react";
import { registerSW } from "virtual:pwa-register";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing"));
const AuthPage = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ReportIncident = lazy(() => import("./pages/ReportIncident"));
const FollowIncident = lazy(() => import("./pages/FollowIncident"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/**
 * La barra de previsualización del entorno de diseño, y no del taller.
 *
 * Antes se importaba de forma estática: entraba en el grafo de todos los
 * arranques —también en producción— y, como ese archivo exporta el componente y
 * además utilidades de anotación, saltaba el aviso de Fast Refresh en cada
 * guardado. Ahora se pide solo si es desarrollo y si alguien la enciende con
 * `VITE_VLY_TOOLBAR=true`; así el editor no la carga, el panel no la arrastra y
 * cuando hace falta aparece sin tocar el resto de la aplicación.
 */
const VlyToolbar =
  import.meta.env.DEV && import.meta.env.VITE_VLY_TOOLBAR === "true"
    ? lazy(() =>
        import("../vly-toolbar-readonly.tsx").then((m) => ({
          default: m.VlyToolbar,
        })),
      )
    : null;

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      Los dos límites son el mismo componente que ya protege los módulos del
      panel (`components/ModuleErrorBoundary`): uno para que un fallo de la
      barra de previsualización no tumbe la aplicación —y ahí no se pinta nada,
      que la barra es una ayuda, no la app— y otro para que un error de
      renderizado no deje la pantalla en blanco sin decir qué pasó.
    */}
    <ModuleErrorBoundary
      moduleName="la aplicación"
      title="Algo ha fallado al abrir el taller"
      onReset={() => window.location.reload()}
    >
      {VlyToolbar && (
        <ModuleErrorBoundary moduleName="la barra de herramientas" fallback={null}>
          <Suspense fallback={null}>
            <VlyToolbar />
          </Suspense>
        </ModuleErrorBoundary>
      )}
      <ConvexAuthProvider client={convex}>
        {/* Va aquí, fuera de las rutas y del `RequireAuth`: si la dirección
            pública de la API no responde, quien se queda fuera es justo quien no
            llega al panel, y es ahí donde hace falta la explicación. */}
        <ApiAddressNotice />
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route path="/reportar" element={<ReportIncident />} />
              {/* La dirección del enlace del correo: pública, sin sesión. */}
              <Route path="/seguimiento" element={<FollowIncident />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        <PwaUpdateBanner />
      </ConvexAuthProvider>
    </ModuleErrorBoundary>
  </StrictMode>,
);

/**
 * Cada cuánto se pregunta por una compilación nueva mientras la pestaña sigue
 * abierta.
 *
 * El navegador solo busca un service worker nuevo al navegar —y al navegar la
 * página ya se recarga, así que el aviso llega tarde— y, como mucho, una vez al
 * día. Sin esta comprobación, una pestaña abierta toda la mañana no se enteraba
 * de que había versión nueva: era justo el caso que el aviso tenía que cubrir.
 * Un `sw.js` de 7 KB por minuto, que además se sirve sin caché.
 */
const UPDATE_CHECK_MS = 60_000;

// El service worker lo genera `vite-plugin-pwa` al compilar (ver
// `vite.config.ts`); aquí solo se registra. La compilación nueva se queda
// esperando —`prompt`, sin `skipWaiting`— y se avisa con el número de build de
// la pestaña: recarga quien pulsa «Recargar», no la aplicación por detrás.
if (import.meta.env.PROD) {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      offerUpdate(() => void updateServiceWorker(true));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_MS);
      // Volver a la pestaña es el otro momento en que importa: un portátil que
      // despierta de la suspensión tiene la compilación de ayer en memoria.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void registration.update();
        }
      });
    },
  });
}
