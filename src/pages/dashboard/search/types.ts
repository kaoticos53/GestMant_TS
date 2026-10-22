import type { ComponentType } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type IncidentDoc = Doc<"incidents">;
export type RequestDoc = Doc<"partRequests">;
export type PartDoc = Doc<"spareParts">;
export type EquipmentDoc = Doc<"equipment">;

/**
 * Resultado de la búsqueda global: el módulo al que navega y qué abrir.
 *
 * La incidencia y la petición llevan si están archivadas: se siguen
 * encontrando —lo que se busca cuando algo lleva tiempo cerrado— pero no se
 * abren en su cola, porque allí ya no están, sino en el archivo y en solo
 * lectura.
 */
export type SearchHit =
  | {
      kind: "incident";
      id: Id<"incidents">;
      title: string;
      subtitle: string;
      archived: boolean;
    }
  | {
      kind: "request";
      id: Id<"partRequests">;
      title: string;
      subtitle: string;
      archived: boolean;
    }
  | {
      kind: "part";
      id: Id<"spareParts">;
      term: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "equipment";
      id: Id<"equipment">;
      term: string;
      title: string;
      subtitle: string;
    };

export interface SearchGroup {
  /** «archive» no es un tipo de ficha: es el grupo de lo que ya no está en la cola. */
  kind: SearchHit["kind"] | "archive";
  label: string;
  icon: ComponentType<{ className?: string }>;
  hits: SearchHit[];
}

export interface GlobalSearchProps {
  /** Solo responsable/admin acceden al catálogo: no se busca lo que no ven. */
  canSearchCatalog?: boolean;
  onSelect: (hit: SearchHit) => void;
  className?: string;
}

export interface FilterSearchGroupsParams {
  query: string;
  incidents: IncidentDoc[];
  requests: RequestDoc[];
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  canSearchCatalog: boolean;
}
