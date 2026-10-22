# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-REQUEST-CARD`
- **Objetivo:** Fase 3 - Reensamblado declarativo de `RequestCard.tsx` y limpieza de comentarios obsoletos.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/RequestCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `RequestCard.tsx` refactorizado de 297 a 96 líneas (-67.7% de reducción).
- [x] Arquitectura declarativa delegando en `RequestCardHeader`, `RequestCardBody`, `RequestCardLines`, `RequestCardAttachments` y `RequestCardFooter`.
- [x] Eliminados comentarios residuales de diálogos extraídos en sesiones previas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 37 tests pasados (9 unitarios + 10 integración + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.











