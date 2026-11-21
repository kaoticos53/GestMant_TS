/** Fecha compacta de una cabecera: hora si es de hoy, día/mes si es del año. */
export function formatMailDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    date.getFullYear() === now.getFullYear()
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date);
}

/** Las cabeceras de Zimbra marcan «u» cuando el mensaje no se ha leído. */
export function isUnread(flags: string): boolean {
  return flags.split("").includes("u");
}

/** Remitente legible sin dejar la fila sin nombre si el servidor no lo trae. */
export function senderLabel(fromName: string, fromAddress: string): string {
  return fromName.trim() || fromAddress.trim() || "Remitente desconocido";
}

/** Texto del contador de una carpeta, con singular y plural. */
export function countLabel(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
