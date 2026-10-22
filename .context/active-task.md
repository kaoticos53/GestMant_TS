# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-CATALOGS-CARD`
- **Objetivo:** Fase 2 - Extraer y modularizar los 4 diálogos modales en `src/pages/dashboard/settings/catalogs/dialogs/` (`AddCatalogItemDialog`, `EditCatalogItemDialog`, `MergeCatalogItemDialog`, `DeleteCatalogItemDialog`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/catalogs/dialogs/AddCatalogItemDialog.tsx`
  - `src/pages/dashboard/settings/catalogs/dialogs/EditCatalogItemDialog.tsx`
  - `src/pages/dashboard/settings/catalogs/dialogs/MergeCatalogItemDialog.tsx`
  - `src/pages/dashboard/settings/catalogs/dialogs/DeleteCatalogItemDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/catalogs/dialogs/AddCatalogItemDialog.tsx`: Diálogo modal para añadir nueva opción canónica.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/EditCatalogItemDialog.tsx`: Diálogo modal para editar nombre canónico existente.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/MergeCatalogItemDialog.tsx`: Diálogo modal para fusionar duplicados.
- [x] `src/pages/dashboard/settings/catalogs/dialogs/DeleteCatalogItemDialog.tsx`: Diálogo modal de confirmación de eliminación.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 26 tests pasando al 100% (helpers, arquitectura, seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 2 completada. Listo para commit atómico.












