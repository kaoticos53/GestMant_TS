import { Button } from "@/components/ui/button";
import { ClipboardList, ShoppingCart, Table2, Truck } from "lucide-react";
import type { PurchasingSection, PurchasingSectionItem } from "../types";

export const SECTIONS: PurchasingSectionItem[] = [
  { id: "pending", label: "Sin tratar", icon: ShoppingCart },
  { id: "orders", label: "Órdenes de compra", icon: ClipboardList },
  { id: "movements", label: "Recepciones", icon: Truck },
  { id: "history", label: "Histórico (Excel)", icon: Table2 },
];

export interface PurchasingSectionTabsProps {
  activeSection: PurchasingSection;
  onSectionChange: (section: PurchasingSection) => void;
  pendingCount: number;
  ordersCount: number;
  movementsCount: number;
  historyCount: number;
}

export function PurchasingSectionTabs({
  activeSection,
  onSectionChange,
  pendingCount,
  ordersCount,
  movementsCount,
  historyCount,
}: PurchasingSectionTabsProps) {
  return (
    <div
      role="group"
      aria-label="Secciones de compras"
      className="flex flex-wrap items-center gap-2"
    >
      {SECTIONS.map((item) => {
        const Icon = item.icon;
        const activo = activeSection === item.id;
        const cuenta =
          item.id === "pending"
            ? pendingCount
            : item.id === "orders"
              ? ordersCount
              : item.id === "movements"
                ? movementsCount
                : historyCount;

        return (
          <Button
            key={item.id}
            type="button"
            variant={activo ? "default" : "outline"}
            aria-pressed={activo}
            className="gap-2"
            onClick={() => onSectionChange(item.id)}
          >
            <Icon className="size-4" />
            {item.label}
            {cuenta > 0 && (
              <span
                className={
                  activo
                    ? "rounded-full bg-background/20 px-1.5 text-xs"
                    : "rounded-full bg-muted px-1.5 text-xs"
                }
              >
                {cuenta}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
