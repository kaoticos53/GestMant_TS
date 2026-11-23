import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  CATALOG_KIND_LABELS,
  type CatalogKind,
  type SupplierContact,
  type SupplierDetails,
} from "@/lib/catalogs";

export type { CatalogKind, SupplierContact, SupplierDetails };
export type CatalogKindMeta = (typeof CATALOG_KIND_LABELS)[CatalogKind];

export type CatalogItemDoc = Doc<"catalogs">;

export interface EditingCatalogItem extends SupplierDetails {
  id: Id<"catalogs">;
  name: string;
}

export interface MergingCatalogItem {
  id: Id<"catalogs">;
  name: string;
}

