import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAllReleases } from "@/lib/changelog";
import { APP_VERSION, FULL_VERSION } from "@/version";
import {
  ChangelogEmptyState,
  ChangelogFooter,
  ChangelogHeader,
  ChangelogReleaseItem,
} from "./components";
import { filterReleases } from "./helpers";
import type { ChangelogDialogProps, ChangelogFilterCategory } from "./types";

export function ChangelogDialog({
  open,
  onOpenChange,
  defaultVersion,
}: ChangelogDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ChangelogFilterCategory>("todas");

  const releases = useMemo(() => getAllReleases(), []);

  const filteredReleases = useMemo(
    () =>
      filterReleases(
        releases,
        searchQuery,
        selectedCategory,
        defaultVersion,
      ),
    [releases, searchQuery, selectedCategory, defaultVersion],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[88vw] lg:w-[60vw] sm:max-w-[60vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-xl">
        <ChangelogHeader
          fullVersion={FULL_VERSION}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <ScrollArea className="flex-1 p-6 overflow-y-auto">
          {filteredReleases.length === 0 ? (
            <ChangelogEmptyState />
          ) : (
            <div className="relative border-l border-border/70 ml-3.5 space-y-8 pl-6 pb-2">
              {filteredReleases.map((release) => (
                <ChangelogReleaseItem
                  key={release.version}
                  release={release}
                  isCurrent={release.version === APP_VERSION}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <ChangelogFooter onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
