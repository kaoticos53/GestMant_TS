import type { ChangeCategory, ChangeItem, Release } from "@/lib/changelog";

export type ChangelogFilterCategory = ChangeCategory | "todas";

export interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVersion?: string;
}

export interface ChangelogHeaderProps {
  fullVersion: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ChangelogFilterCategory;
  onSelectCategory: (category: ChangelogFilterCategory) => void;
}

export interface ChangelogReleaseItemProps {
  release: Release;
  isCurrent: boolean;
}

export interface ChangelogChangeRowProps {
  change: ChangeItem;
}

export interface ChangelogFooterProps {
  onClose: () => void;
}
