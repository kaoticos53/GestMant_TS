# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-21
- **Agente / Modelo:** Buffy / Codebuff
- **Rama / Commit:** `feat/correo-f1-base-pura` / commit de F3 vista

---

## 1. Objetivo Principal de la Sesión

Completar F3 de correo con la vista del módulo «Correo»: `NavId`, metadatos,
política de acceso, renderer, lista virtualizada y estados vacíos/error,
manteniendo el backend de sincronización sin cambios. El visor de cuerpo sigue
reservado a F4.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
| --- | --- | --- |
| `src/pages/dashboard/types.ts` | Extensión | `mailbox` entra en `NavId`. |
| `src/pages/dashboard/constants/navConfig.ts` | Extensión | Metadatos, entrada «Correo», badge, ocultación del resumen y acceso por `viewMailbox` sin invitado. |
| `src/pages/dashboard/components/content/router/helpers.ts` | Extensión | Regla `mailbox`: capacidad `viewMailbox`, `staffOnly`. |
| `src/pages/dashboard/components/content/router/lazyViews.ts` | Extensión | Carga diferida de `MailboxView` y precarga de la pestaña. |
| `src/pages/dashboard/components/content/router/DashboardTabRenderer.tsx` | Extensión | Despacha `MailboxView` y permite abrir Ajustes. |
| `src/pages/dashboard/components/content/helpers.ts` | Extensión | «Correo» queda exento del aviso de taller vacío. |
| `src/pages/dashboard/hooks/useDashboardNavigation.ts` | Extensión | `viewKeys.mailbox` para remontar la vista al volver a la pestaña. |
| `src/pages/dashboard/MailboxView.tsx` | Nuevo | Composición de carpetas, búsqueda, sincronización, estados, paginación por offset y modo móvil de un panel. |
| `src/pages/dashboard/mailbox/MessageList.tsx` | Nuevo | Lista de cabeceras con `ListArea` y `useVirtualRows`; estados vacío y carga; reinicio del scroll por página. |
| `src/pages/dashboard/mailbox/helpers.ts` | Nuevo | Fecha compacta, remitente, no leído, contadores y tamaño de página. |
| `src/pages/dashboard/mailbox/types.ts` | Nuevo | Tipos derivados de las consultas existentes. |
| `tests/mailboxView.test.tsx` | Nuevo | Cuenta ausente, carpetas/cabeceras, carpeta vacía, reautenticación y límites de paginación. |
| `tests/mailHeaders.test.ts` | Nuevo | Offset fuera de rango, última página parcial y total filtrado por búsqueda. |
| `tests/navConfig.test.ts` | Extensión | Metadatos, navegación, badge y resumen de «Correo». |
| `tests/dashboardTabRouterRules.test.ts` | Extensión | Acceso a `mailbox` solo con `viewMailbox` y sesión no invitada. |

---

## 3. Decisiones Técnicas y de Diseño

- Se reutilizan las consultas existentes `api.mailAccounts.account`,
  `api.mailAccounts.folders`, `api.mailHeaders.list` y la acción
  `api.mailSync.syncNow`; no se ha tocado el backend.
- La carpeta activa se deriva de la primera carpeta o de la selección, sin un
  efecto que copie estado. Al cambiar de carpeta se limpia la búsqueda.
- La lista usa la caja de `ListArea` como elemento de scroll de
  `useVirtualRows`; por debajo de 40 filas se pintan todas.
- La consulta pagina de 100 en 100 con `limit` y `offset` sobre
  `mailHeaders.list`; el pie compartido `TablePagination` permite recorrer el
  total real del buzón. La página se reinicia en el mismo render al cambiar de
  carpeta o de búsqueda, y el área vuelve arriba al cambiar de página.
- Si el total encoge y la página deja de existir, se corrige en el render y se
  vuelve a pedir el offset válido; mientras tanto se muestra el esqueleto, no
  un vacío falso.
- No hay visor de cuerpo ni descarga: la fila solo muestra asunto, remitente,
  fecha, fragmento y marca de adjuntos.
- En móvil se alterna entre carpetas y mensajes con un botón de vuelta; en
  escritorio conviven los dos paneles.
- Los estados cubiertos son: cuenta cargando, cuenta sin configurar, carpetas
  cargando/sin carpetas, lista cargando, carpeta vacía, búsqueda sin resultados,
  `reauthRequired`, error de conexión, buzón desconectado y sincronización
  automática desactivada. Los errores de la acción se muestran con toast.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Tests de F3 y navegación:** ✅ 34/34 (`mailSync`, `mailHeaders`,
  `mailboxView` con paginación y corrección de total, `navConfig`,
  `dashboardTabRouterRules`).
- **Arquitectura y seguridad:** ✅ 22/22 (`arquitectura`, `seguridad`).
- **Lint (`npx eslint .`):** ✅ 0 errores; 19 warnings preexistentes.
- **Suite completa (`npx vitest run`):** 2778 pasando, 69 omitidos y 1 fallo
  ajeno por timeout en `tests/humanChallenge.test.ts` bajo carga; ese archivo
  pasa en aislamiento (5/5, 104 ms).
- **Build de producción (`npx vite build`):** ✅ Exit 0; `MailboxView` sale en
  su trozo diferido.
- **Revisión visual:** no realizada; no se ha abierto el panel con una cuenta
  real ni se ha probado contra Hermes.

---

## 5. Deuda Técnica y Tareas Pendientes

- [ ] Medir la primera sincronización contra el buzón real de Hermes y validar
  los 1 554 mensajes en menos de 30 s con 0 cuerpos.
- [ ] Prueba real de credenciales, token inválido y renovación.
- [ ] Integrar la lista con el visor de F4; no hay cuerpos todavía.
- [x] Paginación por offset sobre `mailHeaders.list`, con 100 cabeceras por
  página, reinicio al cambiar carpeta o búsqueda y corrección si el total
  encoge.
- ⚠️ **Riesgo conocido:** `npm audit` mantiene la vulnerabilidad moderada
  preexistente de `hono`; no se ha tocado.
