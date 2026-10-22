# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-EQUIPMENT-DETAIL-SHEET-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `EquipmentDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/equipment/components/EquipmentDetailSheet.tsx`
  - `src/pages/dashboard/equipment/hooks/useEquipmentDerivedData.ts`
  - `src/pages/dashboard/equipment/hooks/useEquipmentPdfExport.ts`
  - `src/pages/dashboard/equipment/components/detail/EquipmentSheetHeader.tsx`
  - `src/pages/dashboard/equipment/components/detail/EquipmentDataSection.tsx`
  - `src/pages/dashboard/equipment/components/detail/EquipmentMaintenanceSection.tsx`
  - `src/pages/dashboard/equipment/components/detail/EquipmentManualsSection.tsx`
  - `src/pages/dashboard/equipment/components/detail/EquipmentPartsSection.tsx`
  - `src/pages/dashboard/equipment/components/detail/EquipmentRequestsSection.tsx`
  - `src/pages/dashboard/equipment/components/detail/DeleteInterventionDialog.tsx`
  - `tests/equipmentDerivedData.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/equipment/hooks/useEquipmentDerivedData.ts`: Memoización de peticiones, modelos, compatibilidad y revisiones.
- [x] `src/pages/dashboard/equipment/hooks/useEquipmentPdfExport.ts`: Abstracción de exportación a PDF y descarga de ficha técnica.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentSheetHeader.tsx`: Cabecera con badges de estado, garantía y revisión.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentDataSection.tsx`: Descripción enriquecida y datos técnicos en lista `<dl>`.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentMaintenanceSection.tsx`: Historial de intervenciones y plan preventivo.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentManualsSection.tsx`: Manuales asignados y de modelo vinculados.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentPartsSection.tsx`: Lista de repuestos compatibles con stock y alertas.
- [x] `src/pages/dashboard/equipment/components/detail/EquipmentRequestsSection.tsx`: Peticiones asociadas y navegación cruzada.
- [x] `src/pages/dashboard/equipment/components/detail/DeleteInterventionDialog.tsx`: Modal accesible para confirmación de borrado.
- [x] `src/pages/dashboard/equipment/components/EquipmentDetailSheet.tsx`: Orquestador reducido de 646 a 142 líneas.
- [x] `tests/equipmentDerivedData.test.ts`: Cobertura de pruebas unitarias para datos derivados.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 4.93s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1901 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
