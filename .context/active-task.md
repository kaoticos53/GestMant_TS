# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-REQUEST-CARD`
- **Objetivo:** Fase 2 - Desacoplamiento de cabecera, cuerpo, líneas, adjuntos y pie de `RequestCard.tsx` en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/card/RequestCardHeader.tsx`
  - `src/pages/dashboard/requests/components/card/RequestCardBody.tsx`
  - `src/pages/dashboard/requests/components/card/RequestCardLines.tsx`
  - `src/pages/dashboard/requests/components/card/RequestCardAttachments.tsx`
  - `src/pages/dashboard/requests/components/card/RequestCardFooter.tsx`
  - `src/pages/dashboard/requests/components/card/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `RequestCardHeader.tsx`: distintivos de prioridad, estado, aviso de sin repuesto y fecha relativa.
- [x] `RequestCardBody.tsx`: solicitante, equipo de trabajo y afectado, descripción rica y texto de decisión.
- [x] `RequestCardLines.tsx`: píldoras de líneas de repuestos y banner condicional de advertencia.
- [x] `RequestCardAttachments.tsx`: contadores de adjuntos, fotos y documentos.
- [x] `RequestCardFooter.tsx`: resumen de piezas/unidades y acciones según ciclo de vida.
- [x] `card/index.ts`: barril unificado del módulo card.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 27 tests pasados (9 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.










