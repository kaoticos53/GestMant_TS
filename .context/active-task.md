# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MANUAL-DETAIL-SHEET`
- **Objetivo:** Fase 4 - Validación integral, suite completa de pruebas, verificación de build de producción y cierre de la refactorización de `ManualDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/ManualDetailSheet.tsx`
  - `src/pages/dashboard/manualDetail/`
  - `tests/manualDetailSheetHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Submódulo desacoplado en `src/pages/dashboard/manualDetail/`:
  - `types.ts`: interfaces de props y modelos para cabecera, archivo, notas e historial.
  - `helpers.ts`: funciones puras de resolución de equipo, alcance y exportación de PDF.
  - `ManualDetailHeader.tsx`: cabecera semántica con badges de tipo, marca y modelo.
  - `ManualExportCard.tsx`: tarjeta accesible de exportación de ficha a PDF.
  - `ManualFileCard.tsx`: visor y enlace de descarga de archivo adjunto.
  - `ManualNotesCard.tsx`: renderizado seguro de notas del taller con `RichText`.
  - `ManualHistoryCard.tsx`: línea de tiempo de cambios y versiones anteriores.
  - `index.ts`: barril unificado.
- [x] `tests/manualDetailSheetHelpers.test.ts`: 7 tests unitarios cubriendo alcance de equipo, autor y vinculación.
- [x] `ManualDetailSheet.tsx`: orquestador declarativo reducido de 258 a 67 líneas (-74%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Suite completa de tests? 2.320 tests pasados en 192 suites de Vitest.
- [x] ¿Compilación de producción? Vite build completado con éxito (9.00s).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Tarea completada y cerrada con éxito.
