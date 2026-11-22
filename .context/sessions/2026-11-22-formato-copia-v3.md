# Sesión — Formato interior de copia v3

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy (Freebuff)
- **Rama / Commit:** `feat/correo-f1-base-pura` / pendiente de commit

---

## 1. Objetivo Principal de la Sesión

Subir el formato interior de la copia a **v3** para que un cliente anterior —que solo conoce v1/v2— rechace una copia con archivos en vez de restaurarla sin ellos, manteniendo la lectura y migración de v1/v2.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/lib/backup.ts` | Extensión | `BACKUP_VERSION = 3`; se añade `BACKUP_PREVIOUS_VERSION = 2`; el parser acepta v1, v2 y v3; v2/v3 validan manifiesto y v1 se migra. `migratedFrom` devuelve 1 o 2. |
| `tests/backup.test.ts` | Actualización | Pruebas de migración v2 sin archivos, v2 con archivos y rechazo de manifiesto incoherente v2; se mantiene la migración v1. |
| `tests/backupFiles.test.ts` | Actualización | La exportación real se marca como v3. |
| `.context/active-task.md` y este handover | Actualización | Traspaso del trabajo. |

---

## 3. Decisiones Técnicas y de Diseño Tomadas

- **El envoltorio protegido no cambia.** La versión exterior sigue siendo `BACKUP_FILE_VERSION = 2`; lo que sube es el JSON interior. Un cliente anterior puede descifrar el archivo, pero al parsear el contenido ve `version: 3` y lo rechaza antes de vaciar o restaurar nada.
- **Compatibilidad hacia atrás, no hacia delante.** La app nueva lee v1 (sin manifiesto), v2 (con manifiesto y, si existe, bloque `files`) y v3 (formato actual). Cualquier copia anterior se migra en memoria y se devuelve como v3.
- **v2 con archivos se conserva.** Aunque v2 se creó antes de esta subida, un archivo v2 con bloque `files` se acepta y esos bytes no se pierden al migrar.
- **Las copias v2 sin archivos siguen funcionando.** No se exige bloque `files` para leer v2; se completa el manifiesto actual y se mantiene la compatibilidad con copias anteriores a la cobertura de archivos.
- **El manifiesto de v3 puede declarar cero archivos.** Una copia sin archivos también es v3; así todos los clientes anteriores rechazan cualquier copia nueva, tengan o no archivos.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Pruebas de copias:** ✅ `backup` 8/8, `backupFiles` 2/2, `backupFile` 4/4, `mailSharesBackup` 5/5 y `workshopBackupCard` 6/6.
- **Prettier / ESLint:** ✅ Sin errores en los archivos tocados.
- **Suite completa (`npx vitest run`):** ✅ **2 911 pruebas pasando**, 69 omitidas, 275 archivos en verde y 1 archivo omitido.
- **Pruebas Manuales / UI:** ❌ No se ha abierto la interfaz; la migración se comprueba en el parser.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes para el Siguiente Agente

- [ ] Actualizar el handover histórico de copias cifradas v2 si se necesita que la documentación de esa sesión refleje la versión actual; este handover es el estado vigente.
- ⚠️ **Riesgo conocido:** una copia v3 editada a mano puede quitar el bloque `files` y dejar un manifiesto coherente sin archivos; la firma del envoltorio protegido detecta la manipulación, pero un JSON suelto no está firmado.
- **Sin push:** el commit queda pendiente y no se ha subido nada al remoto.
