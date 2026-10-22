import type { Doc } from "@/convex/_generated/dataModel";
import type { Capability } from "@/lib/permissions";
import type { DashboardNavigation } from "../../hooks/useDashboardNavigation";

export interface DashboardGuestNoticeProps {
  searchParamsCode: string | null;
  onSwitchAccount: () => void;
}

export interface DashboardEmptyNoticeProps {
  canManageInventory: boolean;
  isSeeding: boolean;
  onSeed: () => void;
  onStartEmpty: () => void;
}

export interface DashboardTabRouterProps {
  navigation: DashboardNavigation;
  loading: boolean;
  user: Doc<"users"> | null | undefined;
  displayName: string;
  adminOk: boolean;
  can: (capability: Capability) => boolean;
  canSeePurchasing: boolean;
  isGuest: boolean;
}
