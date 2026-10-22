# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-EQUIPMENT-VIEW-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `EquipmentView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/EquipmentView.tsx`
  - `src/pages/dashboard/equipment/hooks/useEquipmentListState.ts`
  - `src/pages/dashboard/equipment/hooks/useEquipmentDialogs.ts`
  - `src/pages/dashboard/equipment/components/EquipmentTableRow.tsx`
  - `src/pages/dashboard/equipment/components/EquipmentEmptyState.tsx`
  - `src/pages/dashboard/equipment/components/DeleteEquipmentDialog.tsx`
  - `tests/equipmentListState.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/equipment/hooks/useEquipmentListState.ts`: Hook desacoplado para filtrado en memoria, paginación, ordenación y selección por fila/celda.
- [x] `src/pages/dashboard/equipment/hooks/useEquipmentDialogs.ts`: Hook desacoplado para gestión de apertura y estado de todos los diálogos/sheets del catálogo.
- [x] `tests/equipmentListState.test.ts`: Pruebas unitarias de filtrado por texto, estado, modelo, fechas de garantía e incidencias pendientes (9 tests).
- [x] `src/pages/dashboard/equipment/components/EquipmentTableRow.tsx`: Fila de tabla encapsulada con visualización de estado, badges condicionales y menú contextual de acciones.
- [x] `src/pages/dashboard/equipment/components/EquipmentEmptyState.tsx`: Estado vacío reusable con CTA para registro de primer equipo o limpieza de filtros.
- [x] `src/pages/dashboard/equipment/components/DeleteEquipmentDialog.tsx`: Diálogo accesible Radix/AlertDialog para confirmación de borrado con comprobación de permisos.
- [x] `src/pages/dashboard/EquipmentView.tsx`: Vista orquestadora limpia, reducida de 582 a 310 líneas (~47% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 5.10s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1910 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
