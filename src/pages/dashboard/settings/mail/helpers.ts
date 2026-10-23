/**
 * Devuelve la descripción del estado del interruptor de correo saliente.
 */
export function formatOutgoingMailDescription(enabled: boolean): string {
  return enabled
    ? "Encendido: los avisos y el resumen salen por el servicio configurado."
    : "Apagado: no se manda ningún correo del taller. Cada intento deja escrito el motivo en su ficha o en su histórico.";
}
