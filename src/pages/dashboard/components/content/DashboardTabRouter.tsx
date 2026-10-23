import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";
import { Suspense } from "react";
import { DashboardViewSkeleton } from "./DashboardViewSkeleton";
import { DashboardTabRenderer, DashboardTabSkeleton } from "./router";
import type { DashboardTabRouterProps } from "./types";

/**
 * Enrutador modular del panel: gestiona el ciclo de vida de los módulos,
 * control de errores con ModuleErrorBoundary y carga diferida con Suspense.
 */
export function DashboardTabRouter({
  navigation,
  loading,
  user,
  displayName,
  adminOk,
  can,
  canSeePurchasing,
  isGuest,
}: DashboardTabRouterProps) {
  const { activeTab } = navigation;

  return (
    <ModuleErrorBoundary key={activeTab} moduleName={activeTab}>
      <Suspense fallback={<DashboardViewSkeleton />}>
        {loading && activeTab !== "profile" && activeTab !== "permissions" ? (
          <DashboardTabSkeleton />
        ) : (
          <DashboardTabRenderer
            navigation={navigation}
            user={user}
            displayName={displayName}
            adminOk={adminOk}
            can={can}
            canSeePurchasing={canSeePurchasing}
            isGuest={isGuest}
          />
        )}
      </Suspense>
    </ModuleErrorBoundary>
  );
}
