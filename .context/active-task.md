# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-BARCODE-SCANNER`
- **Objetivo:** Fase 3 - Extracción del hook `useBarcodeScannerStream` y reensamblado declarativo de `BarcodeScannerModal.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/barcode/useBarcodeScannerStream.ts`
  - `src/components/barcode/index.ts`
  - `src/components/BarcodeScannerModal.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `useBarcodeScannerStream.ts`: hook de ciclo de vida del stream de cámara, linterna (`torch`), escaneo continuo con BarcodeDetector y vibración háptica.
- [x] `barcode/index.ts`: exportación pública del hook.
- [x] `BarcodeScannerModal.tsx`: modal orquestadora simplificada de 285 a 85 líneas (-70%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 28 tests pasados (10 barcode + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.
