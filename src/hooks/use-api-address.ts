import { useConvexConnectionState } from "convex/react";
import { useCallback, useEffect, useState } from "react";

import {
  API_GRACE_MS,
  addressAnswers,
  apiAddressTrouble,
  type ApiAddressTrouble,
} from "@/lib/apiAddress";
import { apiOrigin } from "@/lib/attachment";

/**
 * ¿Responde la dirección pública de la API desde este navegador? La regla está en
 * `lib/apiAddress`; aquí solo se le dan los datos: lo que dice la propia conexión
 * de la app (`useConvexConnectionState`) y lo que contesta una petición normal.
 *
 * La petición se hace **una sola vez por intento** y solo cuando ya ha pasado el
 * margen de cortesía y la app sigue sin haber conectado nunca: mientras la
 * dirección no responda, preguntar cada segundo no cuenta nada nuevo. Se vuelve a
 * preguntar a mano —«Volver a comprobar»— o cuando cambia el estado de la
 * conexión.
 *
 * Va en su propio módulo, como los demás enganches del taller, para que el
 * componente que lo usa solo exporte componentes.
 */
export function useApiAddress({
  apiUrl = apiOrigin(),
  graceMs = API_GRACE_MS,
}: { apiUrl?: string | null; graceMs?: number } = {}): {
  trouble: ApiAddressTrouble | null;
  /** Vuelve a preguntarle a la dirección, sin esperar a nada. */
  recheck: () => void;
} {
  const connection = useConvexConnectionState();
  const everConnected = connection.hasEverConnected;
  const connected = connection.isWebSocketConnected;

  // Cuánto lleva la app intentándolo. El reloj solo anda mientras no haya
  // conectado nunca: en cuanto lo hace, el aviso sobra.
  const [waitedMs, setWaitedMs] = useState(0);
  useEffect(() => {
    if (everConnected || connected) return;
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setWaitedMs(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [everConnected, connected]);

  // Lo que ha contestado una petición normal: `null` mientras no se sepa, que es
  // distinto de «no contesta».
  const [answers, setAnswers] = useState<boolean | null>(null);
  const [checks, setChecks] = useState(0);
  const pastGrace = waitedMs >= graceMs;

  useEffect(() => {
    if (everConnected || connected || !pastGrace) return;
    let cancelled = false;
    void addressAnswers(apiUrl).then((result) => {
      if (!cancelled) setAnswers(result);
    });
    return () => {
      cancelled = true;
    };
    // `checks` está a propósito: «Volver a comprobar» vuelve a preguntar.
  }, [apiUrl, everConnected, connected, pastGrace, checks]);

  const recheck = useCallback(() => {
    setAnswers(null);
    setChecks((count) => count + 1);
  }, []);

  return {
    trouble: apiAddressTrouble({
      apiUrl,
      pageProtocol:
        typeof window === "undefined" ? null : window.location.protocol,
      everConnected,
      connected,
      waitedMs,
      answers,
      graceMs,
    }),
    recheck,
  };
}
