import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CATALOG_KIND_LABELS, type CatalogKind } from "@/lib/catalogs";

export type { CatalogKind };
export type CatalogKindMeta = (typeof CATALOG_KIND_LABELS)[CatalogKind];

export type CatalogItemDoc = Doc<"catalogs">;

export interface EditingCatalogItem {
  id: Id<"catalogs">;
  name: string;
}

export interface MergingCatalogItem {
  id: Id<"catalogs">;
  name: string;
}

