# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MAIL-SERVER-SECTIONS`
- **Objetivo:** Fase 2 - Extracción de componentes de presentación `MailPathStatusBanner.tsx` y `MailTestSendSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/mail/components/MailPathStatusBanner.tsx`
  - `src/pages/dashboard/settings/mail/components/MailTestSendSection.tsx`
  - `src/pages/dashboard/settings/MailServerCard.tsx`
  - `tests/mailServerPresentation.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/mail/components/MailPathStatusBanner.tsx`: Banner reactivo con estado del último envío y relevo HTTP.
- [x] `src/pages/dashboard/settings/mail/components/MailTestSendSection.tsx`: Formulario de envío de prueba aislado con estado de carga.
- [x] `src/pages/dashboard/settings/MailServerCard.tsx`: Integración de los componentes de presentación.
- [x] `tests/mailServerPresentation.test.tsx`: Pruebas de renderizado de banners y envío de prueba.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `MailPathStatusBanner.tsx`.
- [x] **Paso 2:** Crear `MailTestSendSection.tsx`.
- [x] **Paso 3:** Integrar en `MailServerCard.tsx`.
- [x] **Paso 4:** Crear test unitario `tests/mailServerPresentation.test.tsx`.
- [x] **Paso 5:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 6:** Commit atómico de la Fase 2.
