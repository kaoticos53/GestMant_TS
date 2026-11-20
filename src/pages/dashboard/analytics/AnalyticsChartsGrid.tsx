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

interface AnalyticsChartsGridProps {
  analytics: WorkshopAnalyticsResult;
}

const INCIDENTS_STATUS_CONFIG = {
  count: {
    label: "Incidencias",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const WEEKLY_TREND_CONFIG = {
  reported: {
    label: "Reportadas",
    color: "hsl(var(--chart-1))",
  },
  resolved: {
    label: "Resueltas",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const PARTS_CATEGORY_CONFIG = {
  normal: {
    label: "Stock normal",
    color: "hsl(var(--chart-2))",
  },
  lowStock: {
    label: "Stock bajo",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const MOVEMENTS_CONFIG = {
  entries: {
    label: "Movimientos (30d)",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function AnalyticsChartsGrid({ analytics }: AnalyticsChartsGridProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Incidencias por estado</CardTitle>
          <CardDescription>
            Distribución actual de las incidencias registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.incidentsByStatus.length === 0 ? (
            <EmptyChartMessage message="Sin datos de incidencias disponibles." />
          ) : (
            <ChartContainer
              config={INCIDENTS_STATUS_CONFIG}
              className="h-[240px] w-full"
            >
              <BarChart
                data={analytics.incidentsByStatus}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendencia semanal</CardTitle>
          <CardDescription>
            Incidencias reportadas frente a resueltas (últimas 8 semanas)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.weeklyTrend.length === 0 ? (
            <EmptyChartMessage message="Sin histórico semanal disponible." />
          ) : (
            <ChartContainer
              config={WEEKLY_TREND_CONFIG}
              className="h-[240px] w-full"
            >
              <AreaChart
                data={analytics.weeklyTrend}
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Repuestos por categoría</CardTitle>
          <CardDescription>
            Comparativa de stock normal vs. stock bajo por familia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.partsByCategory.length === 0 ? (
            <EmptyChartMessage message="Sin inventario visible o sin repuestos." />
          ) : (
            <ChartContainer
              config={PARTS_CATEGORY_CONFIG}
              className="h-[240px] w-full"
            >
              <BarChart
                data={analytics.partsByCategory}
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
                />
                <Bar
                  dataKey="lowStock"
                  stackId="stock"
                  fill="var(--color-lowStock)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimientos de stock (30d)</CardTitle>
          <CardDescription>
            Operaciones registradas en inventario durante el último mes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.stockMovementsSummary.length === 0 ? (
            <EmptyChartMessage message="Sin movimientos de stock en los últimos 30 días." />
          ) : (
            <ChartContainer config={MOVEMENTS_CONFIG} className="h-[240px] w-full">
              <BarChart
                data={analytics.stockMovementsSummary}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="entries"
                  fill="var(--color-entries)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}
