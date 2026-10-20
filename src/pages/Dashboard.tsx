import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { readStartedEmpty, writeStartedEmpty } from "@/lib/emptyWorkshop";
import { DEFAULT_GRANTS, type Capability } from "@/lib/permissions";
import {
  DEFAULT_ROLE,
  fallbackRoleMeta,
  isAdmin,
  isSystemRole,
  roleBadgeClassName,
} from "@/lib/roles";
import { safeLocalStorage } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import {
  dismissalOf,
  isDismissed,
  readDismissal,
  writeDismissal,
} from "@/lib/workAlert";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
  alertReachesRole,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
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
import {
  PageHeader,
  type PageHeaderAction,
} from "./dashboard/components/PageHeader";
import { useSidebarPanel } from "./dashboard/hooks/useSidebarPanel";
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
  // Ajustes del aviso de trabajo sin constancia: margen y a quién le llega.
  // Los lee cualquiera con sesión (el panel decide con ellos si enseña el
  // aviso); cambiarlos es cosa de quien coordina las incidencias.
  const alertSettings = useQuery(api.alerts.settings);
  // El margen con el que se cuenta el trabajo sin constancia: mientras cargan
  // los ajustes vale el de partida.
  const alertDays = alertSettings?.days ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
  // El armazón no carga los módulos: pide contado lo que enseña —las píldoras
  // del menú, las tarjetas del resumen y el aviso de trabajo sin constancia— y
  // cada módulo carga lo suyo al abrirse. El backend no cuenta lo que ese rol no
  // puede ver, así que esto es el mismo número que salía de aquellas listas.
  const summary = useQuery(api.dashboard.summary, { marginDays: alertDays });
  const seedDemoData = useMutation(api.seed.seedDemoData);
  const seedMoreDemoData = useMutation(api.seed.seedMoreDemoData);
  // Las fotos abandonadas del formulario y los PDF de los manuales son lo único
  // de la muestra que necesita una acción: el almacén solo se escribe desde ahí
  // (ver `seedDemoUploads` y `seedDemoManuals`).
  const seedDemoUploads = useAction(api.seed.seedDemoUploads);
  const seedDemoManuals = useAction(api.seed.seedDemoManuals);
  const saveWorkAlertDismissal = useMutation(
    api.members.saveWorkAlertDismissal,
  );

  const [tab, setTab] = useState<NavId>("incidents");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeedingMore, setIsSeedingMore] = useState(false);
  // «Empezar con el taller vacío»: la elección de no cargar la muestra cuando
  // la base está recién instalada. Se recuerda en el navegador para que el
  // aviso no vuelva a tapar los módulos en cada visita mientras no haya datos.
  const [startedEmpty, setStartedEmpty] = useState(() =>
    readStartedEmpty(safeLocalStorage()),
  );
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false);
  // Aviso de trabajo sin constancia: lo que esta persona ya cerró (qué
  // incidencias y con qué margen), para no repetírselo tal cual. Cerrarlo es
  // cosa de cada uno, pero se recuerda en su perfil y no solo en este
  // navegador: al entrar desde otro dispositivo el aviso sigue cerrado.
  // `localStorage` se mantiene como copia local para el primer render, igual
  // que el ancho del panel; ver `lib/workAlert`.
  const [alertDismissal, setAlertDismissal] = useState(() =>
    readDismissal(safeLocalStorage()),
  );
  // El perfil llega después del primer render, así que se adopta una sola vez
  // por usuario (el mismo patrón que el menú lateral).
  const [alertOwner, setAlertOwner] = useState<string | null>(null);
  if (user && alertOwner !== user._id) {
    setAlertOwner(user._id);
    // Un perfil sin nada cerrado (cuenta nueva) conserva la copia local: es lo
    // que esa persona acaba de cerrar en este navegador.
    if (user.workAlertDismissal !== undefined) {
      setAlertDismissal(user.workAlertDismissal);
    }
  }

  // La copia local sigue al perfil: al volver a este navegador, el aviso ya
  // sale cerrado en el primer render (antes de que llegue el perfil), sin
  // parpadeo. Quien manda es el perfil, que es lo que viaja entre dispositivos.
  useEffect(() => {
    writeDismissal(safeLocalStorage(), alertDismissal);
  }, [alertDismissal]);

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
  const [requestsEquipmentFilter, setRequestsEquipmentFilter] =
    useState<string>("all");

  // Búsqueda global: estado para abrir el resultado elegido en su módulo.
  // Los "key" permiten remontar la vista si ya estaba visible (p. ej. se
  // elige una petición estando ya en la cola).
  const [requestsViewKey, setRequestsViewKey] = useState(0);
  const [initialRequestId, setInitialRequestId] =
    useState<Id<"partRequests"> | null>(null);
  // Aviso del panel: abrir la ficha de una incidencia concreta (y remontar la
  // cola para que la abra aunque ya estuviera visible).
  const [incidentsViewKey, setIncidentsViewKey] = useState(0);
  const [initialIncidentId, setInitialIncidentId] =
    useState<Id<"incidents"> | null>(null);
  // Lo archivado que llega desde el buscador: una ficha concreta del archivo,
  // que se abre en solo lectura. El `key` remonta el archivo para que la abra
  // aunque ya estuviera montado.
  const [archiveViewKey, setArchiveViewKey] = useState(0);
  const [archiveInitialEntry, setArchiveInitialEntry] =
    useState<OpenArchivedDoc | null>(null);
  const [inventoryViewKey, setInventoryViewKey] = useState(0);
  const [inventoryInitialSearch, setInventoryInitialSearch] = useState("");
  const [equipmentViewKey, setEquipmentViewKey] = useState(0);
  const [equipmentInitialSearch, setEquipmentInitialSearch] = useState("");

  // Tarjetas del resumen: abren su módulo con el filtro que corresponde.
  const [requestsInitialFilter, setRequestsInitialFilter] =
    useState<RequestFilterId>("all");
  const [inventoryLowStockOnly, setInventoryLowStockOnly] = useState(false);

  // Permisos: el rol llega de `users`; si aún no está asignado, se pide una vez
  // (con reintentos: un fallo transitorio no debe dejar el perfil sin asignar).
  const ensureRole = useMutation(api.members.ensureRole);
  const roleAttempts = useRef(0);
  const role = user?.role ?? DEFAULT_ROLE;
  const adminOk = isAdmin(user?.role);
  // Permisos configurados por el administrador (defaults mientras cargan). El
  // invitado va directo a los del rol guest, para no enseñar un menú de técnico
  // mientras el backend todavía no le ha asignado su rol.
  const grants = isGuest
    ? DEFAULT_GRANTS.guest
    : (permissions?.grants ??
      DEFAULT_GRANTS[isSystemRole(role) ? role : DEFAULT_ROLE]);
  const can = (capability: Capability) => grants[capability] === true;
  // El resumen semanal es de los mandos del taller: los mismos que coordinan
  // las incidencias o deciden las peticiones (igual que el archivo).
  const canConfigureReport = can("manageIncidents") || can("decideRequests");
  // Compras: lo que el almacén no cubre. El módulo carga sus tres listas al
  // abrirse —lo que espera por proveedor, las órdenes y las recepciones con su
  // albarán—; aquí solo queda la capacidad, que decide si el módulo se enseña.
  const canSeePurchasing = can("viewPurchasing") || can("managePurchasing");
  const needsRole =
    user !== undefined && user !== null && user.role === undefined;

  useEffect(() => {
    if (!needsRole) {
      roleAttempts.current = 0;
      return;
    }
    let cancelled = false;
    const assignRole = async () => {
      try {
        await ensureRole();
      } catch (error) {
        console.warn("No se pudo asignar el rol:", error);
        roleAttempts.current += 1;
        if (!cancelled && roleAttempts.current < 6) {
          window.setTimeout(() => void assignRole(), 2500);
        }
      }
    };
    void assignRole();
    return () => {
      cancelled = true;
    };
  }, [needsRole, ensureRole]);

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

  // Mientras el contador no ha llegado no se enseña una cifra que todavía no es:
  // se enseña el esqueleto, como antes mientras cargaban las listas.
  const loading = summary === undefined;

  // Si el rol cambia y el módulo activo deja de estar permitido, se muestra
  // la cola (valor derivado, sin efectos que re-rendericen en cascada).
  const activeAllowed =
    tab === "profile" || navItems.some((item) => item.id === tab);
  const fallbackTab: NavId = navItems.some((item) => item.id === "requests")
    ? "requests"
    : (navItems[0]?.id ?? "profile");
  const activeTab: NavId = activeAllowed ? tab : fallbackTab;

  const pendingRequests = summary?.requests.pending ?? 0;
  const urgentPending = summary?.requests.urgent ?? 0;
  const withoutReference = summary?.requests.withoutReference ?? 0;
  const issuedRequests = summary?.requests.issued ?? 0;
  const lowStockParts = summary?.parts.lowStock ?? 0;
  const totalParts = summary?.parts.total ?? 0;
  const isEmpty =
    !loading && totalParts === 0 && (summary?.requests.active ?? 0) === 0;
  const showEmptyNotice = isEmpty && !startedEmpty;

  const alertRoleKeys =
    alertSettings?.roleKeys ?? DEFAULT_WORK_WITHOUT_TRACE_ROLES;
  const seesAlert = alertReachesRole(role, alertRoleKeys);
  const staleWork = summary?.staleWork ?? [];
  const alertReferences = staleWork.map(({ incident }) => incident.reference);
  const alertDismissed = isDismissed(
    alertDismissal,
    alertReferences,
    alertDays,
  );

  const dismissAlert = () => {
    const dismissal = dismissalOf(alertReferences, alertDays);
    setAlertDismissal(dismissal);
    saveWorkAlertDismissal({ dismissal }).catch((error: unknown) => {
      console.warn("No se pudo guardar el aviso cerrado en el perfil:", error);
    });
  };

  const restoreAlert = () => {
    setAlertDismissal(null);
    saveWorkAlertDismissal({ dismissal: null }).catch((error: unknown) => {
      console.warn("No se pudo olvidar el aviso cerrado en el perfil:", error);
    });
  };

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

  const handleStartEmpty = () => {
    setStartedEmpty(true);
    writeStartedEmpty(safeLocalStorage(), true);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const photos = await seedDemoUploads();
      await seedDemoData();
      const manuals = await seedDemoManuals();
      const telling = [
        photos.uploaded > 0
          ? `${photos.uploaded} fotos del formulario esperando limpieza`
          : null,
        manuals.inserted > 0 ? `${manuals.inserted} manuales` : null,
      ].filter((part): part is string => part !== null);
      toast.success(
        telling.length > 0
          ? `Datos de ejemplo cargados · ${telling.join(" · ")}`
          : "Datos de ejemplo cargados",
      );
      setStartedEmpty(false);
      writeStartedEmpty(safeLocalStorage(), false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedMore = async () => {
    setIsSeedingMore(true);
    try {
      await seedDemoUploads();
      const result = await seedMoreDemoData({});
      const manuals = await seedDemoManuals();
      const added =
        result.incidents +
        result.requests +
        result.equipment +
        result.parts +
        result.team +
        manuals.inserted;
      toast.success(
        added === 0
          ? "No había nada nuevo que añadir"
          : `${result.incidents} incidencias y ${result.requests} peticiones nuevas · ${result.maintenance} fichas de mantenimiento` +
              (result.team > 0
                ? ` · ${result.team} personas en el equipo`
                : "") +
              (manuals.inserted > 0 ? ` · ${manuals.inserted} manuales` : ""),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeedingMore(false);
    }
  };

  const openRequests = (filter: RequestFilterId) => {
    setRequestsInitialFilter(filter);
    setRequestsEquipmentFilter("all");
    setInitialRequestId(null);
    setRequestsViewKey((key) => key + 1);
    setTab("requests");
  };

  /**
   * Abrir una petición concreta en su módulo (hoy la llama la ficha de la
   * incidencia, que enseña el material que se pidió para el caso). Se remonta la
   * cola con la petición delante, que es el mismo camino que usa el buscador
   * global: así se abre aunque la cola ya estuviera montada en otra pestaña.
   */
  const openRequest = (id: Id<"partRequests">) => {
    if (!can("viewRequests")) return;
    setInitialRequestId(id);
    setRequestsInitialFilter("all");
    setRequestsEquipmentFilter("all");
    setRequestsViewKey((key) => key + 1);
    setTab("requests");
  };

  const openIncident = (id: Id<"incidents">) => {
    setInitialIncidentId(id);
    setIncidentsViewKey((key) => key + 1);
    setTab("incidents");
  };

  const openNotification = (notification: {
    incidentId?: Id<"incidents"> | null;
  }) => {
    if (notification.incidentId) {
      openIncident(notification.incidentId);
    } else {
      goToTab("incidents");
    }
  };

  const openInventory = (lowStockOnly: boolean) => {
    setInventoryLowStockOnly(lowStockOnly);
    setInventoryInitialSearch("");
    setInventoryViewKey((key) => key + 1);
    setTab("inventory");
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

  const goToTab = (id: NavId) => {
    setTab(id);
    if (initialRequestId) {
      setInitialRequestId(null);
      setRequestsViewKey((key) => key + 1);
    }
    if (initialIncidentId) {
      setInitialIncidentId(null);
      setIncidentsViewKey((key) => key + 1);
    }
    if (archiveInitialEntry) {
      setArchiveInitialEntry(null);
      setArchiveViewKey((key) => key + 1);
    }
    setInventoryInitialSearch("");
    setEquipmentInitialSearch("");
    setRequestsInitialFilter("all");
    setInventoryLowStockOnly(false);
  };

  const handleSearchSelect = (hit: SearchHit) => {
    // Lo archivado no está en su cola: se abre en el archivo y en solo lectura,
    // que es donde sigue existiendo. Antes el resultado llevaba a un módulo que
    // ya no lo tenía.
    if ((hit.kind === "incident" || hit.kind === "request") && hit.archived) {
      if (!can(hit.kind === "incident" ? "viewIncidents" : "viewRequests")) {
        return;
      }
      setArchiveInitialEntry({ kind: hit.kind, id: hit.id });
      setArchiveViewKey((key) => key + 1);
      setTab("archive");
      return;
    }
    if (hit.kind === "incident") {
      if (!can("viewIncidents")) return;
      setInitialIncidentId(hit.id);
      setIncidentsViewKey((key) => key + 1);
      setTab("incidents");
      return;
    }
    if (hit.kind === "request") {
      if (!can("viewRequests")) return;
      setInitialRequestId(hit.id);
      setRequestsInitialFilter("all");
      setRequestsViewKey((key) => key + 1);
      setTab("requests");
      return;
    }
    if (hit.kind === "part") {
      if (!can("viewInventory")) return;
      setInventoryInitialSearch(hit.term);
      setInventoryLowStockOnly(false);
      setInventoryViewKey((key) => key + 1);
      setTab("inventory");
    } else {
      if (!can("viewEquipment")) return;
      setEquipmentInitialSearch(hit.term);
      setEquipmentViewKey((key) => key + 1);
      setTab("equipment");
    }
  };

  const roleLabel = permissions?.label ?? fallbackRoleMeta(role).label;

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
              initialIncidentId={initialIncidentId}
              incidentsViewKey={incidentsViewKey}
              archiveInitialEntry={archiveInitialEntry}
              archiveViewKey={archiveViewKey}
              requestsEquipmentFilter={requestsEquipmentFilter}
              onEquipmentFilterChange={setRequestsEquipmentFilter}
              initialRequestId={initialRequestId}
              requestsInitialFilter={requestsInitialFilter}
              requestsViewKey={requestsViewKey}
              inventoryInitialSearch={inventoryInitialSearch}
              inventoryLowStockOnly={inventoryLowStockOnly}
              inventoryViewKey={inventoryViewKey}
              equipmentInitialSearch={equipmentInitialSearch}
              equipmentViewKey={equipmentViewKey}
              searchParamsCode={searchParams.get("codigo")}
              isSeeding={isSeeding}
              onSeed={() => void handleSeed()}
              onStartEmpty={handleStartEmpty}
              onSwitchAccount={() => void handleSwitchAccount()}
              onOpenIncident={openIncident}
              onOpenRequest={openRequest}
              goToTab={goToTab}
              onEquipmentViewRequests={(equipmentId) => {
                setRequestsEquipmentFilter(equipmentId);
                setInitialRequestId(null);
                setRequestsViewKey((key) => key + 1);
                setTab("requests");
              }}
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
