# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MANUAL-DETAIL-SHEET`
- **Objetivo:** Fase 2 - Creación de subcomponentes desacoplados `ManualDetailHeader`, `ManualExportCard`, `ManualFileCard`, `ManualNotesCard` y `ManualHistoryCard` con barril público.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/manualDetail/ManualDetailHeader.tsx`
  - `src/pages/dashboard/manualDetail/ManualExportCard.tsx`
  - `src/pages/dashboard/manualDetail/ManualFileCard.tsx`
  - `src/pages/dashboard/manualDetail/ManualNotesCard.tsx`
  - `src/pages/dashboard/manualDetail/ManualHistoryCard.tsx`
  - `src/pages/dashboard/manualDetail/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `ManualDetailHeader.tsx`: cabecera semántica con badges de tipo, marca y modelo.
- [x] `ManualExportCard.tsx`: tarjeta accesible de exportación de ficha a PDF.
- [x] `ManualFileCard.tsx`: visor y enlace de descarga de archivo adjunto.
- [x] `ManualNotesCard.tsx`: renderizado seguro de notas del taller con `RichText`.
- [x] `ManualHistoryCard.tsx`: línea de tiempo de cambios y versiones anteriores.
- [x] `manualDetail/index.ts`: barril unificado.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 25 tests pasados (7 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
