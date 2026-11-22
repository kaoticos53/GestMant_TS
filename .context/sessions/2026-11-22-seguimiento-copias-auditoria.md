# Seguimiento de copias, limpieza, auditoría y gobernanza

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy / Freebuff
- **Rama / Commit:** `main`, pendiente de commit

---

## 1. Objetivo Principal de la Sesión

Cerrar cinco puntos de seguimiento: fixtures congeladas de copias v1/v2/v3,
limpieza paginada de fotos huérfanas, metadatos de auditoría versionados,
observabilidad de la pasada de recuperación y blindaje del comando de tipos.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo | Tipo de cambio | Justificación |
|---|---|---|
| `tests/fixtures/backup/v1.json` | Nuevo | Copia v1 real sin manifiesto. |
| `tests/fixtures/backup/v2-sin-archivos.json` | Nuevo | Copia v2 con manifiesto y sin `files`. |
| `tests/fixtures/backup/v2-con-archivos.json` | Nuevo | Copia v2 con bytes de archivo. |
| `tests/fixtures/backup/v3-con-archivos.json` | Nuevo | Copia v3 actual con archivo. |
| `tests/fixtures/backup/v3-manifiesto-incorrecto.json` | Nuevo | Copia editada que debe rechazarse. |
| `tests/backupCompatibility.test.ts` | Nuevo | Lee las fixtures y comprueba migración, archivos y rechazo. |
| `src/convex/workshopBackup.ts` | Modificado | Limpieza por páginas, `hasMore`, traza de fallo y aviso con enfriamiento. |
| `tests/backupSnapshotCleanup.test.ts` | Modificado | Cubre paginación, aviso único y traza de error real. |
| `src/lib/securityAudit.ts` | Modificado | Versión de metadatos, lector de la limpieza y formato común antiguo/nuevo. |
| `src/convex/audit.ts` | Modificado | Añade `metadataVersion` a los metadatos nuevos. |
| `tests/securityAuditLib.test.ts` | Modificado | Cubre metadatos históricos, nuevos y formato legible. |
| `tests/audit.test.ts` | Modificado | Ajusta las expectativas al sobre versionado. |
| `tests/gobernanza.test.ts` | Nuevo | Impide volver al typecheck incompleto y a las rutas antiguas. |
| `AGENTS.md`, `CLAUDE.md` | Modificado | TypeScript 5.9, rutas relativas y comando de test genérico. |

---

## 3. Decisiones Técnicas y de Diseño

- **Fixtures congeladas:** representan copias reales, no objetos construidos en
  cada prueba. v1 no lleva manifiesto; v2 y v3 sí. La v2 con archivos conserva
  sus bytes al migrar y la v3 editada se rechaza antes de restaurar.
- **Paginación:** `pruneOrphanSnapshots` retira como máximo 100 documentos por
  pasada (tope configurable de 500) empezando por la foto más antigua. Devuelve
  `hasMore`; el cron siguiente continúa. La foto que se conserva no se toca.
  Una foto partida entre dos páginas solo se cuenta cuando la página retira su
  último documento; la página intermedia deja su evento de auditoría con los
  trozos retirados y sin foto cerrada, así que no hay aviso ni recuento doble.
- **Metadatos:** `logSecurityEvent` añade `metadataVersion: 1` a los objetos
  nuevos. La traza de limpieza usa la versión 2 y `readSnapshotPruneMetadata`
  entiende `batches`/`rows` (histórico) y `photos`/`chunks` (actual). El visor y
  el CSV muestran ambos con la misma frase y ocultan el número de sobre.
- **Fallo de recuperación:** cualquier error de la pasada se registra como
  `workshop_backup_recovery_failure` con el mensaje acotado y el lote pendiente.
  Se avisa a administradores con un enfriamiento de 6 h; si el aviso falla, la
  traza de auditoría se escribe igualmente y se propaga el error original.
- **Gobernanza:** una prueba lee `package.json`, la CI y las instrucciones para
  exigir `tsc -b` más el `tsconfig` de Convex. También fija TypeScript 5.9 y
  evita que vuelvan la ruta de ejemplo antigua y el test inexistente.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npm run typecheck`):** ✅ Sin errores, app y Convex.
- **Suite completa (`npx vitest run`):** ✅ 2 925 pruebas pasando, 69 omitidas,
  277 archivos en verde y 1 omitido.
- **Pruebas enfocadas:** ✅ 29 pruebas entre compatibilidad, limpieza, auditoría
  y gobernanza.
- **Caso de foto partida:** ✅ `tests/backupSnapshotCleanup.test.ts` usa una foto
  huérfana de 101 documentos: la primera página no avisa, la segunda avisa una
  sola vez y la auditoría conserva dos eventos de página.
- **Lint (`npm run lint`):** ✅ 0 errores; quedan 19 avisos preexistentes de
  Fast Refresh, generados y TanStack Virtual.
- **Pruebas manuales / UI:** no se revisó visualmente. El único cambio de
  presentación es el resumen textual de metadatos de auditoría.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes

- La limpieza de una acumulación mayor que la página se completa en varias
  pasadas del cron; es intencionado para no acercarse a los límites de una
  mutación.
- Las fixtures cubren el JSON interior de la copia, no el envoltorio cifrado;
  ese ya tiene sus propias pruebas en `tests/backupFile.test.ts`.
- El enfriamiento de 6 h solo afecta a la campana; cada fallo deja su fila de
  auditoría.
- El piloto F8 con Hermes y los dos técnicos sigue dependiendo de un deployment
  vivo y credenciales reales.
