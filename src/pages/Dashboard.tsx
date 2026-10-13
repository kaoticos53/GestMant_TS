import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import { DEFAULT_GRANTS, type Capability } from "@/lib/permissions";
import {
  DEFAULT_ROLE,
  fallbackRoleMeta,
  isAdmin,
  isSystemRole,
  roleBadgeClassName,
} from "@/lib/roles";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_STEP,
  clampSidebarWidth,
  readSidebarCollapsed,
  readSidebarWidth,
  safeLocalStorage,
  writeSidebarCollapsed,
  writeSidebarWidth,
} from "@/lib/sidebar";
import {
  dismissalOf,
  isDismissed,
  readDismissal,
  writeDismissal,
} from "@/lib/workAlert";
import { readStartedEmpty, writeStartedEmpty } from "@/lib/emptyWorkshop";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
  alertReachesRole,
  getErrorMessage,
  stockState,
  workWithoutTraceDays,
} from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Archive,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Cpu,
  Eye,
  FileClock,
  LogOut,
  Mail,
  PackageCheck,
  ShoppingCart,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Search,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { GlobalSearch, type SearchHit } from "./dashboard/GlobalSearch";
import { IncidentLookup } from "./dashboard/IncidentLookup";
import { WorkAlertNotice } from "./dashboard/WorkAlertNotice";
import type { RequestFilterId } from "./dashboard/RequestsView";
import { FULL_VERSION, DETAILED_VERSION } from "@/version";

const ArchiveView = lazy(() =>
  import("./dashboard/ArchiveView").then((m) => ({ default: m.ArchiveView })),
);
const WeeklyReportDialog = lazy(() =>
  import("./dashboard/WeeklyReportDialog").then((m) => ({
    default: m.WeeklyReportDialog,
  })),
);
const AuditView = lazy(() =>
  import("./dashboard/AuditView").then((m) => ({ default: m.AuditView })),
);
const EquipmentView = lazy(() =>
  import("./dashboard/EquipmentView").then((m) => ({ default: m.EquipmentView })),
);
const IncidentsView = lazy(() =>
  import("./dashboard/IncidentsView").then((m) => ({ default: m.IncidentsView })),
);
const InventoryView = lazy(() =>
  import("./dashboard/InventoryView").then((m) => ({ default: m.InventoryView })),
);
const ManualsView = lazy(() =>
  import("./dashboard/ManualsView").then((m) => ({ default: m.ManualsView })),
);
const PermissionsView = lazy(() =>
  import("./dashboard/PermissionsView").then((m) => ({
    default: m.PermissionsView,
  })),
);
const ProfileView = lazy(() =>
  import("./dashboard/ProfileView").then((m) => ({ default: m.ProfileView })),
);
const PurchasingView = lazy(() =>
  import("./dashboard/PurchasingView").then((m) => ({
    default: m.PurchasingView,
  })),
);
const RequestsView = lazy(() =>
  import("./dashboard/RequestsView").then((m) => ({ default: m.RequestsView })),
);
const UsersView = lazy(() =>
  import("./dashboard/UsersView").then((m) => ({ default: m.UsersView })),
);
const WorkshopSettingsView = lazy(() =>
  import("./dashboard/WorkshopSettingsView").then((m) => ({
    default: m.WorkshopSettingsView,
  })),
);

function ViewSkeleton() {
  return (
    <div className="grid gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-xl border border-border/70 bg-card/50" />
      <Skeleton className="h-36 rounded-xl border border-border/70 bg-card/50" />
    </div>
  );
}

type NavId =
  | "incidents"
  | "requests"
  | "purchasing"
  | "inventory"
  | "equipment"
  | "manuals"
  | "archive"
  | "audit"
  | "users"
  | "permissions"
  | "settings"
  | "profile";

interface NavItem {
  id: NavId;
  label: string;
  icon: typeof ClipboardList;
  /** Contador a mostrar en la píldora del menú (0 = sin píldora). */
  badge: number;
}

/** Preferencia del menú guardada en el perfil (viene del documento `users`). */
interface SidebarLayoutProfile {
  _id: string;
  sidebarWidth?: number;
  sidebarCollapsed?: boolean;
}

/**
 * Menú lateral en escritorio: ancho ajustable (se arrastra desde su borde o se
 * afina con las flechas del teclado) y plegable del todo.
 *
 * El perfil del usuario es la fuente de verdad: al entrar se adopta lo que allí
 * haya y cada cambio se guarda en él, así que la preferencia viaja con la
 * persona y no con el navegador. `localStorage` se mantiene como copia local
 * para pintar el ancho bueno en el primer render (antes de que llegue el
 * perfil) y para no perder el ajuste si la escritura falla.
 *
 * Devuelve el ancho a aplicar al `<aside>`, si está plegado, la referencia para
 * medir dónde empieza y las props del asa. Arg: el usuario firmado (o `null`
 * mientras no se sabe quién es).
 */
