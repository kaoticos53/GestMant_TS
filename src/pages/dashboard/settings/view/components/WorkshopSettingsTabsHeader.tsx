import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkshopSettingsTabsHeaderProps } from "../types";

export function WorkshopSettingsTabsHeader({ tabs }: WorkshopSettingsTabsHeaderProps) {
  return (
    <div className="overflow-x-auto pb-1">
      <TabsList className="inline-flex h-auto w-auto flex-wrap items-center justify-start gap-1 p-1 bg-muted/60 border border-border/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all"
            >
              <Icon className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
