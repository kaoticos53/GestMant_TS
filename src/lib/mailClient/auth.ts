import { asNode, parseSoapBody, readText } from "./xml";
import type { MailAuthSession } from "./types";

/**
 * Parsea la respuesta de `AuthRequest`. La vida útil viene en milisegundos,
 * como el resto de tiempos de Zimbra; el token solo lo ve el backend.
 */
export function parseAuthResponse(xml: string): MailAuthSession {
  const body = parseSoapBody(xml);
  const response = asNode(body["AuthResponse"]);
  if (!response) throw new Error("La respuesta no es un AuthResponse.");

  const authToken = readText(response["authToken"]).trim();
  const lifetimeMs = Number(readText(response["lifetime"]));
  if (authToken.length === 0) {
    throw new Error("La respuesta de autenticación no trae token.");
  }
  if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0) {
    throw new Error("La respuesta de autenticación no trae una vida válida.");
  }

  return { authToken, lifetimeMs };
}
