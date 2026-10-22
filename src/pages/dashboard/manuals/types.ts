import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Un movimiento del historial con la dirección de su versión, si la guarda: es
 * con lo que se sigue descargando el PDF que se sustituyó.
 */
export type ManualChangeDoc = NonNullable<Doc<"manuals">["history"]>[number] & {
  url: string | null;
};

/** Una fila de la lista: el manual guardado, su archivo y su historial. */
export type ManualDoc = Omit<Doc<"manuals">, "history"> & {
  url: string | null;
  history: ManualChangeDoc[];
};

export type EquipmentDoc = Doc<"equipment">;
