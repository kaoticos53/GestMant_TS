# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-REQUEST-DETAIL-SHEET`
- **Objetivo:** Fase 4 - Validación integral, suite completa de pruebas, verificación de build de producción y cierre de la refactorización de `RequestDetailSheet.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/RequestDetailSheet.tsx`
  - `src/pages/dashboard/requests/components/detail/`
  - `tests/requestDetailSheetHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Submódulo desacoplado en `src/pages/dashboard/requests/components/detail/`:
  - `types.ts`: interfaces de props para banners, notas y recorrido.
  - `helpers.ts`: funciones puras de resolución de permisos de gestión y cálculo de etiquetas/avisos del recorrido.
  - `RequestStatusBanners.tsx`: avisos de lectura para peticiones retiradas a papelera o archivadas.
  - `RequestNotesSection.tsx`: tarjetas con `RichText` para descripción ("Qué pide") y nota del solicitante.
  - `RequestJourneyCard.tsx`: envoltorio limpio para `JourneySummary`.
  - `index.ts`: barril unificado.
- [x] `tests/requestDetailSheetHelpers.test.ts`: 14 tests unitarios cubriendo recorrido, permisos y avisos.
- [x] `RequestDetailSheet.tsx`: orquestador declarativo reducido de 252 a 198 líneas con composición limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Suite completa de tests? 2.349 tests pasados en 195 suites de Vitest.
- [x] ¿Compilación de producción? Vite build completado con éxito (5.18s).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Tarea completada y cerrada con éxito.
