import { api } from "@/convex/_generated/api";
import {
  POW_MIN_DELAY_MS,
  solvePowChallenge,
  type HumanChallengePayload,
  type SignedPowChallenge,
} from "@/lib/humanChallenge";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requiere navegador."));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("No se pudo inicializar Cloudflare Turnstile."));
    };
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error("No se pudo cargar la verificación de seguridad."));
    };
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

/**
 * Gestiona la verificación anti-bot invisible para visitantes anónimos:
 * - Si hay sesión iniciada de taller: sin reto.
 * - Si `VITE_TURNSTILE_SITE_KEY` está configurada: Cloudflare Turnstile.
 * - En caso contrario, si el backend pide PoW: resuelve Proof-of-Work propio.
 */
export function useHumanChallenge(isAuthenticated: boolean) {
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const useTurnstile = !isAuthenticated && siteKey !== "";

  const modeState = useQuery(
    api.humanChallenge.mode,
    isAuthenticated ? "skip" : {},
  );
  const issuePow = useAction(api.humanChallenge.issuePow);

  const powRef = useRef<SignedPowChallenge | null>(null);
  const powFetchingRef = useRef<Promise<SignedPowChallenge | null> | null>(
    null,
  );

  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileWaitersRef = useRef<Array<(token: string) => void>>([]);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  const fetchNextPow = useCallback(async () => {
    if (isAuthenticated || useTurnstile) return null;
    if (powFetchingRef.current) return await powFetchingRef.current;
    const promise = issuePow({})
      .then((challenge) => {
        powRef.current = challenge;
        return challenge;
      })
      .catch(() => null)
      .finally(() => {
        powFetchingRef.current = null;
      });
    powFetchingRef.current = promise;
    return await promise;
  }, [isAuthenticated, issuePow, useTurnstile]);

  // Pre-emitir un reto PoW al abrir el formulario para que el Time-Trap
  // transcurra de forma natural mientras el usuario redacta la incidencia.
  useEffect(() => {
    if (isAuthenticated || useTurnstile) return;
    if (modeState?.mode === "pow" && powRef.current === null) {
      void fetchNextPow();
    }
  }, [fetchNextPow, isAuthenticated, modeState?.mode, useTurnstile]);

  // Montar Turnstile cuando haya Site Key y el usuario sea anónimo.
  useEffect(() => {
    if (!useTurnstile) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    void loadTurnstileScript()
      .then((apiTs) => {
        if (cancelled || !containerRef.current) return;
        setWidgetError(null);
        const id = apiTs.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => {
            turnstileTokenRef.current = token;
            const waiters = turnstileWaitersRef.current.splice(0);
            for (const wake of waiters) wake(token);
          },
          "expired-callback": () => {
            turnstileTokenRef.current = null;
          },
          "error-callback": () => {
            turnstileTokenRef.current = null;
            setWidgetError(
              "No se pudo completar la verificación anti-bot. Reintenta en unos segundos.",
            );
          },
        });
        widgetIdRef.current = id;
      })
      .catch((err) => {
        if (!cancelled) {
          setWidgetError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la verificación de seguridad.",
          );
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      turnstileTokenRef.current = null;
    };
  }, [siteKey, useTurnstile]);

  const resolveChallenge = useCallback(async (): Promise<
    HumanChallengePayload | undefined
  > => {
    if (isAuthenticated) return undefined;

    if (useTurnstile) {
      let token = turnstileTokenRef.current;
      if (!token) {
        token = await new Promise<string>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(
              new Error(
                "Completa la verificación de seguridad antes de continuar.",
              ),
            );
          }, 15_000);
          turnstileWaitersRef.current.push((nextToken) => {
            window.clearTimeout(timer);
            resolve(nextToken);
          });
        });
      }
      turnstileTokenRef.current = null;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      return { kind: "turnstile", token };
    }

    if (modeState?.mode === "none") return undefined;

    const challenge = powRef.current ?? (await fetchNextPow());
    if (!challenge) return undefined;
    powRef.current = null;

    const elapsed = Date.now() - challenge.issuedAt;
    if (elapsed < POW_MIN_DELAY_MS) {
      await new Promise((r) => setTimeout(r, POW_MIN_DELAY_MS - elapsed));
    }

    const nonce = await solvePowChallenge(challenge.salt, challenge.bits);
    // Pre-cargar el siguiente reto en segundo plano por si el usuario adjunta otra foto o reintenta.
    void fetchNextPow();

    return {
      kind: "pow",
      ...challenge,
      nonce,
    };
  }, [fetchNextPow, isAuthenticated, modeState?.mode, useTurnstile]);

  return {
    useTurnstile,
    containerRef,
    widgetError,
    resolveChallenge,
  };
}

