import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { CatalogKind } from "@/lib/catalogs";

export type { CatalogKind };

export type CatalogItemDoc = Doc<"catalogs">;

export interface EditingCatalogItem {
  id: Id<"catalogs">;
  name: string;
}

export interface MergingCatalogItem {
  id: Id<"catalogs">;
  name: string;
}
