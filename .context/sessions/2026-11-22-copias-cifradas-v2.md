# Handover — Copias protegidas, validación al exportar y migración v1

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy (Freebuff)
- **Rama / Commit:** feat/correo-f1-base-pura (commit pendiente al escribir este archivo)

---

## 1. Objetivo Principal de la Sesión

Cerrar las ideas 12, 9 y 11 del backlog de copias:

1. **Proteger el JSON exportado** y comprimirlo para que ocupe menos.
2. **Validar y firmar la copia al exportarla**, no dejarlo todo para la restauración.
3. **Leer y migrar copias antiguas** (formato v1) sin pedir al taller que las rehaga.

---

## 2. Formato y Flujo

### 2.1 Archivo descargado

La pantalla ya no descarga el JSON plano. Descarga un envoltorio JSON con esta forma:

```json
{
  "format": "pulso-taller-backup-file",
  "version": 2,
  "protection": "AES-GCM-256+HMAC-SHA256",
  "compression": "gzip",
  "kdf": { "name": "PBKDF2-SHA256", "iterations": 210000, "salt": "…" },
  "iv": "…",
  "payload": "…",
  "signature": "…"
}
```

- El JSON de la copia se comprime con gzip y después se cifra con AES-GCM-256.
- La clave de 64 bytes sale de PBKDF2-SHA256 (210 000 iteraciones, sal de 16 bytes).
  Los primeros 32 bytes cifran; los otros 32 firman con HMAC-SHA256.
- La firma cubre dominio, sal, IV y criptograma, y se comprueba **antes** de descifrar.
- El IV es aleatorio de 12 bytes por exportación. No se reutiliza.
- El nombre del archivo sigue siendo `pulso-taller-backup-AAAA-MM-DD.json`; el contenido es el envoltorio.

### 2.2 Frase de paso

- Se pide al exportar, con confirmación. Mínimo 10 caracteres.
- No se guarda en la base de datos, ni en el navegador, ni en el archivo.
- Si se pierde, la copia no se puede abrir. Es el precio de que el archivo no contenga el taller en claro.

### 2.3 Copia interior v2

El JSON que viaja dentro del envoltorio sube a `version: 2` e incluye un manifiesto:

```json
{
  "format": "pulso-taller-backup",
  "version": 2,
  "exportedAt": 0,
  "exportedBy": "",
  "tables": {},
  "manifest": { "totalRecords": 0, "tableCounts": {} }
}
```

- `backupManifest()` cuenta las tablas canónicas.
- Al cargar una copia v2 se comprueba que los recuentos declarados coinciden con las filas.
- Una copia v1 se acepta y se migra en memoria: se completa el manifiesto y se devuelve `migratedFrom: 1`.
- Una versión desconocida se rechaza con un mensaje que pide actualizar la app.

### 2.4 Validación al exportar

`exportBackup` recorre la copia en seco con `walkBackup(..., "check")` antes de
entregarla. Ese es el mismo camino que usa la restauración: cada lote se inserta y
se revierte. Si una fila no se pudiera volver a insertar, la exportación falla y no
se audita como completada. La comprobación no deja filas ni trazas: la mutación de
comprobación termina lanzando y Convex revierte el lote.

---

## 3. Archivos Modificados y Justificación Técnica

| Archivo | Tipo | Justificación |
|---|---|---|
| `src/lib/backupFile.ts` | Nuevo | Envoltorio puro: gzip, PBKDF2, AES-GCM, HMAC, base64 y detección del formato. Sin React ni Convex. |
| `src/lib/backup.ts` | Extensión | `BACKUP_VERSION = 2`, manifiesto, migración v1 y comprobación de recuentos. |
| `src/convex/workshopBackup.ts` | Extensión | Manifiesto en la exportación y validación en seco antes de devolverla. |
| `src/pages/dashboard/settings/workshopData/components/WorkshopBackupSection.tsx` | Extensión | Diálogos de frase al exportar y de desbloqueo al seleccionar una copia protegida; aviso de migración. |
| `tests/backupFile.test.ts` | Nuevo | Ida y vuelta, compresión, frase incorrecta, manipulación y cabecera no válida. |
| `tests/backup.test.ts` | Actualización | Fixtures v2 con manifiesto; pruebas de migración v1 y manifiesto incoherente. |
| `tests/workshopBackupCard.test.tsx` | Actualización | Flujo de exportación con frase y fixtures v2. |
| `tests/mailSharesBackup.test.ts` | Actualización | Fixture v2 con manifiesto. |

---

## 4. Decisiones Técnicas

- **WebCrypto y `CompressionStream` nativos.** No se añadió ninguna librería.
- **La firma no autentica a la persona.** HMAC demuestra que quien creó o reescribió
  el archivo conocía la frase y que el contenido no cambió. Quien pueda reescribir la
  copia y conozca la frase puede generar otra válida; no es una firma de identidad.
- **La contraseña incorrecta y el archivo manipulado comparten mensaje.** No se filtra
  si la frase era correcta antes de verificar la firma.
- **Se conserva la validación en restauración.** La petición pedía añadirla al exportar,
  no quitarla al restaurar: sigue siendo la última barrera antes de vaciar el taller.
- **Compatibilidad hacia atrás, no hacia delante.** La app nueva lee v1 y v2; una app
  antigua rechazará v2 con «versión no soportada», como ya hacía con cualquier versión
  distinta de la suya.

---

## 5. Estado de Verificación

- **TypeScript:** `npx tsc --noEmit` ✅.
- **ESLint:** archivos tocados ✅.
- **Prettier:** archivos tocados ✅.
- **Pruebas de copias:** `backup` 6, `backupFile` 4, `mailSharesBackup` 5,
  `workshopBackupCard` 4, `workshopBackup` 2 y `rollbackRehearsal` 17 → **38/38 ✅**.
- **Arquitectura y seguridad:** 9 + 13 → **22/22 ✅**.
- **UI:** no se ha abierto un navegador ni se ha revisado visualmente. Las pruebas de
  la tarjeta usan jsdom y simulan `protectBackup`; el cifrado real se prueba en Node
  con `tests/backupFile.test.ts`.

---

## 6. Deuda Técnica y Riesgos

- [ ] Revisar visualmente los dos diálogos y el flujo completo en navegador.
- [ ] Medir el coste de la validación en seco al exportar con volumen (antes eran
      ~1,0 s con 7 806 filas; ahora la exportación recorre la copia una vez más).
- ⚠️ **Frase perdida = copia irrecuperable.** Debe quedar claro en la formación del taller.
- ⚠️ La protección cubre el archivo descargado, no la pantalla ni el portapapeles.
- ⚠️ El formato interior v2 exige manifiesto; una copia v2 editada sin recalcularlo se
      rechaza, pero una copia manipulada con manifiesto coherente y sin envoltorio no
      tiene firma. La firma solo existe en el archivo protegido.
