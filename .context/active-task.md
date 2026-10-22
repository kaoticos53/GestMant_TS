# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MANUAL-DETAIL-SHEET`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `ManualDetailSheet.tsx` usando los submódulos de manualDetail.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualDetailSheet.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `ManualDetailSheet.tsx`: simplificado de 258 a 67 líneas (-74%), orquestando de forma declarativa `ManualDetailHeader`, `ManualExportCard`, `ManualFileCard`, `ManualNotesCard` y `ManualHistoryCard`.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 46 tests pasados (7 helpers + 13 record + 8 state + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