function useSidebarPanel(profile: SidebarLayoutProfile | null | undefined) {
  const [width, setWidth] = useState(() =>
    clampSidebarWidth(
      readSidebarWidth(safeLocalStorage()) ?? SIDEBAR_WIDTH_DEFAULT,
      window.innerWidth,
    ),
  );
  const [collapsed, setCollapsed] = useState(() =>
    readSidebarCollapsed(safeLocalStorage()),
  );
  const [resizing, setResizing] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  // El arrastre se sigue en un ref: los eventos de puntero no deben depender de
  // que React haya vuelto a renderizar entre dos movimientos.
  const dragging = useRef(false);
  const saveLayout = useMutation(api.members.saveSidebarLayout);

  // El perfil llega después del primer render, así que se adopta una sola vez
  // por usuario (patrón de React para ajustar estado al aparecer una prop). Así
  // el arranque es instantáneo con la copia local, sin parpadeo.
  const [layoutOwner, setLayoutOwner] = useState<string | null>(null);
  if (profile && layoutOwner !== profile._id) {
    setLayoutOwner(profile._id);
    // Un perfil sin preferencia (cuenta nueva) conserva la copia local: es la
    // que el usuario acaba de elegir en este navegador, y se sube al perfil.
    if (profile.sidebarWidth !== undefined) {
      setWidth(clampSidebarWidth(profile.sidebarWidth, window.innerWidth));
    }
    if (profile.sidebarCollapsed !== undefined) {
      setCollapsed(profile.sidebarCollapsed);
    }
  }

  // La copia local se escribe al soltar, no en cada píxel del arrastre.
  useEffect(() => {
    if (resizing) return;
    writeSidebarWidth(safeLocalStorage(), width);
  }, [width, resizing]);

  useEffect(() => {
    writeSidebarCollapsed(safeLocalStorage(), collapsed);
  }, [collapsed]);

  useEffect(() => {
    // Durante el arrastre solo se pinta: al soltar (o al pulsar una flecha) es
    // cuando se manda una única escritura al perfil, no una por píxel.
    if (resizing || layoutOwner === null) return;
    saveLayout({ width, collapsed }).catch((error: unknown) => {
      console.warn("No se pudo guardar el menú en el perfil:", error);
    });
  }, [resizing, layoutOwner, width, collapsed, saveLayout]);

  // Si la ventana se estrecha, el panel se reajusta para no comerse el contenido.
  useEffect(() => {
    const handleWindowResize = () =>
      setWidth((current) => clampSidebarWidth(current, window.innerWidth));
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Mientras se arrastra, el cursor y la selección de texto no deben cambiar.
  useEffect(() => {
    if (!resizing) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [resizing]);

  /** El asa viaja con el puntero, así que el ancho es la distancia al borde del menú. */
  const setFromPointer = (clientX: number) => {
    const left = asideRef.current?.getBoundingClientRect().left ?? 0;
    setWidth(clampSidebarWidth(clientX - left, window.innerWidth));
  };

  const stopDragging = () => {
    dragging.current = false;
    setResizing(false);
  };

  const resizeHandleProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      setResizing(true);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      setFromPointer(event.clientX);
    },
    onPointerUp: () => {
      if (!dragging.current) return;
      stopDragging();
    },
    onPointerCancel: () => {
      if (!dragging.current) return;
      stopDragging();
    },
    onDoubleClick: () => setWidth(resetSidebarWidth()),
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        setWidth((current) =>
          clampSidebarWidth(current - SIDEBAR_WIDTH_STEP, window.innerWidth),
        );
      } else if (event.key === "ArrowRight") {
        setWidth((current) =>
          clampSidebarWidth(current + SIDEBAR_WIDTH_STEP, window.innerWidth),
        );
      } else if (event.key === "Home") {
        setWidth(resetSidebarWidth());
      } else {
        return;
      }
      event.preventDefault();
    },
  };

  const toggleCollapsed = () => setCollapsed((current) => !current);

  return {
    width,
    resizing,
    collapsed,
    toggleCollapsed,
    asideRef,
    resizeHandleProps,
  };
}

