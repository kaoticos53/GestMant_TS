# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-21
- **Agente / Modelo:** Buffy / Codebuff
- **Rama / Commit:** `feat/correo-f1-base-pura` / commit de F4

---

## 1. Objetivo Principal de la Sesión

Cerrar F4 de correo: descargar el cuerpo bajo demanda, verificar sus bytes,
parsear MIME, guardar una sola copia, renderizar HTML saneado, descargar adjuntos
y mantener la caché con LRU, caducidad y vaciado. El visor se integra en el
módulo «Correo» sin tocar el estado remoto del mensaje.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
| --- | --- | --- |
| `src/lib/mailClient/mime.ts` | Nuevo | Parseo de RFC822 con `postal-mime`, extracción de texto/HTML/adjuntos y truncado UTF-8. |
| `src/lib/mailClient/types.ts` | Extensión | Tipos de partes MIME y contenido del mensaje. |
| `src/convex/schema.ts` | Extensión | Tablas `mailBodies` y `mailAttachments` con índices por dueño, cuenta y mensaje. |
| `src/convex/_mail/cache.ts` | Nuevo | Borrado transaccional del contenido, limpieza de marcas de cabecera y recuento de contadores. |
| `src/convex/mailBody.ts` | Nuevo | `GetMsg` + servlet, token, verificación estricta de bytes, límite de 50 MB, MIME, LRU, estados y apertura. |
| `src/convex/mailAttachments.ts` | Nuevo | Contexto del adjunto y descarga con comprobación de propiedad. |
| `src/convex/mailCache.ts` | Nuevo | Estado, «Vaciar caché», auditoría y barrido diario con purga al perder `viewMailbox`. |
| `src/convex/mailAccounts.ts` | Extensión | Contexto de cuerpo, registro de token, contadores públicos y borrado real al desconectar/cambiar/borrar. |
| `src/convex/crons.ts` | Extensión | Barrido diario a las 04:45. |
| `src/pages/dashboard/mailbox/html.ts` | Nuevo | Resolución de `cid:`, detección de imágenes remotas y orígenes de `_storage`. |
| `src/pages/dashboard/mailbox/HtmlFrame.tsx` | Nuevo | DOMPurify, iframe `sandbox`, CSP, bloqueo de imágenes remotas y contraste legible. |
| `src/pages/dashboard/mailbox/MessageViewer.tsx` | Nuevo | Carga del mensaje, modos HTML/texto, adjuntos, descargas y estados de error. |
| `src/pages/dashboard/MailboxView.tsx` | Extensión | Tres paneles, selección de cabecera, pane móvil de mensaje y limpieza al cambiar carpeta/búsqueda/página. |
| `src/pages/dashboard/mailbox/MessageList.tsx` | Extensión | Filas seleccionables con teclado y estado visual. |
| `src/pages/dashboard/settings/MailboxCard.tsx` | Extensión | Desglose cuerpo/adjuntos y «Vaciar caché». |
| `src/convex/_mail/soap.ts`, `src/convex/mailSync.ts` | Corrección | Eliminadas sintaxis no erasable y `ConvexError` sin genérico que impedían `tsc -b`. |
| `tests/mailMime.test.ts`, `tests/mailBody.test.ts`, `tests/mailHtml.test.tsx` | Nuevos | Cobertura de MIME, bytes, LRU, caducidad, aislamiento, `storageCleanup`, saneado y CSP. |
| `tests/mailboxView.test.tsx`, `tests/cspSecurity.test.ts` | Extensión | Apertura en el visor y autorización justificada de DOMPurify sin `dangerouslySetInnerHTML`. |

---

## 3. Decisiones Técnicas y de Diseño

- El RFC822 vive solo en memoria: se verifica contra `s`, se parsea y se
  descarta. Se persiste el texto, el HTML y los adjuntos decodificados.
- Los adjuntos van a `_storage`; el HTML conserva `cid:` y el visor sustituye
  cada referencia por la URL del objeto en tiempo de render, sin duplicar bytes.
- El iframe usa `sandbox="allow-same-origin"` sin scripts. DOMPurify elimina
  etiquetas activas, la CSP bloquea recursos y las imágenes remotas se activan
  solo con acción expresa para ese render.
- El contraste se ajusta desde el padre leyendo `contentDocument`, sin inyectar
  JavaScript en el iframe.
- La expulsión LRU trabaja por mensaje completo y deja el 10 % libre; la
  caducidad usa la última apertura y cae a `cachedAt`. El barrido purga el
  contenido de cuentas cuyo dueño ya no tiene `viewMailbox`.
- «Vaciar caché» borra cuerpo, adjuntos y objetos, conserva cabeceras y emite
  `mail_cache_clear` sin datos del correo.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Build de producción (`npm run build` y `npx vite build`):** ✅ Exit 0;
  `tsc -b` y Vite generan `MailboxView` en su trozo diferido.
- **Tests focalizados:** ✅ 25/25 (`mailMime`, `mailBody`, `mailHtml`,
  `mailboxView`, `cspSecurity`).
- **Arquitectura y seguridad:** ✅ 22/22 (`arquitectura`, `seguridad`).
- **Lint (`npm run lint`):** ✅ 0 errores; 19 warnings preexistentes.
- **Pruebas reales:** pendientes contra Hermes; no se ha abierto una cuenta
  real ni se ha revisado el visor en navegador.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes

- [ ] Validar contra Hermes la apertura, los adjuntos y `cid:` con un mensaje
  real, comprobando que el flag de leído no cambia.
- [ ] Validar que el barrido diario purga la caché de una cuenta sin
  `viewMailbox` en el entorno real.
- [ ] Revisar visualmente el visor de tres paneles y el modo móvil con datos
  reales; no se ha hecho en esta sesión.
- [ ] Aprobar `SPEC-0018` antes de empezar F5.
- ⚠️ **Riesgo conocido:** `npm audit` mantiene la vulnerabilidad moderada
  preexistente de `hono`; no se ha tocado.
