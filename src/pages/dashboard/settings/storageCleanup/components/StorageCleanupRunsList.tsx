import { Skeleton } from "@/components/ui/skeleton";
import type { StorageCleanupRunsListProps } from "../types";
import { StorageCleanupRunItem } from "./StorageCleanupRunItem";

export function StorageCleanupRunsList({ runs }: StorageCleanupRunsListProps) {
  if (runs === undefined) {
    return (
      <div className="mt-4 grid gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
  }

  return (
    <ul className="mt-4 grid gap-2">
      {runs.map((run) => (
        <StorageCleanupRunItem key={run.pass} run={run} />
      ))}
    </ul>
  );
}
