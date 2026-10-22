import { Skeleton } from "@/components/ui/skeleton";

export function DashboardViewSkeleton() {
  return (
    <div className="grid gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-xl border border-border/70 bg-card/50" />
      <Skeleton className="h-36 rounded-xl border border-border/70 bg-card/50" />
    </div>
  );
}
