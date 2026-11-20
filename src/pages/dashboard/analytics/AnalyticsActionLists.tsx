import { ArrowRight, PackageX, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";

interface AnalyticsActionListsProps {
  topProblematicEquipment: WorkshopAnalyticsResult["topProblematicEquipment"];
  criticalParts: WorkshopAnalyticsResult["criticalParts"];
  onOpenEquipment: () => void;
  onOpenInventoryLowStock: () => void;
}

export function AnalyticsActionLists({
  topProblematicEquipment,
  criticalParts,
  onOpenEquipment,
  onOpenInventoryLowStock,
}: AnalyticsActionListsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-muted-foreground" />
              Equipos con más incidencias
            </CardTitle>
            <CardDescription>
              Modelos o equipos que acumulan mayor número de avisos
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenEquipment}>
            Ver equipos
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {topProblematicEquipment.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin incidencias agrupadas por equipo todavía.
            </p>
          ) : (
            <ul className="divide-y">
              {topProblematicEquipment.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="truncate font-medium">{item.label}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.openCount > 0 && (
                      <Badge variant="destructive">
                        {item.openCount} abiertas
                      </Badge>
                    )}
                    <Badge variant="secondary">{item.count} total</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageX className="size-4 text-rose-600 dark:text-rose-400" />
              Repuestos en nivel crítico
            </CardTitle>
            <CardDescription>
              Referencias agotadas o por debajo del stock mínimo
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenInventoryLowStock}>
            Ir a inventario
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {criticalParts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay repuestos en nivel crítico.
            </p>
          ) : (
            <ul className="divide-y">
              {criticalParts.map((part) => (
                <li
                  key={part.code}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{part.name}</p>
                    <p className="text-xs text-muted-foreground">{part.code}</p>
                  </div>
                  <Badge
                    variant={part.stock <= 0 ? "destructive" : "secondary"}
                    className="shrink-0 tabular-nums"
                  >
                    {part.stock} / {part.minStock} {part.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
