# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-DASHBOARD-SIDEBAR`
- **Objetivo:** Fase 2 - Desacoplamiento de cabecera, navegación, pie y manejador de redimensionamiento de `DashboardSidebar.tsx` en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/components/sidebar/SidebarHeader.tsx`
  - `src/pages/dashboard/components/sidebar/SidebarNavList.tsx`
  - `src/pages/dashboard/components/sidebar/SidebarFooter.tsx`
  - `src/pages/dashboard/components/sidebar/SidebarResizeHandle.tsx`
  - `src/pages/dashboard/components/sidebar/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `SidebarHeader.tsx`: logo, marca del taller, campana de notificaciones y centro de mensajes.
- [x] `SidebarNavList.tsx`: lista accesible de navegación con distintivos e insignias, y acceso a incidencias para invitados.
- [x] `SidebarFooter.tsx`: tarjeta de perfil, botón de plegado accesible, badge de rol, botón de salir y changelog modal.
- [x] `SidebarResizeHandle.tsx`: separador accesible con agarre táctil y foco por teclado.
- [x] `sidebar/index.ts`: barril unificado del módulo sidebar.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 37 tests pasados (4 unitarios + 15 del sidebar + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.


















