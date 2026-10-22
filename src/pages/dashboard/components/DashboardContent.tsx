import type { Doc } from "@/convex/_generated/dataModel";
import type { Capability } from "@/lib/permissions";
import type { DashboardNavigation } from "../hooks/useDashboardNavigation";
import {
  DashboardEmptyNotice,
  DashboardGuestNotice,
  DashboardTabRouter,
  isTabExemptFromEmptyNotice,
} from "./content";

export interface DashboardContentProps {
  navigation: DashboardNavigation;
  isGuest: boolean;
  showEmptyNotice: boolean;
  loading: boolean;
  user: Doc<"users"> | null | undefined;
  displayName: string;
  adminOk: boolean;
  can: (capability: Capability) => boolean;
  canSeePurchasing: boolean;
  searchParamsCode: string | null;
  isSeeding: boolean;
  onSeed: () => void;
  onStartEmpty: () => void;
  onSwitchAccount: () => void;
}

export function DashboardContent({
  navigation,
  isGuest,
  showEmptyNotice,
  loading,
  user,
  displayName,
  adminOk,
  can,
  canSeePurchasing,
  searchParamsCode,
  isSeeding,
  onSeed,
  onStartEmpty,
  onSwitchAccount,
}: DashboardContentProps) {
  if (isGuest) {
    return (
      <DashboardGuestNotice
        searchParamsCode={searchParamsCode}
        onSwitchAccount={onSwitchAccount}
      />
    );
  }

  if (showEmptyNotice && !isTabExemptFromEmptyNotice(navigation.activeTab)) {
    return (
      <DashboardEmptyNotice
        canManageInventory={can("manageInventory")}
        isSeeding={isSeeding}
        onSeed={onSeed}
        onStartEmpty={onStartEmpty}
      />
    );
  }

  return (
    <DashboardTabRouter
      navigation={navigation}
      loading={loading}
      user={user}
      displayName={displayName}
      adminOk={adminOk}
      can={can}
      canSeePurchasing={canSeePurchasing}
      isGuest={isGuest}
    />
  );
}
