# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INCIDENT-DETAIL-SHEET`
- **Objetivo:** Fase 2 - Desacoplamiento de banners de ciclo de vida, historial de estados y modales de equipo en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentStatusBanners.tsx`
  - `src/pages/dashboard/incidents/components/detail/IncidentHistoryCard.tsx`
  - `src/pages/dashboard/incidents/components/detail/IncidentEquipmentModals.tsx`
  - `src/pages/dashboard/incidents/components/detail/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `IncidentStatusBanners.tsx`: avisos contextuales de retirada a la papelera y archivo.
- [x] `IncidentHistoryCard.tsx`: línea de tiempo de cambios de estado y anotaciones rich text.
- [x] `IncidentEquipmentModals.tsx`: encapsulación de modales subordinados de corrección y alta de equipo con mutación y toasts.
- [x] `detail/index.ts`: barril unificado de exportaciones del detalle.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 36 tests pasados (18 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.






