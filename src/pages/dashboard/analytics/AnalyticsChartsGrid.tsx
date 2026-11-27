import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { WorkshopAnalyticsResult } from "@/lib/analytics";
import type { IncidentStatus } from "@/lib/workshop";

const INCIDENTS_STATUS_CONFIG = {
  count: {
    label: "Incidencias",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const INCIDENTS_PRIORITY_CONFIG = {
  count: {
    label: "Abiertas",
    color: "var(--status-warning)",
  },
} satisfies ChartConfig;

const WORKLOAD_TECH_CONFIG = {
  count: {
    label: "Incidencias abiertas",
    color: "var(--chart-1)",
  },
  urgentCount: {
    label: "Urgentes / Altas",
    color: "var(--status-warning)",
  },
} satisfies ChartConfig;

const WEEKLY_TREND_CONFIG = {
  reported: {
    label: "Notificadas",
    color: "var(--chart-1)",
  },
  resolved: {
    label: "Resueltas",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const PARTS_CATEGORY_CONFIG = {
  normal: {
    label: "Stock normal",
    color: "var(--chart-2)",
  },
  lowStock: {
    label: "Stock bajo",
    color: "var(--status-warning)",
  },
} satisfies ChartConfig;

const MOVEMENTS_CONFIG = {
  entries: {
    label: "Operaciones",
    color: "var(--chart-3)",
  },
  units: {
    label: "Unidades",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function IncidentsByStatusChart({
  data,
  onSelectIncidentStatus,
}: {
  data: WorkshopAnalyticsResult["incidentsByStatus"];
  onSelectIncidentStatus?: (status: IncidentStatus) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Incidencias por estado</CardTitle>
        <CardDescription>
          Distribución actual de las incidencias registradas
          {onSelectIncidentStatus ? " · haz clic en una barra para filtrar" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChartMessage message="Sin datos de incidencias disponibles." />
        ) : (
          <ChartContainer
            config={INCIDENTS_STATUS_CONFIG}
            className="h-[260px] w-full"
          >
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 6, 6, 0]}
                className={onSelectIncidentStatus ? "cursor-pointer" : undefined}
                onClick={(entry) => {
                  if (!onSelectIncidentStatus) return;
                  const row = (
                    entry && "payload" in entry && entry.payload
                      ? entry.payload
                      : entry
                  ) as WorkshopAnalyticsResult["incidentsByStatus"][number] | undefined;
                  if (row?.status) onSelectIncidentStatus(row.status);
                }}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function IncidentsByPriorityChart({
  data,
  onOpenIncidents,
}: {
  data: WorkshopAnalyticsResult["incidentsByPriority"];
  onOpenIncidents?: () => void;
}) {
  const hasAny = data.some((item) => item.count > 0);
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Incidencias abiertas por prioridad</CardTitle>
        <CardDescription>
          Urgencia del trabajo vivo pendiente de cerrar
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <EmptyChartMessage message="No hay incidencias abiertas ahora mismo." />
        ) : (
          <ChartContainer
            config={INCIDENTS_PRIORITY_CONFIG}
            className="h-[260px] w-full"
          >
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={96}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 6, 6, 0]}
                className={onOpenIncidents ? "cursor-pointer" : undefined}
                onClick={() => onOpenIncidents?.()}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function TrendChart({
  data,
  granularity,
}: {
  data: WorkshopAnalyticsResult["weeklyTrend"];
  granularity: WorkshopAnalyticsResult["trendGranularity"];
}) {
  const isDaily = granularity === "day";
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {isDaily ? "Evolución diaria" : "Tendencia semanal"}
        </CardTitle>
        <CardDescription>
          {isDaily
            ? "Incidencias notificadas frente a resueltas (últimos 7 días)"
            : `Incidencias notificadas frente a resueltas (últimas ${data.length} semanas)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChartMessage message="Sin histórico temporal disponible." />
        ) : (
          <ChartContainer config={WEEKLY_TREND_CONFIG} className="h-[240px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="weekLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="reported"
                stroke="var(--color-reported)"
                fill="var(--color-reported)"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                stroke="var(--color-resolved)"
                fill="var(--color-resolved)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function TechnicianWorkloadChart({
  data,
}: {
  data: WorkshopAnalyticsResult["workloadByTechnician"];
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Carga activa por técnico</CardTitle>
        <CardDescription>
          Incidencias abiertas repartidas por responsable y cola sin asignar
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChartMessage message="Sin carga activa asignada en este momento." />
        ) : (
          <ChartContainer config={WORKLOAD_TECH_CONFIG} className="h-[260px] w-full">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={132}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 6, 6, 0]}
              />
              <Bar
                dataKey="urgentCount"
                fill="var(--color-urgentCount)"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function PartsByCategoryChart({
  data,
  onSelectPartCategory,
}: {
  data: WorkshopAnalyticsResult["partsByCategory"];
  onSelectPartCategory?: (category: string) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Repuestos por categoría</CardTitle>
        <CardDescription>
          Comparativa de stock normal vs. stock bajo por familia
          {onSelectPartCategory ? " · haz clic para ver esa categoría" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChartMessage message="Sin inventario visible o sin repuestos." />
        ) : (
          <ChartContainer config={PARTS_CATEGORY_CONFIG} className="h-[240px] w-full">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="normal"
                stackId="stock"
                fill="var(--color-normal)"
                radius={[0, 0, 0, 0]}
                className={onSelectPartCategory ? "cursor-pointer" : undefined}
                onClick={(entry) => {
                  if (!onSelectPartCategory) return;
                  const row = (
                    entry && "payload" in entry && entry.payload
                      ? entry.payload
                      : entry
                  ) as WorkshopAnalyticsResult["partsByCategory"][number] | undefined;
                  if (row?.category) onSelectPartCategory(row.category);
                }}
              />
              <Bar
                dataKey="lowStock"
                stackId="stock"
                fill="var(--color-lowStock)"
                radius={[6, 6, 0, 0]}
                className={onSelectPartCategory ? "cursor-pointer" : undefined}
                onClick={(entry) => {
                  if (!onSelectPartCategory) return;
                  const row = (
                    entry && "payload" in entry && entry.payload
                      ? entry.payload
                      : entry
                  ) as WorkshopAnalyticsResult["partsByCategory"][number] | undefined;
                  if (row?.category) onSelectPartCategory(row.category);
                }}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function StockMovementsChart({
  data,
  periodLabel,
}: {
  data: WorkshopAnalyticsResult["stockMovementsSummary"];
  periodLabel: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Movimientos de stock ({periodLabel})
        </CardTitle>
        <CardDescription>
          Operaciones y unidades movidas en catálogo durante el periodo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChartMessage message="Sin movimientos de stock en el periodo." />
        ) : (
          <ChartContainer config={MOVEMENTS_CONFIG} className="h-[280px] w-full">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={136}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="entries"
                fill="var(--color-entries)"
                radius={[0, 6, 6, 0]}
              />
              <Bar
                dataKey="units"
                fill="var(--color-units)"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
