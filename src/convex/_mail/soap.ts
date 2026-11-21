import { MAIL_SERVER_URL } from "../../lib/mailClient/account";
import { parseSoapFault, type MailFault } from "../../lib/mailClient/errors";

/** El único destino SOAP del taller: nunca se acepta un host del cliente. */
export const SOAP_ENDPOINT = `${MAIL_SERVER_URL}/service/soap`;

/** Fallo de transporte o fault de negocio, con el código ya separado. */
export class MailSoapError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fault: MailFault | null,
  ) {
    super(message);
    this.name = "MailSoapError";
  }
}

/** Texto saneado y corto: código y Trace, nunca el mensaje completo del servidor. */
export function failureLabel(status: number, fault: MailFault | null): string {
  if (fault) {
    return fault.trace ? `${fault.code} (Trace ${fault.trace})` : fault.code;
  }
  return `Error HTTP ${status}`;
}

/** Envía un sobre SOAP y convierte faults y respuestas no exitosas en error. */
export async function postSoap(body: string): Promise<string> {
  const response = await fetch(SOAP_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body,
  });
  const text = await response.text();
  let fault: MailFault | null = null;
  try {
    fault = parseSoapFault(text);
  } catch {
    fault = null;
  }
  if (fault !== null || !response.ok) {
    throw new MailSoapError(
      failureLabel(response.status, fault),
      response.status,
      fault,
    );
  }
  return text;
}