/** Ancho de siempre, ya ajustado a la ventana actual. */
function resetSidebarWidth(): number {
  return clampSidebarWidth(SIDEBAR_WIDTH_DEFAULT, window.innerWidth);
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  // Una sesión de invitado no es del taller: no tiene ningún permiso, el
  // backend tampoco le contesta (sus listas degradan a vacío) y no puede guardar
  // preferencias en el perfil. Se decide aquí arriba porque lo usan el menú
  // lateral y los permisos.
  const isGuest = user?.isAnonymous === true;
  const navigate = useNavigate();
  const parts = useQuery(api.spareParts.list);
  // Lo archivado viaja en la misma consulta (una sola suscripción): el día a
  // día se queda con lo activo y el módulo de archivo con el resto. Así las
  // fichas de equipo siguen resolviendo el enlace a una petición archivada.
  const requests = useQuery(api.partRequests.list, { includeArchived: true });
  const equipment = useQuery(api.equipment.list, {});
  const manuals = useQuery(api.manuals.list);
  const maintenance = useQuery(api.maintenance.list);
  const incidents = useQuery(api.incidents.list, { includeArchived: true });
  const permissions = useQuery(api.permissions.myPermissions);
  // Ajustes del aviso de trabajo sin constancia: margen y a quién le llega.
  // Los lee cualquiera con sesión (el panel decide con ellos si enseña el
  // aviso); cambiarlos es cosa de quien coordina las incidencias.
  const alertSettings = useQuery(api.alerts.settings);
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
  // Compras: lo que el almacén no cubre. Se pregunta solo si se puede ver (el
  // backend no contesta a quien no tiene la capacidad), y lo que llega son las
  // tres listas del módulo: lo que espera por proveedor, las órdenes y las
  // recepciones con su albarán.
  const canSeePurchasing = can("viewPurchasing") || can("managePurchasing");
  const purchasingArgs = canSeePurchasing ? {} : ("skip" as const);
  const purchaseRequests = useQuery(
    api.purchasing.listPurchaseRequests,
    purchasingArgs,
  );
  const purchaseOrders = useQuery(api.purchasing.listOrders, purchasingArgs);
  const receptions = useQuery(api.purchasing.listReceptions, purchasingArgs);
  // La papelera de incidencias: lo retirado esperando su plazo. Se pide solo a
  // quien puede deshacer (el backend no contesta a nadie más); de aquí salen la
  // lista que enseña el módulo Archivo y el plazo que tiene ajustado el taller.
  const incidentTrash = useQuery(
    api.incidents.trash,
    can("manageIncidents") ? {} : ("skip" as const),
  );
  // La de peticiones, con la misma forma y la misma pantalla: lo retirado de
  // cada tipo se deshace desde el módulo Archivo, con el plazo de la papelera.
  const requestTrash = useQuery(
    api.partRequests.trash,
    can("decideRequests") ? {} : ("skip" as const),
  );
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
    // Compras: el trabajo del responsable cuando el almacén no tiene lo que se
    // pide. Va después de las peticiones porque es su continuación natural.
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
    // Manuales: la documentación del taller. La ve quien tenga la capacidad,
    // pero nunca una sesión de invitado, que no es del taller.
    ...(can("viewManuals") && !isGuest
      ? ([
          { id: "manuals", label: "Manuales", icon: BookOpen, badge: 0 },
        ] as NavItem[])
      : []),
    // Archivo: el histórico de lo que ya no está en el día a día. Lo ve quien
    // puede ver alguna de las dos colas que guarda.
    ...(can("viewIncidents") || can("viewRequests")
      ? ([
          { id: "archive", label: "Archivo", icon: Archive, badge: 0 },
        ] as NavItem[])
      : []),
    // Auditoría de documentos: el rastro del expediente de todas las
    // incidencias. Es una lectura de administración (capacidad bloqueada), así
    // que solo aparece para el administrador.
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
    // Ajustes del taller: los ajustes de fondo —el archivado automático, el
    // aviso de trabajo sin constancia y los avisos del expediente—, juntos en
    // una pantalla. Lo ve quien puede configurar al menos uno de los tres; los
    // avisos del expediente son de quien audita (el administrador).
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

  const loading =
    parts === undefined ||
    requests === undefined ||
    equipment === undefined ||
    maintenance === undefined ||
    incidents === undefined;
  const allParts = parts ?? [];
  const allRequests = requests ?? [];
  const allEquipment = equipment ?? [];
  const allManuals = manuals ?? [];
  const allMaintenance = maintenance ?? [];
  const allIncidents = incidents ?? [];
  // Cola viva (lo que se trabaja hoy) frente a lo archivado.
  const activeRequests = allRequests.filter(
    (request) => request.archivedAt === undefined,
  );
  const archivedRequests = allRequests.filter(
    (request) => request.archivedAt !== undefined,
  );
  const activeIncidents = allIncidents.filter(
    (incident) => incident.archivedAt === undefined,
  );
  const archivedIncidents = allIncidents.filter(
    (incident) => incident.archivedAt !== undefined,
  );

  // Si el rol cambia y el módulo activo deja de estar permitido, se muestra
  // la cola (valor derivado, sin efectos que re-rendericen en cascada).
  const activeAllowed =
    tab === "profile" || navItems.some((item) => item.id === tab);
  const fallbackTab: NavId = navItems.some((item) => item.id === "requests")
    ? "requests"
    : (navItems[0]?.id ?? "profile");
  const activeTab: NavId = activeAllowed ? tab : fallbackTab;

  const pendingRequests = activeRequests.filter((r) => r.status === "pending");
  const urgentPending = pendingRequests.filter((r) => r.priority === "urgent");
  const withoutReference = pendingRequests.filter(
    (r) => r.lines.length === 0,
  ).length;
  const issuedRequests = activeRequests.filter((r) => r.status === "issued");
  // Misma regla que el catálogo (`stockState`): lo que cuenta esta tarjeta es
  // exactamente lo que enseña el filtro «solo stock bajo» del módulo.
  const lowStockParts = allParts.filter(
    (p) => stockState(p.stock, p.minStock) !== "ok",
  );
  const isEmpty =
    !loading && allParts.length === 0 && activeRequests.length === 0;
  // El aviso de «todavía no hay datos» solo sale si no se ha pedido empezar sin
  // muestra: en cuanto se elige el taller vacío, mandan los módulos.
  const showEmptyNotice = isEmpty && !startedEmpty;

  // Margen y audiencia del aviso: lo último que dejó configurado quien
  // coordina (mientras cargan los ajustes valen los valores de partida).
  const alertDays = alertSettings?.days ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
  const alertRoleKeys =
    alertSettings?.roleKeys ?? DEFAULT_WORK_WITHOUT_TRACE_ROLES;
  const seesAlert = alertReachesRole(role, alertRoleKeys);

  // Trabajo en curso sin constancia: incidencias en manos de un técnico desde
  // hace días y sin ninguna nota suya. Es el aviso que busca el coordinador
  // para detectar lo que avanza sin dejar rastro (la regla vive en `workshop`,
  // compartida con sus pruebas). Se ordena por lo más parado primero.
  const staleWork = activeIncidents
    .flatMap((incident) => {
      // El reloj lo pone la propia regla (hoy por defecto); aquí solo se le
      // adelanta el margen que dejó configurado quien coordina.
      const days = workWithoutTraceDays(incident, undefined, alertDays);
      return days === null ? [] : [{ incident, days }];
    })
    .sort((a, b) => b.days - a.days);

  // Cerrar el aviso no es silenciarlo: se recuerda lo avisado, así que vuelve
  // en cuanto aparezca trabajo parado que aún no se había visto (o cambie el
  // margen, que es otra regla). Ver `lib/workAlert`.
  const alertReferences = staleWork.map(({ incident }) => incident.reference);
  const alertDismissed = isDismissed(
    alertDismissal,
    alertReferences,
    alertDays,
  );

  const dismissAlert = () => {
    const dismissal = dismissalOf(alertReferences, alertDays);
    setAlertDismissal(dismissal);
    // Al perfil va el cierre: así no reaparece en el siguiente dispositivo
    // desde el que se entre con esta cuenta (la copia local la escribe el
    // efecto de arriba, que sigue al perfil).
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

  // Contadores de las píldoras del menú (usan los valores ya calculados).
  const navBadges: Record<NavId, number> = {
    incidents: activeIncidents.filter((item) => item.status === "reported")
      .length,
    requests: pendingRequests.length,
    // La píldora de compras cuenta lo que espera a que alguien monte la orden,
    // que es el trabajo pendiente del responsable.
    purchasing: (purchaseRequests?.requests ?? []).filter(
      (row) => row.status === "pending",
    ).length,
    inventory: 0,
    equipment: allEquipment.length,
    manuals: allManuals.length,
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

  /** Cambiar de cuenta desde una sesión de invitado: hay que cerrarla primero,
   * porque `/auth` devuelve al panel a quien ya tiene sesión. */
  const handleSwitchAccount = async () => {
    await signOut();
    navigate("/auth");
  };

  /** Empieza sin muestra: se oculta el aviso y quedan los módulos a la vista,
   * cada uno con su alta (repuesto, equipo, petición...). */
  const handleStartEmpty = () => {
    setStartedEmpty(true);
    writeStartedEmpty(safeLocalStorage(), true);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      // Primero las fotos —que es lo que no cabe en la mutación— y después la
      // muestra: así, cuando el taller quede marcado como sembrado, el almacén ya
      // enseña lo que enseña un taller de verdad.
      const photos = await seedDemoUploads();
      await seedDemoData();
      // Los manuales van al final: la mitad se asignan a equipos que la muestra
      // acaba de crear. La acción no duplica lo que ya está.
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
      // Cargar la muestra deshace la elección de empezar vacío.
      setStartedEmpty(false);
      writeStartedEmpty(safeLocalStorage(), false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeeding(false);
    }
  };

  /** Añade otra tanda de ejemplo: más cola que recorrer y archivo que probar. */
  const handleSeedMore = async () => {
    setIsSeedingMore(true);
    try {
      // Las fotos del formulario también aquí: quien ya tenía muestra de antes se
      // las encuentra al pedir más, que es la única puerta que le queda abierta
      // cuando el taller no está vacío. Sin duplicar nada, ya están apuntadas.
      await seedDemoUploads();
      const result = await seedMoreDemoData({});
      // Los manuales también aquí: quien ya tenía muestra de antes se los
      // encuentra al pedir más (la acción no duplica los que ya estén).
      const manuals = await seedDemoManuals();
      const added =
        result.incidents +
        result.requests +
        result.equipment +
        result.parts +
        manuals.inserted;
      toast.success(
        added === 0
          ? "No había nada nuevo que añadir"
          : `${result.incidents} incidencias y ${result.requests} peticiones nuevas · ${result.maintenance} fichas de mantenimiento` +
              (manuals.inserted > 0 ? ` · ${manuals.inserted} manuales` : ""),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSeedingMore(false);
    }
  };

  /** Abre la cola de peticiones filtrada por estado (tarjetas del resumen).
   * Se limpian los prefiltros de la búsqueda global para que el resultado no
   * quede escondido por un filtro anterior. */
  const openRequests = (filter: RequestFilterId) => {
    setRequestsInitialFilter(filter);
    setRequestsEquipmentFilter("all");
    setInitialRequestId(null);
    setRequestsViewKey((key) => key + 1);
    setTab("requests");
  };

  /** Abre la ficha de una incidencia concreta (aviso del panel). */
  const openIncident = (id: Id<"incidents">) => {
    setInitialIncidentId(id);
    setIncidentsViewKey((key) => key + 1);
    setTab("incidents");
  };

  /**
   * Lo que hace la campana al elegir un aviso: si el aviso apunta a una ficha
   * (`incidentId`), abrirla —es lo que pide «verla»—; si no, a la cola de
   * incidencias, que es donde vive lo que cuentan los avisos del taller.
   */
  const openNotification = (notification: {
    incidentId?: Id<"incidents"> | null;
  }) => {
    if (notification.incidentId) {
      openIncident(notification.incidentId);
    } else {
      goToTab("incidents");
    }
  };

  /** Abre el catálogo, opcionalmente mostrando solo lo que está bajo mínimo. */
  const openInventory = (lowStockOnly: boolean) => {
    setInventoryLowStockOnly(lowStockOnly);
    setInventoryInitialSearch("");
    setInventoryViewKey((key) => key + 1);
    setTab("inventory");
  };

  // Resumen: cada tarjeta pertenece a un módulo, así que solo se muestran las
  // de los módulos que el rol puede ver (las de otros son información de más).
  // Pulsar una tarjeta lleva a su módulo con el filtro relacionado ya puesto.
  const stats: {
    label: string;
    value: number;
    hint: string;
    icon: typeof ClipboardList;
    iconClassName: string;
    go: () => void;
  }[] = [
    ...(can("viewRequests")
      ? [
          {
            label: "Peticiones pendientes",
            value: pendingRequests.length,
            hint:
              pendingRequests.length === 0
                ? "Cola revisada, nada que aprobar"
                : [
                    urgentPending.length > 0
                      ? `${urgentPending.length} urgentes`
                      : null,
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
            value: lowStockParts.length,
            hint:
              lowStockParts.length === 0
                ? "Todo por encima del mínimo"
                : "Por debajo del mínimo",
            icon: CircleAlert,
            iconClassName: "bg-amber-500/10 text-amber-700",
            go: () => openInventory(true),
          },
          {
            label: "Repuestos en catálogo",
            value: allParts.length,
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
            value: issuedRequests.length,
            hint: "Material ya en manos del técnico",
            icon: PackageCheck,
            iconClassName: "bg-emerald-600/10 text-emerald-700",
            go: () => openRequests("issued"),
          },
        ]
      : []),
  ];

  // El resumen (y el aviso de trabajo sin constancia) solo tiene sentido en las
  // pantallas de trabajo: en perfil, permisos, ajustes y archivo no pinta nada.
  const summaryHidden =
    activeTab === "profile" ||
    activeTab === "permissions" ||
    activeTab === "settings" ||
    activeTab === "archive" ||
    activeTab === "audit" ||
    stats.length === 0;

  const navButtonClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
      active
        ? "border-signal/30 bg-signal/10 text-signal"
        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const navPillClass = (active: boolean) =>
    cn(
      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
      active
        ? "bg-signal text-primary-foreground"
        : "bg-muted text-muted-foreground",
    );

  /** Cambia de módulo limpiando los prefiltros de la búsqueda global. */
  const goToTab = (id: NavId) => {
    setTab(id);
    if (initialRequestId) {
      // Cierra el detalle abierto desde la búsqueda global.
      setInitialRequestId(null);
      setRequestsViewKey((key) => key + 1);
    }
    if (initialIncidentId) {
      // Cierra la ficha abierta desde el aviso del panel.
      setInitialIncidentId(null);
      setIncidentsViewKey((key) => key + 1);
    }
    setInventoryInitialSearch("");
    setEquipmentInitialSearch("");
    // Los filtros de las tarjetas del resumen no se arrastran al menú.
    setRequestsInitialFilter("all");
    setInventoryLowStockOnly(false);
  };

  /** Abre el resultado de la búsqueda global en su módulo (si el rol tiene
   * permiso para verlo: el catálogo solo si concede ver repuestos/equipos). */
  const handleSearchSelect = (hit: SearchHit) => {
    if (hit.kind === "incident") {
      if (!can("viewIncidents")) return;
      setInitialIncidentId(hit.id);
      // Vuelve a montar la vista: abrir la ficha de una incidencia ya abierta
      // tiene que funcionar igual que la primera vez.
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

  const renderNavButton = (item: NavItem) => {
    const active = activeTab === item.id;
    const badge = navBadges[item.id];
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => goToTab(item.id)}
        aria-current={active ? "page" : undefined}
        className={navButtonClass(active)}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge > 0 && <span className={navPillClass(active)}>{badge}</span>}
      </button>
    );
  };

  // Etiqueta del rol: la de la base de datos (los personalizados) o la de código.
  const roleLabel = permissions?.label ?? fallbackRoleMeta(role).label;
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
      {/* Menú lateral (escritorio): el ancho lo elige quien lo usa y se puede
          plegar del todo. Cuando está plegado desaparece de la vista (su
          contenido no recibe foco), pero queda montado para animar el plegado. */}
      <aside
        id="menu-lateral"
        ref={sidebarRef}
        inert={sidebarCollapsed}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-card/60 lg:flex",
          !sidebarResizing && "transition-[width] duration-200 ease-out",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2.5 border-b border-border/70 px-5">
          <img
            src={logo}
            alt="Pulso Taller"
            className="size-8 rounded-lg ring-1 ring-border"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Equipo audiovisual
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <NotificationBell onOpen={openNotification} />
            <MessagesCenter canSend={can("sendMessages")} />
          </div>
        </div>

        {/* Búsqueda global. El invitado no la tiene: sus listas llegan vacías,
            así que buscar ahí no encontraría ni la incidencia que sí puede
            seguir; su puerta es la consulta por referencia. */}
        {!isGuest && (
          <div className="border-b border-border/70 p-3">
            <GlobalSearch
              incidents={activeIncidents}
              requests={activeRequests}
              parts={allParts}
              equipment={allEquipment}
              canSearchCatalog={can("viewInventory")}
              onSelect={handleSearchSelect}
            />
          </div>
        )}

        <nav
          aria-label="Módulos"
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {/* Sin módulos que ofrecer —el caso del invitado— no se deja el
              epígrafe solo, que parecería una sección a medio hacer. */}
          {navItems.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Módulos
            </p>
          )}
          {navItems.map(renderNavButton)}
        </nav>

        <div className="border-t border-border/70 p-3">
          <button
            type="button"
            onClick={() => goToTab("profile")}
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
                {user?.email ??
                  (user?.isAnonymous ? "Sesión de invitado" : "Sin correo")}
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
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </div>

          <div
            className="mt-2 text-center text-[11px] text-muted-foreground/60 select-none"
            title={DETAILED_VERSION}
          >
            {FULL_VERSION}
          </div>
        </div>
      </aside>

      {/* Borde del menú: se arrastra (o se usan las flechas) para cambiar su ancho. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar el menú lateral"
        aria-valuenow={sidebarWidth}
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        tabIndex={0}
        title="Arrastra para cambiar el ancho · doble clic para restablecer"
        {...resizeHandleProps}
        className="group sticky top-0 hidden h-screen w-1.5 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none lg:block"
      >
        {/* La línea del borde queda justo donde estaba la del menú. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-border/70 transition-colors",
            "group-hover:bg-signal/50 group-focus-visible:w-0.5 group-focus-visible:bg-signal",
            sidebarResizing && "w-0.5 bg-signal",
          )}
        />
      </div>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
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
            {/* Lo que vivía en el menú: avisos, mensajes y el rol en uso. */}
            <div className="flex shrink-0 items-center gap-2">
              {roleBadge}
              <NotificationBell onOpen={openNotification} />
              <MessagesCenter canSend={can("sendMessages")} />
            </div>
          </div>
        )}
        {/* Cabecera móvil */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <a href="/" className="flex min-w-0 items-center gap-3">
              <img
                src={logo}
                alt="Pulso Taller"
                className="size-8 rounded-lg ring-1 ring-border"
              />
              <span className="truncate text-sm font-semibold tracking-tight">
                Pulso Taller
              </span>
            </a>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell onOpen={openNotification} />
              <MessagesCenter canSend={can("sendMessages")} />
              <span className="hidden sm:block">{roleBadge}</span>
              <button
                type="button"
                onClick={() => goToTab("profile")}
                aria-label="Ver mi perfil"
                aria-current={activeTab === "profile" ? "page" : undefined}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-semibold text-signal transition-shadow",
                  activeTab === "profile" && "ring-2 ring-signal/50",
                )}
              >
                {initial}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Salir
              </Button>
            </div>
          </div>

          {/* Módulos en barra horizontal (móvil) */}
          <nav
            aria-label="Módulos"
            className="flex gap-1 overflow-x-auto border-t border-border/70 px-3 py-2"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const badge = navBadges[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-signal/30 bg-signal/10 text-signal"
                      : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {badge > 0 && (
                    <span className={navPillClass(true)}>{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Búsqueda global (móvil); el invitado tampoco la tiene (ver arriba). */}
          {!isGuest && (
            <div className="border-t border-border/70 px-3 py-2">
              <GlobalSearch
                incidents={allIncidents}
                requests={allRequests}
                parts={allParts}
                equipment={allEquipment}
                canSearchCatalog={can("viewInventory")}
                onSelect={handleSearchSelect}
              />
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-signal">{roleLabel}</p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {isGuest
                  ? "Sesión de invitado"
                  : activeTab === "profile"
                    ? "Mi perfil"
                    : activeTab === "permissions"
                      ? "Roles y permisos"
                      : activeTab === "settings"
                        ? "Ajustes del taller"
                        : activeTab === "archive"
                          ? "Archivo del taller"
                          : activeTab === "manuals"
                            ? "Manuales del taller"
                            : "Incidencias, peticiones y stock del taller"}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {isGuest
                  ? "Has entrado como invitado: puedes seguir una incidencia con la referencia que te dieron al notificarla. El resto del taller es para quien entra con su cuenta."
                  : activeTab === "profile"
                    ? "Tu ficha en el taller: datos de contacto, incidencias asignadas, peticiones y avisos."
                    : activeTab === "permissions"
                      ? "Crea los roles del taller y configura qué ve y qué puede modificar cada uno. Solo el administrador tiene acceso a esta pantalla."
                      : activeTab === "settings"
                        ? "Las reglas de fondo del taller: qué se archiva solo cada noche, a quién le avisa el panel del trabajo que avanza sin dejar rastro en el cuaderno y a quién le llegan los avisos del expediente."
                        : activeTab === "archive"
                          ? "El archivo del taller: incidencias cerradas y peticiones ya decididas que ya no están en el día a día. Búscalas aquí o recupera las que vuelvan a hacer falta."
                          : activeTab === "manuals"
                            ? "La documentación de los equipos: los manuales en PDF y las notas del taller, clasificados por tipo, marca y modelo. Descárgalos o consulta los de un equipo desde su ficha."
                            : "Revisa las peticiones de plató, realización y audio, aprueba el material y mantén el catálogo del almacén AV siempre al día."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Resumen semanal: el mismo sitio donde se ajusta, se ve lo que
                  saldría y se manda en el momento. */}
              {canConfigureReport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setWeeklyReportOpen(true)}
                  title="Resumen semanal del taller por correo: qué salió, cuándo y a quién"
                >
                  <Mail className="size-4" />
                  Resumen semanal
                </Button>
              )}
              {/* Atajo a los ajustes de fondo del taller: el archivado
                  automático, el aviso de trabajo sin constancia y los avisos
                  del expediente, que viven juntos en su propia pantalla. */}
              {(can("manageIncidents") ||
                can("decideRequests") ||
                (adminOk && can("viewAudit"))) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => goToTab("settings")}
                  title="Archivado automático, aviso de trabajo sin constancia y avisos del expediente, en un solo sitio"
                >
                  <SlidersHorizontal className="size-4" />
                  Ajustes del taller
                </Button>
              )}
              {/* Datos de ejemplo: se puede pedir otra tanda para probar los
                  listados largos y el archivo sin esperar a tener volumen. */}
              {/* Con el aviso cerrado, quien lo cerró necesita una puerta de
                  vuelta: sin esto solo reaparecería con trabajo parado nuevo. */}
              {seesAlert && staleWork.length > 0 && alertDismissed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={restoreAlert}
                  title="Vuelve a mostrar el aviso de trabajo sin constancia"
                >
                  <Eye className="size-4" />
                  Volver a mostrar el aviso
                </Button>
              )}
              {can("manageInventory") && !isEmpty && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => void handleSeedMore()}
                  disabled={isSeedingMore || loading}
                  title="Añade otra tanda de incidencias y peticiones de ejemplo"
                >
                  <Sparkles className="size-4" />
                  {isSeedingMore ? "Generando..." : "Más datos de ejemplo"}
                </Button>
              )}
            </div>
          </div>

          {/* Aviso para quien esté en la lista de destinatarios: lo que lleva
              días en curso sin dejar constancia. El reparto (qué roles lo ven),
              el margen y el propio aviso viven en `WorkAlertNotice`, que no
              pinta nada si el rol no está en la audiencia. Se puede cerrar: lo
              cerrado se recuerda y el aviso vuelve solo si aparece trabajo
              parado que aún no se había avisado. */}
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

          <section
            aria-label="Resumen"
            className={cn(
              "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
              summaryHidden && "hidden",
            )}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))
              : stats.map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={stat.go}
                    aria-label={`Ver ${stat.label.toLowerCase()}`}
                    title={`Ir a ${stat.label.toLowerCase()}`}
                    className="group flex cursor-pointer flex-col rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:border-signal/40 hover:bg-signal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </span>
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}
                      >
                        <stat.icon className="size-4" />
                      </span>
                    </span>
                    <span className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                      {stat.value}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {stat.hint}
                      <ChevronRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </button>
                ))}
          </section>

          <section className="mt-8">
            {isGuest ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
                  <Search className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  Sigue tu incidencia
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Estás en una sesión de invitado: escribe la referencia que te
                  dieron al notificarla y verás en qué punto va. Es lo único que
                  un invitado puede consultar; la cola del taller, las
                  peticiones y el almacén son para quien entra con su cuenta.
                </p>
                <IncidentLookup className="mx-auto mt-5 max-w-md" />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 gap-2"
                  onClick={() => void handleSwitchAccount()}
                >
                  <LogOut className="size-4" />
                  Entrar con mi cuenta
                </Button>
              </div>
            ) : showEmptyNotice &&
              activeTab !== "profile" &&
              activeTab !== "permissions" &&
              activeTab !== "settings" &&
              activeTab !== "archive" &&
              activeTab !== "audit" ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
                  <Sparkles className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  El taller todavía no tiene datos
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Puedes cargar la muestra de ejemplo para recorrer el flujo
                  completo, o empezar con el taller vacío y dar de alta tus
                  propios repuestos, equipos e incidencias.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {can("manageInventory") && (
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={handleSeed}
                      disabled={isSeeding}
                    >
                      <Sparkles className="size-4" />
                      {isSeeding
                        ? "Cargando datos..."
                        : "Cargar datos de ejemplo"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStartEmpty}
                  >
                    Empezar con el taller vacío
                  </Button>
                </div>
                {!can("manageInventory") && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Los datos de ejemplo los carga quien puede modificar el
                    catálogo de repuestos.
                  </p>
                )}
              </div>
            ) : (
              <Suspense fallback={<ViewSkeleton />}>
                {activeTab === "profile" ? (
                  <ProfileView
                    user={user}
                    incidents={activeIncidents}
                    requests={activeRequests}
                    onOpenIncidents={() => goToTab("incidents")}
                    onOpenRequests={() => goToTab("requests")}
                  />
                ) : loading && activeTab !== "permissions" ? (
                  <div className="grid gap-4">
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                  </div>
                ) : activeTab === "incidents" ? (
                  <IncidentsView
                    key={`incidents-${incidentsViewKey}`}
                    incidents={activeIncidents}
                    equipment={allEquipment}
                    requests={allRequests}
                    currentUserId={user?._id ?? null}
                    currentUserName={displayName}
                    canAssign={can("manageIncidents")}
                    initialDetailId={initialIncidentId}
                  />
                ) : activeTab === "requests" ? (
                  <RequestsView
                    key={`requests-${requestsViewKey}`}
                    requests={activeRequests}
                    parts={allParts}
                    equipment={allEquipment}
                    equipmentFilter={requestsEquipmentFilter}
                    onEquipmentFilterChange={setRequestsEquipmentFilter}
                    canManage={can("decideRequests")}
                    canPurchase={can("managePurchasing") && can("viewPurchasing")}
                    initialDetailId={initialRequestId}
                    initialFilter={requestsInitialFilter}
                  />
                ) : activeTab === "purchasing" && canSeePurchasing ? (
                  <PurchasingView
                    purchaseRequests={purchaseRequests?.requests ?? []}
                    orders={purchaseOrders ?? []}
                    receptions={receptions ?? []}
                    partRequests={allRequests}
                    parts={allParts}
                    canManage={can("managePurchasing")}
                  />
                ) : activeTab === "inventory" && can("viewInventory") ? (
                  <InventoryView
                    key={`inventory-${inventoryViewKey}`}
                    parts={allParts}
                    equipment={allEquipment}
                    canManage={can("manageInventory")}
                    currentUserId={user?._id ?? null}
                    initialSearch={inventoryInitialSearch}
                    initialLowStockOnly={inventoryLowStockOnly}
                  />
                ) : activeTab === "manuals" && can("viewManuals") && !isGuest ? (
                  <ManualsView
                    manuals={allManuals}
                    equipment={allEquipment}
                    canManage={can("manageManuals")}
                    currentUserId={user?._id ?? null}
                  />
                ) : activeTab === "equipment" && can("viewEquipment") ? (
                  <EquipmentView
                    key={`equipment-${equipmentViewKey}`}
                    equipment={allEquipment}
                    parts={allParts}
                    requests={allRequests}
                    maintenance={allMaintenance}
                    manuals={allManuals}
                    canManage={can("manageEquipment")}
                    canWriteManuals={can("viewManuals") && !isGuest}
                    canManageManuals={can("manageManuals")}
                    currentUserId={user?._id ?? null}
                    initialSearch={equipmentInitialSearch}
                    onViewRequests={(equipmentId) => {
                      setRequestsEquipmentFilter(equipmentId);
                      setInitialRequestId(null);
                      setRequestsViewKey((key) => key + 1);
                      setTab("requests");
                    }}
                  />
                ) : activeTab === "archive" ? (
                  <ArchiveView
                    incidents={archivedIncidents}
                    requests={archivedRequests}
                    activeIncidents={activeIncidents}
                    activeRequests={activeRequests}
                    canArchiveIncidents={can("manageIncidents")}
                    canArchiveRequests={can("decideRequests")}
                    trashedIncidents={incidentTrash?.items ?? []}
                    trashedRequests={requestTrash?.items ?? []}
                    trashRetentionDays={
                      incidentTrash?.retentionDays ?? requestTrash?.retentionDays
                    }
                    onOpenSettings={
                      can("manageIncidents") || can("decideRequests")
                        ? () => goToTab("settings")
                        : undefined
                    }
                  />
                ) : activeTab === "settings" ? (
                  <WorkshopSettingsView
                    incidents={activeIncidents}
                    requests={activeRequests}
                    canManageArchive={
                      can("manageIncidents") || can("decideRequests")
                    }
                    canManageAlert={can("manageIncidents")}
                    canManageAudit={adminOk && can("viewAudit")}
                    canPurgeUploads={
                      can("manageIncidents") || can("decideRequests")
                    }
                    canManageData={can("manageInventory")}
                  />
                ) : activeTab === "audit" && adminOk ? (
                  <AuditView onOpenIncident={(id) => openIncident(id)} />
                ) : activeTab === "users" && adminOk ? (
                  <UsersView />
                ) : activeTab === "permissions" && adminOk ? (
                  <PermissionsView />
                ) : null}
              </Suspense>
            )}
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
