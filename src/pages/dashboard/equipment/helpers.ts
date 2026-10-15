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
