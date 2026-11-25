import logo from "@/assets/logo.svg";
import { WorkshopAiChatButton } from "@/components/ai/WorkshopAiChatButton";
import { BackgroundJobsIndicator } from "@/components/jobs/BackgroundJobsIndicator";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { LogOut, Menu, PanelLeftOpen, Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Link } from "react-router";
import { MODULE_META } from "../constants/navConfig";
import { GlobalSearch, type QuickAction, type SearchHit } from "../GlobalSearch";
import type { NavId, NavItem } from "../types";
import { SidebarNavList } from "./sidebar/SidebarNavList";

export interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  roleBadge: React.ReactNode;
  onOpenNotification: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  canSendMessages: boolean;
  isGuest: boolean;
  canSearchCatalog: boolean;
  onSearchSelect: (hit: SearchHit) => void;
  quickActions?: QuickAction[];
  activeTab: NavId;
  goToTab: (id: NavId) => void;
  initial: string;
  onSignOut: () => void;
  navItems: NavItem[];
  navBadges: Record<NavId, number>;
}

export function DashboardHeader({
  sidebarCollapsed,
  toggleSidebar,
  roleBadge,
  onOpenNotification,
  canSendMessages,
  isGuest,
  canSearchCatalog,
  onSearchSelect,
  quickActions,
  activeTab,
  goToTab,
  initial,
  onSignOut,
  navItems,
  navBadges,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
      {/* Menú plegado (escritorio): desde aquí se vuelve a desplegar. */}
      {sidebarCollapsed && (
        <div className="sticky top-0 z-30 hidden items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur-md sm:px-6 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-expanded={!sidebarCollapsed}
            aria-controls="menu-lateral"
            aria-label="Mostrar el menú lateral"
            title="Mostrar el menú"
            className="gap-2 text-muted-foreground"
          >
            <PanelLeftOpen className="size-4" />
            Mostrar menú
          </Button>
          {!isGuest && (
            <div className="max-w-md flex-1">
              <GlobalSearch
                canSearchCatalog={canSearchCatalog}
                onSelect={onSearchSelect}
                quickActions={quickActions}
                shortcutEnabled={sidebarCollapsed}
              />
            </div>
          )}
          {/* Lo que vivía en el menú: tema, avisos, mensajes y el rol en uso. */}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            {roleBadge}
            <NotificationBell onOpen={onOpenNotification} />
            <MessagesCenter canSend={canSendMessages} />
            <BackgroundJobsIndicator />
            <WorkshopAiChatButton />
          </div>
        </div>
      )}

      {/* Cabecera móvil compacta + Drawer lateral de módulos */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-9 shrink-0"
              aria-label="Abrir menú de módulos"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <img
                src={logo}
                alt="Pulso Taller"
                className="size-7 shrink-0 rounded-lg ring-1 ring-border"
              />
              <span className="truncate text-sm font-semibold tracking-tight">
                {MODULE_META[activeTab].title}
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!isGuest && (
              <Button
                type="button"
                variant={mobileSearchOpen ? "secondary" : "ghost"}
                size="icon-sm"
                className="size-9"
                aria-label="Buscar en el taller"
                aria-expanded={mobileSearchOpen}
                onClick={() => setMobileSearchOpen((prev) => !prev)}
              >
                <Search className="size-4" />
              </Button>
            )}
            <NotificationBell onOpen={onOpenNotification} />
            <MessagesCenter canSend={canSendMessages} />
            <BackgroundJobsIndicator />
            <WorkshopAiChatButton />
            <button
              type="button"
              onClick={() => goToTab("profile")}
              aria-label="Ver mi perfil"
              aria-current={activeTab === "profile" ? "page" : undefined}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-semibold text-signal transition-shadow",
                activeTab === "profile" && "ring-2 ring-signal/50",
              )}
            >
              {initial}
            </button>
          </div>
        </div>

        {/* Búsqueda global desplegable en móvil */}
        {mobileSearchOpen && !isGuest && (
          <div className="border-t border-border/70 px-3 py-2">
            <GlobalSearch
              canSearchCatalog={canSearchCatalog}
              onSelect={(hit) => {
                setMobileSearchOpen(false);
                onSearchSelect(hit);
              }}
              quickActions={quickActions}
              shortcutEnabled={false}
            />
          </div>
        )}
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(85vw,20rem)] flex-col gap-0 p-0 lg:hidden"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <img
                src={logo}
                alt=""
                className="size-6 rounded-md ring-1 ring-border"
              />
              Pulso Taller
            </SheetTitle>
          </SheetHeader>

          <SidebarNavList
            isGuest={isGuest}
            navItems={navItems}
            navBadges={navBadges}
            activeTab={activeTab}
            itemClassName="py-2.5"
            onSelectTab={(id) => {
              setMobileMenuOpen(false);
              goToTab(id);
            }}
          />

          <div className="flex flex-col gap-2.5 border-t border-border/70 p-3">
            <ThemeToggle />
            <div className="flex items-center justify-between gap-2">
              {roleBadge}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignOut();
                }}
              >
                <LogOut className="size-4" />
                Salir
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
