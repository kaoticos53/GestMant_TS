import { Badge } from "@/components/ui/badge";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatOrderHeaderDescription } from "../helpers";
import type { OrderSheetHeaderProps } from "../types";

export function OrderSheetHeader({
  order,
  meta,
  total,
}: OrderSheetHeaderProps) {
  return (
    <SheetHeader>
      <SheetTitle className="flex flex-wrap items-center gap-2">
        {order.reference}
        {order.solicitudeCode && (
          <Badge variant="secondary" className="font-mono text-xs">
            Solicitud: {order.solicitudeCode}
          </Badge>
        )}
        <Badge variant="outline" className={meta.badgeClassName}>
          {meta.label}
        </Badge>
      </SheetTitle>
      <SheetDescription>
        {formatOrderHeaderDescription(order, total)}
      </SheetDescription>
    </SheetHeader>
  );
}
