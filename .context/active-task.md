# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-MAIL-SERVER-VALIDATION-HANDOVER`
- **Objetivo:** Fase 4 - Validación integral, suite completa de tests de Vitest, compilación de producción y cierre de handover para la refactorización de `MailServerCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/MailServerCard.tsx`
  - `src/pages/dashboard/settings/mail/*`
  - `tests/mailServer*.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/mail/types.ts`: Tipos del formulario de correo, check de salud y DTOs.
- [x] `src/pages/dashboard/settings/mail/hooks/useMailServerForm.ts`: Estado unificado del formulario, validación reactiva y mutación de guardado.
- [x] `src/pages/dashboard/settings/mail/hooks/useMailPathCheck.ts`: Comprobación automática y manual del relevo HTTP/SMTP.
- [x] `src/pages/dashboard/settings/mail/components/MailPathStatusBanner.tsx`: Banner reactivo con estado del último envío y relevo HTTP.
- [x] `src/pages/dashboard/settings/mail/components/MailTestSendSection.tsx`: Formulario de envío de prueba aislado con estado de carga.
- [x] `src/pages/dashboard/settings/mail/components/MailProviderSettingsFields.tsx`: Configuración reactiva de credenciales y selector de proveedor.
- [x] `src/pages/dashboard/settings/mail/components/MailRelayCheckSection.tsx`: Sección de comprobación HTTP del relevo.
- [x] `src/pages/dashboard/settings/mail/components/MailLogViewer.tsx`: Visor de histórico de envíos con badges y scroll.
- [x] `src/pages/dashboard/settings/MailServerCard.tsx`: Orquestación ultradelgada (<190 líneas, reducido de 891 líneas).
- [x] `tests/mailServerForm.test.tsx`: Pruebas de hook de formulario.
- [x] `tests/mailServerPresentation.test.tsx`: Pruebas de banner y envío de prueba.
- [x] `tests/mailServerFields.test.tsx`: Pruebas de campos, check y logs.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas al 100%.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Fase 1 completada y comiteada (`5411475`).
- [x] **Paso 2:** Fase 2 completada y comiteada (`8a59be7`).
- [x] **Paso 3:** Fase 3 completada y comiteada (`8dee85c`).
- [x] **Paso 4:** Verificación de tipos `npx tsc --noEmit` (0 errores).
- [x] **Paso 5:** Suite completa de Vitest `npx vitest run` (140 archivos pasados, 1.859 tests pasados).
- [x] **Paso 6:** Compilación de producción `npm run build` (código 0).
- [x] **Paso 7:** Handover y registro de sesión.
