/** Timestamp → valor de <input type="date"> (AAAA-MM-DD en hora local). */
export function dateToInput(timestamp?: number): string {
  if (timestamp === undefined) return "";
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor de <input type="date"> → timestamp (medianoche local). */
export function inputToDate(value: string): number | undefined {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

/** Calcula los derechos sobre manuales según privilegios y usuario activo. */
export function getManualRights(
  canManageManuals: boolean,
  currentUserId?: string | null,
): { manage: boolean; userId: string | null } {
  return {
    manage: canManageManuals,
    userId: currentUserId ?? null,
  };
}

/** Determina si el usuario tiene permiso para añadir manuales o notas de taller. */
export function canAddManualNotes(
  canWriteManuals: boolean,
  canManageManuals: boolean,
): boolean {
  return canWriteManuals || canManageManuals;
}

