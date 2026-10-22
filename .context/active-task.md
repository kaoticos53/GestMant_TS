# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MANUAL-DETAIL-SHEET`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers deterministas de presentación y exportación PDF y pruebas unitarias para `ManualDetailSheet`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manualDetail/types.ts`
  - `src/pages/dashboard/manualDetail/helpers.ts`
  - `tests/manualDetailSheetHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `manualDetail/types.ts`: interfaces de props y modelos para cabecera, visor de archivo, notas y timeline.
- [x] `manualDetail/helpers.ts`: funciones puras `findLinkedEquipment`, `getManualScopeDescription`, `getManualSubtitle` y `exportManualPdf`.
- [x] `tests/manualDetailSheetHelpers.test.ts`: 7 tests unitarios cubriendo alcance de equipo, autor y vinculación.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 25 tests pasados (7 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
