# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MANUAL-FORM-DIALOG`
- **Objetivo:** Fase 2 - Modularizar subcomponentes visuales en `src/pages/dashboard/manuals/form/components/` (`ManualKindSelector`, `ManualClassificationFields`, `ManualFileUploadField`, `ManualNotesField`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manuals/form/components/ManualKindSelector.tsx`
  - `src/pages/dashboard/manuals/form/components/ManualClassificationFields.tsx`
  - `src/pages/dashboard/manuals/form/components/ManualFileUploadField.tsx`
  - `src/pages/dashboard/manuals/form/components/ManualNotesField.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/manuals/form/components/ManualKindSelector.tsx`: Selector de botones para Archivo vs. Nota de taller.
- [x] `src/pages/dashboard/manuals/form/components/ManualClassificationFields.tsx`: Título, Tipo, Selector de Equipo asignado, Marca y Modelo con datalist.
- [x] `src/pages/dashboard/manuals/form/components/ManualFileUploadField.tsx`: Input de archivo PDF, límites de peso, feedback del archivo seleccionado con botón de deseleccionar.
- [x] `src/pages/dashboard/manuals/form/components/ManualNotesField.tsx`: RichTextEditor para notas técnicas de taller.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios? 32 tests pasando al 100% (helpers, arquitectura, seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Fase 2 completada. Listo para commit atómico.





