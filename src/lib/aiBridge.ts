import type { AiResultKind, AiResultTable } from "./ai/types";

export interface AiOpenReferenceDetail {
  reference: string;
  kind?: AiResultKind;
  id?: string;
}

const OPEN_EVENT = "pulso:ai-open-reference";
const TABLES_EVENT = "pulso:ai-show-tables";

export function dispatchAiOpenReference(detail: AiOpenReferenceDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AiOpenReferenceDetail>(OPEN_EVENT, { detail }));
}

export function dispatchAiShowTables(tables: AiResultTable[]): void {
  if (typeof window === "undefined" || tables.length === 0) return;
  window.dispatchEvent(new CustomEvent<AiResultTable[]>(TABLES_EVENT, { detail: tables }));
}

export function subscribeAiOpenReference(
  handler: (detail: AiOpenReferenceDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<AiOpenReferenceDetail>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export function subscribeAiShowTables(
  handler: (tables: AiResultTable[]) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<AiResultTable[]>;
    if (Array.isArray(custom.detail)) handler(custom.detail);
  };
  window.addEventListener(TABLES_EVENT, listener);
  return () => window.removeEventListener(TABLES_EVENT, listener);
}
