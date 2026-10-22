# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PERMISSIONS-VIEW`
- **Objetivo:** Fase 1 - Extracción de tipos y hooks de dominio (`usePermissionsMatrix`, `useRoleManagement`) y pruebas unitarias puras (`tests/permissionsMatrixHook.test.ts`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/permissions/types.ts`
  - `src/pages/dashboard/permissions/hooks/usePermissionsMatrix.ts`
  - `src/pages/dashboard/permissions/hooks/useRoleManagement.ts`
  - `tests/permissionsMatrixHook.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/permissions/types.ts`: Tipos base (`RoleInfo`, `DialogState`, etc.).
- [x] `src/pages/dashboard/permissions/hooks/usePermissionsMatrix.ts`: Hook de control de borrador, guardado concurrente y dirtiness.
- [x] `src/pages/dashboard/permissions/hooks/useRoleManagement.ts`: Hook para gestión de modales y borrado accesible de roles.
- [x] `tests/permissionsMatrixHook.test.ts`: Pruebas unitarias de draft, guardado y cálculo de cambios (6 tests).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `src/pages/dashboard/permissions/types.ts`.
- [x] **Paso 2:** Implementar `src/pages/dashboard/permissions/hooks/usePermissionsMatrix.ts`.
- [x] **Paso 3:** Implementar `src/pages/dashboard/permissions/hooks/useRoleManagement.ts`.
- [x] **Paso 4:** Crear `tests/permissionsMatrixHook.test.ts`.
- [x] **Paso 5:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 6:** Ejecutar tests unitarios con `npx vitest run tests/permissionsMatrixHook.test.ts`.
- [x] **Paso 7:** Commit atómico de Fase 1.
