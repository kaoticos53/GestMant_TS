import { api } from "@/convex/_generated/api";
import { MAIL_PROVIDER_META, usesMailRelay } from "@/lib/mail";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MailCheckState, MailServerSettingsDoc } from "../types";

export function useMailPathCheck(
  settings: MailServerSettingsDoc | undefined,
  history?: Array<{ ok: boolean; at: number; [key: string]: unknown }>,
) {
  const checkMail = useAction(api.mailSettings.check);
  const [checking, setChecking] = useState(false);
  const [checkState, setCheckState] = useState<MailCheckState | null>(null);

  /**
   * Pide al relevo que se conecte y se autentique contra el servidor de correo,
   * con lo que hay guardado y sin mandar nada.
   */
  const runCheck = useCallback(
    async (automatic: boolean) => {
      setChecking(true);
      try {
        const result = await checkMail({});
        setCheckState({
          ok: result.ok,
          ...(result.detail === undefined ? {} : { detail: result.detail }),
          ...(result.error === undefined ? {} : { error: result.error }),
          at: Date.now(),
          automatic,
        });
      } catch (error) {
        setCheckState({
          ok: false,
          error: getErrorMessage(error),
          at: Date.now(),
          automatic,
        });
      } finally {
        setChecking(false);
      }
    },
    [checkMail],
  );

  /**
   * El camino de envío se comprueba solo al abrir el panel y al cambiar lo guardado.
   */
  const checkedPath = useRef<string | null>(null);
  useEffect(() => {
    if (settings === undefined) return;
    if (!settings.enabled || !usesMailRelay(settings.provider)) return;
    const key = [
      settings.provider,
      settings.relayUrl,
      settings.smtpUser,
      settings.hasKey,
      settings.hasRelayToken,
      settings.updatedAt ?? 0,
    ].join("|");
    if (checkedPath.current === key) return;
    checkedPath.current = key;
    void runCheck(true);
  }, [settings, runCheck]);

  const handleCheck = useCallback(() => void runCheck(false), [runCheck]);

  const lastSend = useMemo(() => {
    if (history === undefined) return null;
    return history[0] ?? null;
  }, [history]);

  const lastSendFailed = lastSend !== null && !lastSend.ok;
  const savedPath = settings ?? null;
  const pathCheckable = savedPath !== null && usesMailRelay(savedPath.provider);
  const pathFailed =
    savedPath !== null &&
    savedPath.enabled &&
    pathCheckable &&
    checkState !== null &&
    !checkState.ok;

  const pathLine = useMemo(() => {
    if (savedPath === null) return "";
    if (!savedPath.enabled) {
      return "Camino de envío: el correo está apagado, así que no hay nada que entregar.";
    }
    if (!pathCheckable) {
      return `Camino de envío: ${MAIL_PROVIDER_META[savedPath.provider].label} se comprueba mandando un correo; su API no dice nada sin enviar.`;
    }
    if (checking) {
      return "Camino de envío: comprobando el relevo…";
    }
    if (checkState === null) {
      return "Camino de envío: sin comprobar todavía.";
    }
    if (checkState.ok) {
      return `Camino de envío: el relevo responde y acepta las credenciales — ${checkState.detail ?? "conexión y autenticación correctas"} (${formatDateTime(checkState.at)}).`;
    }
    return `Camino de envío: el relevo no supera la comprobación — ${checkState.error ?? "sin motivo apuntado"} (${formatDateTime(checkState.at)}).`;
  }, [savedPath, pathCheckable, checking, checkState]);

  return {
    checking,
    checkState,
    runCheck,
    handleCheck,
    lastSend,
    lastSendFailed,
    savedPath,
    pathCheckable,
    pathFailed,
    pathLine,
  };
}
