# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-PROFILE-VIEW`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `ProfileView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ProfileView.tsx`
  - Subcomponentes, helpers, hooks y tipos en `src/pages/dashboard/profile/`
  - Pruebas en `tests/profileHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/profile/types.ts`: Contratos de props y modelos de métricas y chips de contacto.
- [x] `src/pages/dashboard/profile/helpers.ts`: Funciones puras de filtrado de incidencias del técnico, peticiones y cálculo de métricas.
- [x] `tests/profileHelpers.test.ts`: Pruebas unitarias para la lógica de dominio del perfil de usuario (11 tests al 100%).
- [x] `src/pages/dashboard/profile/hooks/useProfileData.ts`: Custom hook que centraliza queries de Convex y derivación de datos.
- [x] `src/pages/dashboard/profile/components/ProfileSkeleton.tsx`: Estado de carga animado.
- [x] `src/pages/dashboard/profile/components/ProfileHeaderCard.tsx`: Ficha personal con avatar, rol, badges y chips de contacto.
- [x] `src/pages/dashboard/profile/components/ProfileStatsGrid.tsx`: Cuadrícula con 4 tarjetas de métricas cuantitativas.
- [x] `src/pages/dashboard/profile/components/ProfileIncidentsCard.tsx`: Sección y listado de mis incidencias recientes.
- [x] `src/pages/dashboard/profile/components/ProfileRequestsCard.tsx`: Sección y listado de mis peticiones de repuesto creadas.
- [x] `src/pages/dashboard/profile/components/ProfileNotificationsCard.tsx`: Sección de avisos recientes con estado de lectura.
- [x] `src/pages/dashboard/profile/dialogs/EditProfileDialog.tsx`: Diálogo modal de edición de datos personales con catálogos.
- [x] `src/pages/dashboard/ProfileView.tsx`: Orquestador principal refactorizado, reducido de 541 a 67 líneas (~87% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? 11 tests en verde (`tests/profileHelpers.test.ts`).
- [x] ¿Suite completa? 157 suites y 1.973 tests pasando al 100% en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
