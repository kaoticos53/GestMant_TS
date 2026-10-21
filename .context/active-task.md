# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `FASE4-FIELD-OPS-PWA-SCANNER`
- **Objetivo:** Dotar a la aplicación de capacidades avanzadas de campo para operarios de planta: escaneo nativo de códigos QR y de barras con la cámara del dispositivo móvil, panel táctil para firma digital de conformidad técnica (*Sign-on-Glass*), y preparación PWA con Service Worker para modo offline de la shell de la aplicación.
- **Módulo(s) Afectado(s):** `src/components/BarcodeScannerModal.tsx`, `src/components/SignaturePad.tsx`, `src/pages/dashboard/GlobalSearch.tsx`, `public/sw.js`, `src/main.tsx`, `tests/barcodeScanner.test.tsx`, `tests/signaturePad.test.tsx`.

---

## 2. Archivos Modificados / Creados
- [x] `src/components/BarcodeScannerModal.tsx`: Visor de cámara con `BarcodeDetector`, linterna y fallback manual.
- [x] `src/components/SignaturePad.tsx`: Canvas interactivo táctil con vectorización y exportación PNG/Blob.
- [x] `src/pages/dashboard/GlobalSearch.tsx`: Botón integrado de escaneo rápido por cámara.
- [x] `public/sw.js`: Service worker con estrategia Cache-First / Stale-While-Revalidate para la shell de la PWA.
- [x] `src/main.tsx`: Registro condicional de Service Worker en entorno de producción.
- [x] `tests/barcodeScanner.test.tsx`: Tests del modal de escaneo y envío manual (2/2 pasados).
- [x] `tests/signaturePad.test.tsx`: Tests del canvas táctil de firma y validación de estado (2/2 pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No, no hay imports prohibidos.
- [x] ¿TypeScript estricto? Verificado con `npx tsc --noEmit` -> 0 errores.
- [x] ¿Seguridad y Arquitectura? Verificado con `tests/arquitectura.test.ts` (9/9) y `tests/seguridad.test.ts` (6/6).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Implementación de `BarcodeScannerModal` con detección y fallback.
- [x] **Paso 2:** Integración en `GlobalSearch.tsx`.
- [x] **Paso 3:** Implementación de `SignaturePad`.
- [x] **Paso 4:** Implementación de Service Worker PWA (`public/sw.js`).
- [x] **Paso 5:** Tests unitarios de campo (`tests/barcodeScanner.test.tsx`, `tests/signaturePad.test.tsx`).
- [x] **Paso 6:** Commit de la Fase 4.
