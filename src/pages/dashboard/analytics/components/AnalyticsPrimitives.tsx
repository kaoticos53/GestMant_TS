import type { ReactNode } from "react";
import { ArrowRight, Clock3, Plane, Wrench } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { DetailTitleButton } from "@/components/DetailTitleButton";
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
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/workshop";

interface KpiCardProps {
  testId: string;
  label: string;
  icon: ReactNode;
  value: string | number;
  highlight?: string;
  highlightClassName?: string;
  footerIcon?: ReactNode;
  footerText: string;
  onClick?: () => void;
}

export function KpiCard({
  testId,
  label,
  icon,
  value,
  highlight,
  highlightClassName,
  footerIcon,
  footerText,
  onClick,
}: KpiCardProps) {
  const baseClass =
    "group min-w-0 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors";
  const interactiveClass = onClick
    ? "hover:border-primary/40 hover:bg-accent/30 cursor-pointer"
    : "";

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="shrink-0">{icon}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </span>
        {highlight && (
          <span className={cn("text-xs font-medium", highlightClassName)}>
            {highlight}
          </span>
        )}
      </div>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        {footerIcon && <span className="shrink-0">{footerIcon}</span>}
        <span className="truncate">{footerText}</span>
      </p>
    </>
  );

  if (!onClick) {
    return (
      <div data-testid={testId} className={baseClass}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(baseClass, interactiveClass)}
    >
      {content}
    </button>
  );
}

interface ProblematicEquipmentCardProps {
  items: WorkshopAnalyticsResult["topProblematicEquipment"];
  canViewEquipment: boolean;
  onOpenEquipment?: () => void;
  onSelectEquipment?: (label: string) => void;
}

export function ProblematicEquipmentCard({
  items,
  canViewEquipment,
  onOpenEquipment,
  onSelectEquipment,
}: ProblematicEquipmentCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">Equipos con más incidencias</span>
          </CardTitle>
          <CardDescription>
            Modelos o equipos que acumulan mayor número de incidencias
            {onSelectEquipment ? " · haz clic para ver sus incidencias" : ""}
          </CardDescription>
        </div>
        {canViewEquipment && onOpenEquipment && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onOpenEquipment}
          >
            Ver equipos
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin incidencias agrupadas por equipo todavía.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <DetailTitleButton
                  onClick={() =>
                    onSelectEquipment
                      ? onSelectEquipment(item.label)
                      : onOpenEquipment?.()
                  }
                  className="min-w-0 flex-1"
                >
                  {item.label}
                </DetailTitleButton>
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
  );
}

interface StaleWorkCardProps {
  items: WorkshopAnalyticsResult["staleWork"];
  onOpenIncident?: (id: Id<"incidents">) => void;
  onOpenIncidents: () => void;
}

export function StaleWorkCard({
  items,
  onOpenIncident,
  onOpenIncidents,
}: StaleWorkCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">Trabajo en curso sin constancia</span>
          </CardTitle>
          <CardDescription>
            Incidencias activas que superan el margen de días sin nota del técnico
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onOpenIncidents}
        >
          Ver incidencias
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ninguna incidencia supera el margen sin seguimiento.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <DetailTitleButton
                    onClick={() =>
                      onOpenIncident
                        ? onOpenIncident(item.id as Id<"incidents">)
                        : onOpenIncidents()
                    }
                  >
                    {item.reference}
                  </DetailTitleButton>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.statusLabel}
                    {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0 tabular-nums">
                  {item.days} d sin nota
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface ExternalRepairsCardProps {
  items: WorkshopAnalyticsResult["externalRepairs"];
  onOpenIncident?: (id: Id<"incidents">) => void;
  onOpenIncidents: () => void;
}

export function ExternalRepairsCard({
  items,
  onOpenIncident,
  onOpenIncidents,
}: ExternalRepairsCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plane className="size-4 shrink-0 text-signal" />
            <span className="truncate">Equipos en SAT externo</span>
          </CardTitle>
          <CardDescription>
            Reparaciones fuera del taller pendientes de retorno
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onOpenIncidents}
        >
          Ver incidencias
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay equipos en reparación externa en este momento.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <DetailTitleButton
                    onClick={() =>
                      onOpenIncident
                        ? onOpenIncident(item.id as Id<"incidents">)
                        : onOpenIncidents()
                    }
                  >
                    {item.reference} · {item.equipmentLabel}
                  </DetailTitleButton>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.companyName}
                    {item.expectedReturnAt
                      ? ` · Previsto ${formatDate(item.expectedReturnAt)}`
                      : ""}
                  </p>
                </div>
                <Badge
                  variant={item.overdue ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {item.overdue ? "Retorno vencido" : "En SAT"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
