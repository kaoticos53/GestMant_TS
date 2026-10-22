# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-REPORT-INCIDENT`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales en src/pages/reportIncident/components/.
- **Módulo(s) Afectado(s):**
  - `src/pages/reportIncident/components/ReportIncidentHeader.tsx`
  - `src/pages/reportIncident/components/ReportIncidentSuccessCard.tsx`
  - `src/pages/reportIncident/components/ReporterFields.tsx`
  - `src/pages/reportIncident/components/EquipmentFields.tsx`
  - `src/pages/reportIncident/components/DescriptionField.tsx`
  - `src/pages/reportIncident/components/ReportIncidentForm.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes de cabecera y éxito (`ReportIncidentHeader.tsx`, `ReportIncidentSuccessCard.tsx`).
- [x] Subcomponentes de campos modulares (`ReporterFields.tsx`, `EquipmentFields.tsx`, `DescriptionField.tsx`).
- [x] Formulario contenedor (`ReportIncidentForm.tsx`).
- [x] Custom hook de estado (`useReportIncidentState.ts`).
- [x] Orquestador declarativo (`ReportIncident.tsx`, 407 -> 57 líneas, -86.0%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.101 tests pasados al 100% en Vitest (171 suites).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [x] ¿Build de producción Vite? Verificado (dist generado en 4.97s).

---

## 4. Estado Actual
- **Estado:** Fase 4 completada. Componente `ReportIncident.tsx` modularizado (407 -> 57 líneas, -86.0%) con 100% tests verdes y build limpio.























