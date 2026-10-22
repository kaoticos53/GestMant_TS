import type { MailProvider } from "@/lib/mail";

/**
 * Devuelve el texto explicativo de las restricciones del remitente según el proveedor.
 */
export function getSenderHelpText(provider: MailProvider): string {
  return provider === "vly"
    ? "La pasarela firma con su propio remitente; este correo solo se usa si algún día eliges un servicio propio."
    : "Los servicios propios exigen que el remitente sea una dirección verificada en la cuenta.";
}

/**
 * Devuelve la nota contextual sobre la copia oculta (BCC).
 */
export function getBccHelpText(bcc: string): string {
  const trimmed = bcc.trim();
  return trimmed === ""
    ? "Sin copia oculta: cada correo va solo a sus destinatarios."
    : `Todos los correos del taller se copian también a ${trimmed.toLowerCase()}, sin que los destinatarios lo vean. Es una sola dirección.`;
}

/**
 * Devuelve el texto descriptivo de la conexión SMTP y cifrado TLS, si aplica.
 */
export function getSmtpConnectionHelpText(
  smtp: { host: string; port: number; tls: string } | null,
): string | null {
  if (smtp === null) return null;
  const tlsDesc =
    smtp.tls === "ssl"
      ? "con TLS directo"
      : smtp.tls === "starttls"
        ? "cifrado con STARTTLS"
        : "sin cifrar";

  return `Sale por ${smtp.host}:${smtp.port} ${tlsDesc}, a través del relevo.`;
}
