# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-SETTINGS-TRASHCARD-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `TrashCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/TrashCard.tsx`
  - `src/pages/dashboard/settings/trash/types.ts`
  - `src/pages/dashboard/settings/trash/useTrashRetention.ts`
  - `src/pages/dashboard/settings/trash/useTrashOperations.ts`
  - `src/pages/dashboard/settings/trash/components/TrashSection.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashRetentionConfig.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashFilterBar.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashIncidentSection.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashRequestSection.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashStorageSection.tsx`
  - `src/pages/dashboard/settings/trash/components/TrashDeleteDialog.tsx`
  - `tests/trashHooks.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/trash/types.ts`: Tipos `DeletingEntity`, `TrashFilter` y `TrashCardProps`.
- [x] `src/pages/dashboard/settings/trash/useTrashRetention.ts`: Hook para configuración y validación de días de retención.
- [x] `src/pages/dashboard/settings/trash/useTrashOperations.ts`: Hook central de queries Convex, mutaciones de restauración/borrado y estado de operaciones.
- [x] `src/pages/dashboard/settings/trash/components/TrashSection.tsx`: Contenedor semántico con scroll acotado.
- [x] `src/pages/dashboard/settings/trash/components/TrashRetentionConfig.tsx`: Interfaz de configuración del plazo.
- [x] `src/pages/dashboard/settings/trash/components/TrashFilterBar.tsx`: Barra de filtrado rápido por categoría.
- [x] `src/pages/dashboard/settings/trash/components/TrashIncidentSection.tsx`: Listado de incidencias retiradas.
- [x] `src/pages/dashboard/settings/trash/components/TrashRequestSection.tsx`: Listado de peticiones retiradas.
- [x] `src/pages/dashboard/settings/trash/components/TrashStorageSection.tsx`: Listado de archivos del almacén.
- [x] `src/pages/dashboard/settings/trash/components/TrashDeleteDialog.tsx`: Diálogo modal accesible para confirmación irreversible.
- [x] `src/pages/dashboard/settings/TrashCard.tsx`: Orquestador limpio reducido de 741 a 142 líneas.
- [x] `tests/trashHooks.test.ts`: Cobertura de pruebas unitarias para validaciones y discriminación de entidades.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 4.94s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1887 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
