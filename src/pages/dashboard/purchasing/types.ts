import type { Doc } from "@/convex/_generated/dataModel";
import type { Truck } from "lucide-react";

export type PartRequestDoc = Doc<"partRequests">;
export type PartDoc = Doc<"spareParts">;
export type ReceptionDoc = Doc<"receptions"> & { deliveryNoteUrl: string | null };

/** Las secciones que se miran en el módulo de compras. */
export type PurchasingSection = "pending" | "orders" | "movements" | "history";

export interface PurchasingSectionItem {
  id: PurchasingSection;
  label: string;
  icon: typeof Truck;
}

export interface PurchasingViewProps {
  canManage: boolean;
}
