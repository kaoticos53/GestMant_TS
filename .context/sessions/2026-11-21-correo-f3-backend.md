# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-21
- **Agente / Modelo:** Buffy / Codebuff
- **Rama / Commit:** `feat/correo-f1-base-pura` / commit de F3 backend

---

## 1. Objetivo Principal de la Sesión

Implementar el núcleo de F3 de correo: cabeceras locales, listado y búsqueda,
sincronización inicial/incremental, token por carpeta, borrados, reaparición,
lease, cron y baja de usuario. La vista del módulo «Correo» no entra en este
incremento.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
| --- | --- | --- |
| `src/convex/schema.ts` | Extensión | Tabla `mailHeaders` con índices de listado, identidad, caché y LRU. |
| `src/convex/_mail/soap.ts` | Extracción | Cliente SOAP compartido por cuenta y sincronización; mismo error saneado. |
| `src/convex/mailAccounts.ts` | Refactorización | Reutiliza `_mail/soap`, expone contexto interno con token y borra cabeceras al eliminar/cambiar la cuenta. |
| `src/convex/mailSync.ts` | Nuevo | Sincronización manual y programada, lease, token, tumbas, reaparición y reconciliación. |
| `src/convex/mailHeaders.ts` | Nuevo | Listado paginado, búsqueda local y contadores aislados por usuario. |
| `src/convex/crons.ts` | Extensión | Pasada horaria en el minuto 20. |
| `tests/mailSync.test.ts` | Nuevo | Cobertura de paginación, token, borrados, reaparición, movimiento, aislamiento, baja y lease. |

---

## 3. Decisiones Técnicas y de Diseño

- La identidad local es `accountId + messageId`; la carpeta se actualiza si el
  mensaje se mueve.
- `Search` completo con `dateAsc` es la fuente de metadatos; `Sync` solo aporta
  token y borrados, como fija 0017.
- El token de carpeta se guarda únicamente dentro de la mutación que termina de
  escribir la carpeta; un corte no lo avanza.
- Las ausencias se marcan con `deletedRemoteAt`; una reaparición la limpia. La
  caché no se borra en el acto.
- El lease se toma antes de cualquier petición y se libera en éxito o fallo.
- El cron y la sincronización manual comprueban `users.active` antes de tocar la
  cuenta; una cuenta de baja no se sincroniza.
- `mailHeaders` es índice personal: no se cuenta en `cacheBytes` ni se toca en
  «Vaciar caché».

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Codegen (`npx convex codegen`):** ✅ Exit 0.
- **Tests F3 (`npx vitest run tests/mailSync.test.ts`):** ✅ 7/7.
- **Suite completa (`npx vitest run`):** ✅ 2769 pasando, 69 omitidos.
- **Arquitectura y seguridad:** ✅ 9/9 y 13/13.
- **Lint (`npm run lint`):** ✅ 0 errores; 19 warnings preexistentes.
- **Formato:** Prettier aplicado a los archivos tocados.

---

## 5. Deuda Técnica y Tareas Pendientes

- [ ] Vista del módulo «Correo»: `NavId`, `MODULE_META`, `TAB_ACCESS_POLICY`,
  `DashboardTabRenderer`, lista virtualizada, estados vacíos/error y móvil.
- [ ] Medir la primera sincronización contra el buzón real de Hermes y validar
  los 1 554 mensajes en menos de 30 s con 0 cuerpos.
- [ ] Prueba real de credenciales, token inválido y renovación.
- [ ] Integrar la lista con el visor de F4; no hay cuerpos todavía.
- ⚠️ **Riesgo conocido:** `npm audit` mantiene la vulnerabilidad moderada
  preexistente de `hono`; no se ha tocado.
