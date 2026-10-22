import { useState } from "react";
import { ChevronRight, History, LogOut, PanelLeftClose } from "lucide-react";
import { ChangelogDialog } from "@/components/changelog/ChangelogDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DETAILED_VERSION, FULL_VERSION } from "@/version";
import type { SidebarFooterProps } from "./types";

export function SidebarFooter({
  activeTab,
  onSelectTab,
  displayName,
  initial,
  userEmail,
  isGuest,
  roleBadge,
  toggleSidebar,
  sidebarCollapsed,
  onSignOut,
}: SidebarFooterProps) {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <div className="border-t border-border/70 p-3">
        <button
          type="button"
          onClick={() => onSelectTab("profile")}
          aria-label="Ver mi perfil"
          aria-current={activeTab === "profile" ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
            activeTab === "profile"
              ? "bg-signal/10 ring-1 ring-signal/30"
              : "bg-muted/50 hover:bg-muted",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/10 text-sm font-semibold text-signal">
            {initial}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">
              {displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {userEmail ?? (isGuest ? "Sesión de invitado" : "Sin correo")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>

        {/* Plegar el menú del todo: queda la barra con «Mostrar menú». */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-controls="menu-lateral"
          title="Plegar el menú lateral"
          className="mt-2.5 w-full justify-start gap-2 border-border/70 text-muted-foreground hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
          Plegar menú
        </Button>

        <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
          {roleBadge}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={onSignOut}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setShowChangelog(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer select-none"
          title={`${DETAILED_VERSION} · Clic para ver la bitácora de cambios`}
        >
          <History className="size-3 shrink-0" />
          <span>{FULL_VERSION}</span>
        </button>
      </div>

      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
      />
    </>
  );
}
