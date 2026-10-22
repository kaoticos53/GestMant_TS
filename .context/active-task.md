# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-REQUEST-DETAIL-SHEET`
- **Objetivo:** Fase 2 - Creación de subcomponentes desacoplados `RequestStatusBanners`, `RequestNotesSection`, `RequestJourneyCard` y barril público.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/RequestStatusBanners.tsx`
  - `src/pages/dashboard/requests/components/detail/RequestNotesSection.tsx`
  - `src/pages/dashboard/requests/components/detail/RequestJourneyCard.tsx`
  - `src/pages/dashboard/requests/components/detail/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `RequestStatusBanners.tsx`: avisos de lectura para peticiones retiradas a la papelera o archivadas.
- [x] `RequestNotesSection.tsx`: tarjetas con `RichText` para descripción ("Qué pide") y nota del solicitante.
- [x] `RequestJourneyCard.tsx`: envoltorio limpio para el recorrido `JourneySummary`.
- [x] `detail/index.ts`: barril unificado de componentes y utilidades del detalle de peticiones.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de integración? 50 tests pasados (14 helpers + 9 actions + 9 card + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
