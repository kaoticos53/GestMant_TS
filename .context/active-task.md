# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-LANDING`
- **Objetivo:** Fase 3 - Reensamblado de `Landing.tsx` como orquestador limpio y desacoplado.
- **Módulo(s) Afectado(s):**
  - `src/pages/Landing.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `Landing.tsx`: Orquestador principal refactorizado, reducido de 600 a 26 líneas (~95% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reensamblar `Landing.tsx`.
- [x] **Paso 2:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 3:** Ejecutar pruebas de ritmo con `tests/landingRitmo.test.tsx` (17 tests verdes).
- [x] **Paso 4:** Commit atómico de Fase 3.
