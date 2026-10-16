/**
 * Módulo de dominio puro para la bitácora de cambios (Changelog) de Pulso Taller.
 *
 * Invariante de arquitectura: Este módulo NO debe importar React ni Convex.
 * Respeta estrictamente el Vocabulario Ubicuo (GLOSARIO.md).
 */

export type ChangeCategory = "novedad" | "mejora" | "correccion" | "seguridad";

export interface ChangeItem {
  readonly category: ChangeCategory;
  readonly description: string;
  readonly tag?: string;
}

export interface Release {
  readonly version: string;
  readonly date: string; // Formato ISO YYYY-MM-DD
  readonly title: string;
  readonly summary: string;
  readonly highlights?: readonly string[];
  readonly changes: readonly ChangeItem[];
}

export const CHANGELOG_RELEASES: readonly Release[] = [
  {
    version: "1.1.0",
    date: "2026-10-16",
    title: "Alta de equipos desde incidencias e inventario técnico avanzado",
    summary:
      "Mejora integral del flujo de mantenimiento que permite dar de alta equipos directamente al registrar incidencias, gestión de modelos de equipos normalizados y manuales técnicos.",
    highlights: [
      "Alta de nuevo equipo en caliente durante el registro de incidencias",
      "Modelos de equipos estandarizados con número de serie y fabricante",
      "Validación de intake público y privado con protección contra datos huérfanos",
    ],
    changes: [
      {
        category: "novedad",
        description:
          "Posibilidad de registrar un equipo nuevo directamente desde el formulario de reporte de incidencia cuando no está en inventario.",
        tag: "Equipos",
      },
      {
        category: "novedad",
        description:
          "Gestión de modelos de equipos en el backend y selector normalizado en la ficha de inventario.",
        tag: "Equipos",
      },
      {
        category: "mejora",
        description:
          "Autocompletado y validación en la recepción de incidencias públicas y asignación a técnicos.",
        tag: "Incidencias",
      },
      {
        category: "mejora",
        description:
          "Ampliación del visor de manuales y documentación técnica asociada a cada equipo.",
        tag: "Documentación",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-15",
    title: "Lanzamiento oficial de Pulso Taller v1.0",
    summary:
      "Hito de producción con gestión completa de incidencias en tiempo real, catálogo de repuestos, generación de partes de trabajo en PDF, guardrails de arquitectura y seguridad.",
    highlights: [
      "Generación y exportación de partes de trabajo oficiales en PDF",
      "Guardrails de arquitectura limpia y tests de seguridad automáticos",
      "Editor de texto enriquecido para descripciones técnicas y seguimiento",
      "Nueva página de aterrizaje (Landing) y navegación optimizada para taller",
    ],
    changes: [
      {
        category: "novedad",
        description:
          "Exportador de partes de trabajo e informes técnicos en formato PDF con maquetación industrial.",
        tag: "Partes de trabajo",
      },
      {
        category: "novedad",
        description:
          "Editor enriquecido para seguimiento de incidencias, permitiendo notas estructuradas e imágenes de apoyo.",
        tag: "Incidencias",
      },
      {
        category: "seguridad",
        description:
          "Suite de tests de seguridad (AppSec) y guardrails estrictos en AGENTS.md para proteger mutaciones e inmutabilidad de auditoría.",
        tag: "Seguridad",
      },
      {
        category: "mejora",
        description:
          "Implementación del hook responsive useRowsThatFit y componente ListArea para listas fluidas sin salto de diseño.",
        tag: "UI / UX",
      },
      {
        category: "mejora",
        description:
          "Nueva página pública de presentación con resumen de capacidades y acceso profesional para técnicos.",
        tag: "Landing",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-10-14",
    title: "Despliegue automatizado y respaldo en Synology NAS",
    summary:
      "Herramientas de despliegue productivo on-premise en Synology NAS, scripts de diagnóstico, índice de módulos y copias de seguridad automáticas.",
    highlights: [
      "Scripts de instalación desatendida y doctor en Synology NAS",
      "Comprobación de integridad del índice de módulos Convex",
      "Sistema de copias de seguridad de datos y volúmenes de Docker",
    ],
    changes: [
      {
        category: "novedad",
        description:
          "Suite de automatización nasSetup y nasBackup para orquestación en servidor Synology del taller.",
        tag: "Infraestructura",
      },
      {
        category: "mejora",
        description:
          "Solicitud unificada de credenciales en scripts administrativos para evitar redundancia de autenticación.",
        tag: "Scripts",
      },
      {
        category: "mejora",
        description:
          "Dashboard de resumen con métricas clave de estado del taller y disponibilidad de equipos.",
        tag: "Dashboard",
      },
      {
        category: "correccion",
        description:
          "Alineación del índice de módulos de Convex previo al empaquetado para evitar fallos de despliegue.",
        tag: "Convex",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-10-13",
    title: "Informes semanales y refactorización de máquinas de estado",
    summary:
      "Aislamiento de la lógica de negocio en máquinas de estados puras para incidencias y peticiones de repuesto, con soporte de informes semanales.",
    highlights: [
      "Aislamiento estricto de máquinas de estados en src/lib/",
      "Generación de informes semanales consolidados de mantenimiento",
    ],
    changes: [
      {
        category: "novedad",
        description:
          "Módulo de informes semanales para agregación periódica de actividad de mantenimiento y consumos.",
        tag: "Informes",
      },
      {
        category: "mejora",
        description:
          "Refactorización de la máquina de estados de incidencias (incidentFlow.ts) y peticiones de repuesto (requestFlow.ts).",
        tag: "Arquitectura",
      },
      {
        category: "correccion",
        description:
          "Control de transiciones inválidas y consistencia en el ciclo de vida de peticiones de repuesto.",
        tag: "Peticiones",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-11",
    title: "Cimientos del sistema Pulso Taller",
    summary:
      "Estructura inicial del proyecto con Convex, React 19, Tailwind CSS v4, autenticación, control de permisos RBAC y gestión de compras.",
    highlights: [
      "Configuración inicial de entorno local con Docker y Convex",
      "Control de repuestos y órdenes de compra con trazabilidad",
      "Centro de notificaciones interactivo para técnicos y administradores",
    ],
    changes: [
      {
        category: "novedad",
        description:
          "Estructura base del frontend con Vite 7, Tailwind CSS v4 y componentes accesibles Radix UI.",
        tag: "Base",
      },
      {
        category: "novedad",
        description:
          "Catálogo de repuestos con control de existencias, compatibilidad con equipos y alertas de stock bajo.",
        tag: "Repuestos",
      },
      {
        category: "novedad",
        description:
          "Módulo de compras con gestión de órdenes y peticiones de repuesto vinculadas a incidencias.",
        tag: "Compras",
      },
      {
        category: "seguridad",
        description:
          "Autenticación con Convex Auth, roles de usuario (admin, técnico) y auditoría de seguridad.",
        tag: "Seguridad",
      },
    ],
  },
];

/**
 * Devuelve todas las versiones registradas ordenadas de más reciente a más antigua.
 */
export function getAllReleases(): readonly Release[] {
  return CHANGELOG_RELEASES;
}

/**
 * Devuelve la versión más reciente registrada en la bitácora.
 */
export function getLatestRelease(): Release {
  return CHANGELOG_RELEASES[0];
}

/**
 * Busca una entrega por su identificador de versión (ej: "1.0.0" o "v1.0.0").
 */
export function getReleaseByVersion(version: string): Release | undefined {
  const clean = version.trim().replace(/^v/i, "");
  return CHANGELOG_RELEASES.find((r) => r.version === clean);
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) al estándar en español (ej. "16 de octubre de 2026").
 */
export function formatReleaseDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Etiqueta legible para la categoría del cambio.
 */
export function getCategoryLabel(category: ChangeCategory): string {
  switch (category) {
    case "novedad":
      return "Novedad";
    case "mejora":
      return "Mejora";
    case "correccion":
      return "Corrección";
    case "seguridad":
      return "Seguridad";
  }
}
