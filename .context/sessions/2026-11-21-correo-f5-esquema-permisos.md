# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-21
- **Agente / Modelo:** Buffy / Codebuff
- **Rama / Commit:** `feat/correo-f1-base-pura` / commit de F5, incremento 1

---

## 1. Objetivo Principal de la Sesión

Abrir F5 de `SPEC-0018` tras confirmar el usuario que el cliente de correo
funciona y que la spec puede aprobarse. Este incremento cierra la fase 1 de la
spec: tabla `mailShares`, capacidad `createIncidentFromMail` y las políticas
puras de modo, tamaño y audiencia. La acción de compartir, la sección en fichas
y las descargas son el incremento siguiente.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
| --- | --- | --- |
| `src/convex/schema.ts` | Extensión | Tabla `mailShares` con el snapshot autocontenido, los campos de purga/lápida y los índices `by_destination`, `by_orphan_purge`, `by_client_share` y `by_source_message`. |
| `src/lib/permissions.ts` | Extensión | Capacidad `createIncidentFromMail` en el catálogo y en los defaults: activa para administrador, responsable y técnico; apagada para invitado y roles personalizados. |
| `src/lib/mailShare.ts` | Nuevo | Políticas puras: modos por destino, límites (8 KB de resumen, 64 KB de texto, 512 KB de HTML, 50 MB por copia), resumen, tamaño del snapshot, plazo de huérfanas y audiencia derivada del destino. |
| `tests/mailShares.test.ts` | Nuevo | 23 pruebas de esquema, índices, capacidad, modos, recortes, límites y audiencia. |
| `docs/specs/0018-copias-compartidas-de-correo.md` | Estado | 0018 pasa a aprobada; se anota el incremento cerrado. |
| `docs/plan-implantacion-correo.md` | Estado | El plan refleja la aprobación de 0018 y el estado de F5. |

---

## 3. Decisiones Técnicas y de Diseño

- La copia guarda un snapshot propio (`bodyText`, `bodyHtml`, adjuntos y `.eml`
  opcional) y **no** punteros a `mailBodies` ni `mailAttachments`: el LRU, la
  caducidad y «Vaciar caché» no pueden tocarla.
- `destinationId` es una unión de ids de Convex, no una cadena: el esquema
  impide guardar una compra con id de incidencia. La búsqueda se hace siempre
  por `by_destination`, nunca por asunto.
- `resolveShareMode` **rechaza** `original` en manuales en vez de degradarlo a
  `summary`: quien comparte debe saber que ese destino solo guarda resumen.
- `canReadSharedMail` exige `active === true` explícito: una sesión sin
  identidad no se trata como miembro activo. Incidencias y peticiones usan la
  audiencia de su ficha (miembro activo); equipos, manuales y compras, la
  capacidad de su módulo; en papelera, la coordinación.
- No se añade `viewMailShares`: la visibilidad no es un permiso aparte, se
  deriva del destino, como fija la spec.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc -b`):** ✅ Sin errores.
- **Codegen (`npx convex codegen`):** ✅ Ejecutado tras añadir la tabla.
- **Tests nuevos (`tests/mailShares.test.ts`):** ✅ 23/23.
- **Tests de permisos y arquitectura:** ✅ 50/50 (`seguridad`, `customRoles`,
  `abilities`, `arquitectura`).
- **Pruebas Manuales / UI:** no aplica en este incremento; no hay UI nueva.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes

- [ ] F5, incremento 2: `mailShares.share` y `createIncidentFromMail` con
  descarga bajo demanda, snapshot, objetos propios, idempotencia por
  `clientShareId` y limpieza si falla a medias.
- [ ] F5, incremento 2: `listForDestination`, `get` y `download` con la
  audiencia del destino; `purge` de administrador con motivo y lápida.
- [ ] F5, incremento 2: diálogo «Compartir con el expediente» en el visor y
  sección «Correos compartidos» en incidencias, peticiones, equipos, manuales y
  compras.
- [ ] F6: enganches de retención en papeleras, borrado de equipos/manuales,
  cron de huérfanas y papelera administrativa.
- ⚠️ **Riesgo conocido:** la validación real de F3 contra Hermes sigue sin
  acta; el usuario confirmó que el cliente funciona, pero no se han registrado
  los 1 554 mensajes ni la segunda pasada del checklist.
