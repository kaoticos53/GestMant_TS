import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_GRANTS, type Capability } from "@/lib/permissions";
import {
  DEFAULT_ROLE,
  fallbackRoleMeta,
  isAdmin,
  isSystemRole,
  roleBadgeClassName,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Archive,
  BookOpen,
  Boxes,
  CircleAlert,
  ClipboardList,
  Cpu,
  Eye,
  FileClock,
  LogOut,
  Mail,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { SearchHit } from "./dashboard/GlobalSearch";
import type { OpenArchivedDoc } from "./dashboard/ArchiveView";
import type { RequestFilterId } from "./dashboard/requests/types";
import { WorkAlertNotice } from "./dashboard/WorkAlertNotice";
import { DashboardContent } from "./dashboard/components/DashboardContent";
import { DashboardHeader } from "./dashboard/components/DashboardHeader";
import { DashboardSidebar } from "./dashboard/components/DashboardSidebar";
import { DashboardStats } from "./dashboard/components/DashboardStats";
import { PageHeader, type PageHeaderAction } from "./dashboard/components/PageHeader";
import { useDashboardNavigation } from "./dashboard/hooks/useDashboardNavigation";
import { useDashboardSeed } from "./dashboard/hooks/useDashboardSeed";
import { useEnsureRole } from "./dashboard/hooks/useEnsureRole";
import { useSidebarPanel } from "./dashboard/hooks/useSidebarPanel";
import { useWorkAlertState } from "./dashboard/hooks/useWorkAlertState";
import type { NavId, NavItem } from "./dashboard/types";

const WeeklyReportDialog = lazy(() =>
  import("./dashboard/WeeklyReportDialog").then((m) => ({
    default: m.WeeklyReportDialog,
  })),
);

export default function Dashboard() {
  const { user, signOut } = useAuth();
  // Una sesión de invitado no es del taller: no tiene ningún permiso, el
  // backend tampoco le contesta (sus listas degradan a vacío) y no puede guardar
  // preferencias en el perfil. Se decide aquí arriba porque lo usan el menú
  // lateral y los permisos.
  const isGuest = user?.isAnonymous === true;
  const navigate = useNavigate();
  // El código que trae la dirección: es lo que pone el enlace del correo
  // (`?codigo=A7K2QX9M`) para que a quien notificó no le toque teclearlo.
  const [searchParams] = useSearchParams();
  const permissions = useQuery(api.permissions.myPermissions);
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false);

  // El menú lateral: un invitado no tiene perfil donde guardar la preferencia,
  // así que se le pasa `null` y se queda solo con la copia local, sin la
  // escritura que le fallaría en cada ajuste.
  const {
    width: sidebarWidth,
    resizing: sidebarResizing,
    collapsed: sidebarCollapsed,
    toggleCollapsed: toggleSidebar,
    asideRef: sidebarRef,
    resizeHandleProps,
  } = useSidebarPanel(isGuest ? null : user);

  // Permisos y asignación de rol garantizada
  const { role, roleLabel, adminOk, needsRole } = useEnsureRole(
    user,
    permissions?.label,
  );

  const grants = isGuest
    ? DEFAULT_GRANTS.guest
    : (permissions?.grants ??
      DEFAULT_GRANTS[isSystemRole(role) ? role : DEFAULT_ROLE]);
  const can = (capability: Capability) => grants[capability] === true;
  const canConfigureReport = can("manageIncidents") || can("decideRequests");
  const canSeePurchasing = can("viewPurchasing") || can("managePurchasing");

  // Módulos visibles según los permisos que el administrador dio al rol.
  const navItems: NavItem[] = [
    ...(can("viewIncidents")
      ? ([
          { id: "incidents", label: "Incidencias", icon: Siren, badge: 0 },
        ] as NavItem[])
      : []),
    ...(can("viewRequests")
      ? ([
          {
            id: "requests",
            label: "Peticiones",
            icon: ClipboardList,
            badge: 0,
          },
        ] as NavItem[])
      : []),
    ...(canSeePurchasing
      ? ([
          { id: "purchasing", label: "Compras", icon: ShoppingCart, badge: 0 },
        ] as NavItem[])
      : []),
    ...(can("viewInventory")
      ? ([
          { id: "inventory", label: "Repuestos", icon: Boxes, badge: 0 },
        ] as NavItem[])
      : []),
    ...(can("viewEquipment")
      ? ([
          { id: "equipment", label: "Equipos", icon: Cpu, badge: 0 },
        ] as NavItem[])
      : []),
    ...(can("viewManuals") && !isGuest
      ? ([
          { id: "manuals", label: "Manuales", icon: BookOpen, badge: 0 },
        ] as NavItem[])
      : []),
    ...(!isGuest
      ? ([
          {
            id: "machines",
            // El vocabulario del taller llama «equipo» a lo que se repara:
            // esta pantalla enseña los flujos de estados, no máquinas.
            label: "Flujos y estados",
            icon: Workflow,
            badge: 0,
          },
        ] as NavItem[])
      : []),
    ...(can("viewIncidents") || can("viewRequests")
      ? ([
          { id: "archive", label: "Archivo", icon: Archive, badge: 0 },
        ] as NavItem[])
      : []),
    ...(adminOk && can("viewAudit")
      ? ([
          {
            id: "audit",
            label: "Auditoría de documentos",
            icon: FileClock,
            badge: 0,
          },
        ] as NavItem[])
      : []),
    ...(adminOk && can("manageUsers")
      ? ([
          { id: "users", label: "Usuarios", icon: Users, badge: 0 },
        ] as NavItem[])
      : []),
    ...(adminOk && can("configurePermissions")
      ? ([
          {
            id: "permissions",
            label: "Roles y permisos",
            icon: ShieldCheck,
            badge: 0,
          },
        ] as NavItem[])
      : []),
    ...(can("manageIncidents") ||
    can("decideRequests") ||
    (adminOk && can("viewAudit"))
      ? ([
          {
            id: "settings",
            label: "Ajustes del taller",
            icon: SlidersHorizontal,
            badge: 0,
          },
        ] as NavItem[])
      : []),
  ];

  // Navegación unificada entre submódulos
  const {
    target,
    activeTab,
    viewKeys,
    goToTab,
    openRequests,
    openRequest,
    openIncident,
    openNotification,
    openInventory,
    setRequestsEquipmentFilter,
    openEquipmentViewRequests,
    handleSearchSelect,
  } = useDashboardNavigation(can, navItems);

  // Alertas de trabajo y estado de taller vacío
  const {
    summary,
    alertDays,
    alertRoleKeys,
    seesAlert,
    staleWork,
    alertDismissed,
    dismissAlert,
    restoreAlert,
    handleStartEmpty,
    markStartedEmpty,
    isEmpty,
    showEmptyNotice,
  } = useWorkAlertState(
    user,
    role,
    summary?.parts.total ?? 0,
    summary?.requests.active ?? 0,
    summary === undefined,
  );

  // Carga de datos de demostración
  const { isSeeding, isSeedingMore, handleSeed, handleSeedMore } = useDashboardSeed({
    onSeedSuccess: () => markStartedEmpty(false),
  });

  const loading = summary === undefined;
  const pendingRequests = summary?.requests.pending ?? 0;
  const urgentPending = summary?.requests.urgent ?? 0;
  const withoutReference = summary?.requests.withoutReference ?? 0;
  const issuedRequests = summary?.requests.issued ?? 0;
  const lowStockParts = summary?.parts.lowStock ?? 0;
  const totalParts = summary?.parts.total ?? 0;

  const navBadges: Record<NavId, number> = {
    incidents: summary?.incidents.reported ?? 0,
    requests: pendingRequests,
    purchasing: summary?.purchasing.pending ?? 0,
    inventory: 0,
    equipment: summary?.equipment ?? 0,
    manuals: summary?.manuals ?? 0,
    machines: 0,
    archive: 0,
    audit: 0,
    users: 0,
    permissions: 0,
    settings: 0,
    profile: 0,
  };

  const displayName =
    user?.name ||
    user?.email ||
    (user?.isAnonymous ? "Invitado" : "Responsable de repuestos");
  const initial = displayName.trim().charAt(0).toUpperCase() || "R";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSwitchAccount = async () => {
    await signOut();
    navigate("/auth");
  };



  const stats = [
    ...(can("viewRequests")
      ? [
          {
            label: "Peticiones pendientes",
            value: pendingRequests,
            hint:
              pendingRequests === 0
                ? "Cola revisada, nada que aprobar"
                : [
                    urgentPending > 0 ? `${urgentPending} urgentes` : null,
                    withoutReference > 0
                      ? `${withoutReference} sin repuesto`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Ninguna urgente",
            icon: ClipboardList,
            iconClassName: "bg-signal/10 text-signal",
            go: () => openRequests("pending"),
          },
        ]
      : []),
    ...(can("viewInventory")
      ? [
          {
            label: "Repuestos con stock bajo",
            value: lowStockParts,
            hint:
              lowStockParts === 0
                ? "Todo por encima del mínimo"
                : "Por debajo del mínimo",
            icon: CircleAlert,
            iconClassName: "bg-amber-500/10 text-amber-700",
            go: () => openInventory(true),
          },
          {
            label: "Repuestos en catálogo",
            value: totalParts,
            hint: "Repuestos gestionados",
            icon: Boxes,
            iconClassName: "bg-muted text-muted-foreground",
            go: () => openInventory(false),
          },
        ]
      : []),
    ...(can("viewRequests")
      ? [
          {
            label: "Peticiones entregadas",
            value: issuedRequests,
            hint: "Material ya en manos del técnico",
            icon: PackageCheck,
            iconClassName: "bg-emerald-600/10 text-emerald-700",
            go: () => openRequests("issued"),
          },
        ]
      : []),
  ];

  const summaryHidden =
    activeTab === "profile" ||
    activeTab === "permissions" ||
    activeTab === "settings" ||
    activeTab === "archive" ||
    activeTab === "machines" ||
    activeTab === "audit" ||
    stats.length === 0;



  // La cabecera de cada módulo: su nombre y una línea de contexto. Antes todas
  // las pestañas enseñaban el mismo titular genérico y había que mirar el menú
  // para saber dónde estabas.
  const moduleMeta: Record<NavId, { title: string; description: string }> = {
    incidents: {
      title: "Incidencias",
      description:
        "Lo que se ha notificado y en qué punto está: asígnalo, verifícalo y ciérralo con su parte.",
    },
    requests: {
      title: "Peticiones de repuesto",
      description:
        "El material que pide el taller: apruébalo, entrega lo que hay en el almacén y deja rastro de cada entrega.",
    },
    purchasing: {
      title: "Compras",
      description:
        "Lo que el almacén no cubre: órdenes por proveedor y recepciones con su albarán.",
    },
    inventory: {
      title: "Repuestos",
      description:
        "El catálogo del almacén: existencias, mínimos y ubicación de cada repuesto.",
    },
    equipment: {
      title: "Equipos",
      description:
        "El inventario del taller, con modelo, número de serie y su mantenimiento preventivo.",
    },
    manuals: {
      title: "Manuales",
      description:
        "La documentación de los equipos: PDFs y notas del taller, por tipo, marca y modelo.",
    },
    machines: {
      title: "Flujos y estados",
      description:
        "Cómo avanza cada caso —incidencia, petición y compra—: de qué estado a cuál se puede ir y por qué.",
    },
    archive: {
      title: "Archivo del taller",
      description:
        "Lo cerrado y lo decidido que ya no está en el día a día: búscalo aquí o recupéralo.",
    },
    audit: {
      title: "Auditoría de documentos",
      description:
        "La trazabilidad de los documentos: quién movió qué, cuándo y desde dónde.",
    },
    users: {
      title: "Usuarios",
      description:
        "Quién entra al taller, con qué rol y desde cuándo. Las bajas se reactivan desde aquí.",
    },
    permissions: {
      title: "Roles y permisos",
      description:
        "Qué ve y qué puede modificar cada rol. Solo el administrador entra en esta pantalla.",
    },
    settings: {
      title: "Ajustes del taller",
      description:
        "Correo, archivado automático, avisos y almacenamiento, en un solo sitio.",
    },
    profile: {
      title: "Mi perfil",
      description:
        "Tu ficha en el taller: datos de contacto, incidencias asignadas y avisos.",
    },
  };

  const heading = isGuest
    ? {
        title: "Sesión de invitado",
        description:
          "Sigue una incidencia con el código que te dieron al notificarla. El resto del taller es para quien entra con su cuenta.",
      }
    : moduleMeta[activeTab];

  // Cuánto hay en el módulo que se está mirando, junto al título: el mismo
  // número que lleva la píldora del menú, sin tener que buscarlo.
  const headingCount: number | null =
    activeTab === "incidents"
      ? (summary?.incidents.reported ?? null)
      : activeTab === "requests"
        ? pendingRequests
        : activeTab === "purchasing"
          ? (summary?.purchasing.pending ?? null)
          : activeTab === "inventory"
            ? totalParts
            : activeTab === "equipment"
              ? (summary?.equipment ?? null)
              : activeTab === "manuals"
                ? (summary?.manuals ?? null)
                : null;

  // Lo que no es del día a día, en el menú «⋯» de la cabecera: antes eran cuatro
  // botones fijos en todas las pantallas, encima de la lista.
  const headerActions: PageHeaderAction[] = [
    ...(canConfigureReport
      ? [
          {
            label: "Resumen semanal por correo",
            icon: Mail,
            onSelect: () => setWeeklyReportOpen(true),
          },
        ]
      : []),
    ...(seesAlert && staleWork.length > 0 && alertDismissed
      ? [
          {
            label: "Volver a mostrar el aviso",
            icon: Eye,
            onSelect: restoreAlert,
          },
        ]
      : []),
    ...(can("manageInventory") && !isEmpty
      ? [
          {
            label: isSeedingMore
              ? "Generando datos de ejemplo…"
              : "Más datos de ejemplo",
            icon: Sparkles,
            onSelect: () => void handleSeedMore(),
            disabled: isSeedingMore || loading,
            separatorBefore: true,
          },
        ]
      : []),
  ];

  // El título de la pestaña dice en qué módulo estás: con el genérico, dos
  // pestañas del navegador eran indistinguibles.
  const documentTitle = isGuest ? "Sesión de invitado" : heading.title;
  useEffect(() => {
    document.title = `${documentTitle} · Pulso Taller`;
  }, [documentTitle]);
  const roleBadge = needsRole ? (
    <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Configurando perfil...
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        roleBadgeClassName(role),
      )}
    >
      {roleLabel}
    </span>
  );

  // Cuenta dada de baja: acceso bloqueado hasta que un administrador la reactive.
  if (user && user.active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LogOut className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Cuenta desactivada
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tu acceso al taller ha sido dado de baja. Habla con el administrador
            del equipo si crees que es un error.
          </p>
          <Button type="button" className="mt-5 gap-2" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Atajo de teclado: quien navega sin ratón no tiene que recorrer el menú
          entero (once módulos) en cada cambio de pantalla. Aparece al enfocarlo. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Saltar al contenido
      </a>
      <DashboardSidebar
        sidebarRef={sidebarRef}
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        sidebarResizing={sidebarResizing}
        resizeHandleProps={resizeHandleProps}
        toggleSidebar={toggleSidebar}
        isGuest={isGuest}
        canSearchCatalog={can("viewInventory")}
        canSendMessages={can("sendMessages")}
        onSearchSelect={handleSearchSelect}
        onOpenNotification={openNotification}
        navItems={navItems}
        navBadges={navBadges}
        activeTab={activeTab}
        onSelectTab={goToTab}
        displayName={displayName}
        initial={initial}
        userEmail={user?.email}
        roleBadge={roleBadge}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          roleBadge={roleBadge}
          onOpenNotification={openNotification}
          canSendMessages={can("sendMessages")}
          isGuest={isGuest}
          canSearchCatalog={can("viewInventory")}
          onSearchSelect={handleSearchSelect}
          activeTab={activeTab}
          goToTab={goToTab}
          initial={initial}
          onSignOut={handleSignOut}
          navItems={navItems}
          navBadges={navBadges}
        />

        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 pb-1 pt-4 sm:px-6 sm:pt-5"
        >
          <PageHeader
            title={heading.title}
            count={headingCount}
            description={heading.description}
            actions={headerActions}
          />

          {!summaryHidden && (
            <WorkAlertNotice
              role={role}
              audience={alertRoleKeys}
              days={alertDays}
              staleWork={staleWork}
              dismissed={alertDismissed}
              canOpenSettings={can("manageIncidents")}
              onOpenIncident={openIncident}
              onOpenSettings={() => goToTab("settings")}
              onDismiss={dismissAlert}
            />
          )}

          <DashboardStats
            loading={loading}
            hidden={summaryHidden}
            stats={stats}
          />

          <section className="mt-2">
            <DashboardContent
              isGuest={isGuest}
              showEmptyNotice={showEmptyNotice}
              loading={loading}
              activeTab={activeTab}
              user={user}
              displayName={displayName}
              adminOk={adminOk}
              can={can}
              canSeePurchasing={canSeePurchasing}
              initialIncidentId={target.incidentId ?? null}
              incidentsViewKey={viewKeys.incidents}
              archiveInitialEntry={target.archiveEntry ?? null}
              archiveViewKey={viewKeys.archive}
              requestsEquipmentFilter={target.requestsEquipmentFilter ?? "all"}
              onEquipmentFilterChange={setRequestsEquipmentFilter}
              initialRequestId={target.requestId ?? null}
              requestsInitialFilter={target.requestsFilter ?? "all"}
              requestsViewKey={viewKeys.requests}
              inventoryInitialSearch={target.inventorySearch ?? ""}
              inventoryLowStockOnly={target.inventoryLowStockOnly ?? false}
              inventoryViewKey={viewKeys.inventory}
              equipmentInitialSearch={target.equipmentSearch ?? ""}
              equipmentViewKey={viewKeys.equipment}
              searchParamsCode={searchParams.get("codigo")}
              isSeeding={isSeeding}
              onSeed={() => void handleSeed()}
              onStartEmpty={handleStartEmpty}
              onSwitchAccount={() => void handleSwitchAccount()}
              onOpenIncident={openIncident}
              onOpenRequest={openRequest}
              goToTab={goToTab}
              onEquipmentViewRequests={openEquipmentViewRequests}
            />
          </section>
        </main>

        {weeklyReportOpen && (
          <Suspense fallback={null}>
            <WeeklyReportDialog
              open={weeklyReportOpen}
              onOpenChange={setWeeklyReportOpen}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
