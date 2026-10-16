# Bitácora de Cambios (Changelog) — Pulso Taller

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.0] - 2026-10-16

### Novedades

- **Equipos:** Posibilidad de registrar un equipo nuevo directamente desde el formulario de reporte de incidencias cuando no existe en el catálogo.
- **Equipos:** Gestión normalizada de modelos de equipos en el backend y selector asistido en la ficha de inventario.

### Mejoras

- **Incidencias:** Autocompletado inteligente y validación estricta en el intake público/privado de incidencias.
- **Documentación:** Ampliación del soporte y visualización de manuales técnicos asociados a equipos.

---

## [1.0.0] - 2026-10-15

### Novedades

- **Partes de trabajo:** Generación y exportación de partes de trabajo oficiales e informes técnicos en formato PDF con maquetación industrial.
- **Incidencias:** Editor de texto enriquecido (TipTap) para el seguimiento de incidencias, notas de intervención y documentación fotográfica.
- **Landing:** Página de presentación pública con acceso directo al reporte de incidencias y acceso profesional para técnicos.

### Mejoras

- **UI / UX:** Implementación del hook `useRowsThatFit` y el componente `ListArea` para renderizado dinámico de filas sin desbordamiento.
- **Trazabilidad:** Máquinas de estado puras en `src/lib/` para incidencias, peticiones de repuesto y compras.

### Seguridad

- **AppSec:** Suite de tests de seguridad en `tests/seguridad.test.ts` y guardrails estrictos de gobernanza en `AGENTS.md` para proteger mutaciones e inmutabilidad de `securityAuditLog`.

---

## [0.3.0] - 2026-10-14

### Novedades

- **Infraestructura:** Scripts de instalación desatendida (`nas-setup.mjs`) y copias de seguridad automáticas (`nas-backup.mjs`) para Synology NAS.
- **Dashboard:** Panel de métricas con indicadores clave de disponibilidad del taller.

### Mejoras

- **Scripts:** Solicitud interactiva de contraseña centralizada para agilizar operaciones de administración.

### Correcciones

- **Convex:** Validación preventiva del índice de módulos de Convex previo al empaquetado para despliegue.

---

## [0.2.0] - 2026-10-13

### Novedades

- **Informes:** Módulo de informes semanales de mantenimiento con agregación de incidencias, peticiones y horas dedicadas.

### Mejoras

- **Arquitectura:** Refactorización de las máquinas de estado finitas de incidencias (`incidentFlow.ts`) y peticiones de repuesto (`requestFlow.ts`).

### Correcciones

- **Peticiones de repuesto:** Bloqueo de transiciones huérfanas y corrección de cancelaciones de material.

---

## [0.1.0] - 2026-10-11

### Novedades

- **Base:** Estructura inicial de la aplicación con React 19, Vite 7, Tailwind CSS v4 y componentes accesibles Radix UI.
- **Repuestos:** Catálogo de repuestos con control de stock, ubicaciones en almacén y compatibilidad con equipos.
- **Compras:** Flujo de órdenes de compra y peticiones de repuesto asociadas a incidencias de taller.

### Seguridad

- **Autenticación:** Integración con Convex Auth, control de acceso basado en roles (admin, técnico) y registro de auditoría.
