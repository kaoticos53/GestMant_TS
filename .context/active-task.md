# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-BARCODE-SCANNER`
- **Objetivo:** Fase 2 - Desacoplamiento de visor, retícula industrial y entrada manual en subcomponentes modulares.
- **Módulo(s) Afectado(s):**
  - `src/components/barcode/ScannerViewport.tsx`
  - `src/components/barcode/ScannerCameraUnavailable.tsx`
  - `src/components/barcode/ScannerManualFallback.tsx`
  - `src/components/barcode/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `ScannerViewport.tsx`: visor de video, retícula industrial con línea láser animada y botón de linterna.
- [x] `ScannerCameraUnavailable.tsx`: pantalla informativa cuando no hay sensor de cámara o se denegaron permisos.
- [x] `ScannerManualFallback.tsx`: formulario accesible de respaldo para entrada manual o pistola lectora USB.
- [x] `barcode/index.ts`: barril unificado del módulo barcode.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 28 tests pasados (10 unitarios + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.






















