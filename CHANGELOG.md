# Bitácora de Cambios (Changelog) — Pulso Taller

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Sin publicar]

### Novedades

- **Datos de ejemplo:** La muestra llena ya los **catálogos maestros** con los que autocompletan los formularios —marcas, ubicaciones de equipos y de almacén, proveedores, puestos y categorías de repuestos— y levanta el **catálogo de modelos** a partir del inventario: cada marca y nombre comercial distintos son un modelo, cada unidad del taller cuelga del suyo, los repuestos declaran su compatibilidad por modelo y los manuales de la muestra se enganchan a su modelo. Vaciar el taller se lleva también los modelos, para que volver a cargar la muestra no deje los de la anterior.
- **Correo:** El repositorio incluye el **relevo de correo** (`npm run mail:relay`), el puente HTTP → SMTP que hace falta para usar un servidor propio desde la opción «Relevo propio»: sin dependencias nuevas, con testigo, direcciones comprobadas, copia oculta que no aparece en las cabeceras y el motivo del SMTP en un 502. Se arranca junto al backend y, en el NAS, como un contenedor más del proyecto. La guía está en `RELEVO.md`.
- **Correo en el NAS:** El `relevo` deja de vivir en un perfil que había que encender a mano —el fallo que se llevaba los avisos por delante: el contenedor no existía, y la app solo decía «conexión rechazada» cuando una incidencia esperaba su correo—. Arranca con el resto de los contenedores, la puesta en marcha deja su estado en el panel con la dirección que hay que poner en _Ajustes del taller_, y `npm run nas:check` avisa si el `docker-compose.yml` del NAS no lo trae o si está parado. La guía y los tropiezos, en `RELEVO.md` y en el apartado «Problemas frecuentes» de `SYNOLOGY.md`.
- **Ajustes del taller:** El correo saliente se configura desde la aplicación —pasarela de la plataforma, Resend, SendGrid, Mailgun, Brevo o un relevo HTTP propio— con remitente, dominio verificado y prueba de envío. Los avisos de incidencia y el resumen semanal salen por el servicio elegido, y la clave del servicio nunca vuelve al navegador.
- **Ajustes del taller:** Una tarjeta nueva decide qué avisos por correo recibe cada rol, con **una columna por cada tipo de correo del taller** —el aviso a quien notificó, el aviso interno de las incidencias, el resumen semanal y la prueba de envío—, cada interruptor debajo de su encabezado y las dos que no se reparten por rol con su destino escrito. El aviso interno cubre el alta, la asignación —la del coordinador y la autoasignada— y el cierre, con una sola entrega por momento (reasignar no vuelve a avisar); lleva la referencia, el equipo, quién la lleva y el enlace al panel —nunca el código de seguimiento del invitado—, y el correo a quien notificó una incidencia sigue saliendo siempre a la dirección que dejó.
- **Correo:** El relevo comprueba el servidor de correo **antes de usarlo**, sin mandar nada: al arrancar deja en su registro si la conexión y la autenticación funcionan, y la misma comprobación se puede pedir desde _Ajustes del taller_ o con un `POST /comprobar`, que contesta con el servidor, el cifrado y el método de autenticación que aceptó. Sirve para saber si la contraseña de aplicación de Gmail es la buena antes de que haya una incidencia esperando su aviso.
- **Ajustes del taller:** El **camino de envío del correo se comprueba solo**. Al abrir el panel —y otra vez al guardar— se le pide al relevo que responda y acepte las credenciales, sin mandar ningún correo, y el estado se enseña en dos líneas: el último envío de verdad y la respuesta del relevo ahora mismo. Si el último envío **no salió**, el bloque se pinta en rojo con el motivo que dejó el servicio, sin tener que abrir el histórico ni la ficha. Con un servicio de API propia se dice que su prueba es mandar un correo, en vez de fingir una comprobación que no existe.
- **Correo:** El servicio de envío admite ya **Gmail (Google)** y **Ethereal (pruebas)** además de los que tienen API propia: los dos salen por el relevo HTTP, con su servidor (puesto en el catálogo) y su cuenta guardados en los ajustes del taller, así que sirven para mandar desde una cuenta de Google —con contraseña de aplicación— y para probar el correo de punta a punta sin que llegue a nadie. El relevo acepta el servidor SMTP en el propio sobre, no guarda esas credenciales y avisa si la dirección del puente no va cifrada.
- **Correo:** Un envío que no llega al relevo ya no deja un «connection refused» a secas: el aviso, el histórico y la comprobación añaden que el puente tiene que estar arrancado y cuál es su dirección, y el panel revisa la dirección **mientras se escribe**, avisando de las tres confusiones que se llevan casi todos los fallos —el puerto 8025 del visor de Ethereal, `https://` contra un relevo que habla HTTP y `localhost` cuando el backend va en su contenedor—. Además, el relevo **arranca sin `SMTP_HOST`** cuando solo se usan Gmail o Ethereal, que mandan su servidor en cada sobre; un sobre sin servidor se rechaza con un 400 que dice qué falta.
- **Ajustes del taller:** El correo admite una **copia oculta fija** —todos los envíos se copian al archivo del taller sin que los destinatarios lo vean— y un **histórico de los últimos 200 envíos** con destinatarios, asunto, servicio y resultado, también cuando el envío falla.

---

## [1.1.0] - 2026-10-16

### Novedades

- **Equipos:** Posibilidad de registrar un equipo nuevo directamente desde el formulario de reporte de incidencias cuando no existe en el catálogo.
- **Equipos:** Gestión normalizada de modelos de equipos en el backend y selector asistido en la ficha de inventario.

### Mejoras

- **Incidencias:** Autocompletado inteligente y validación estricta en el intake público/privado de incidencias.
- **Documentación:** Ampliación del soporte y visualización de manuales técnicos asociados a equipos.

---

## [1.0.0] - 2026-10-15

### Novedades

- **Partes de trabajo:** Generación y exportación de partes de trabajo oficiales e informes técnicos en formato PDF con maquetación industrial.
- **Incidencias:** Editor de texto enriquecido (TipTap) para el seguimiento de incidencias, notas de intervención y documentación fotográfica.
- **Landing:** Página de presentación pública con acceso directo al reporte de incidencias y acceso profesional para técnicos.

### Mejoras

- **UI / UX:** Implementación del hook `useRowsThatFit` y el componente `ListArea` para renderizado dinámico de filas sin desbordamiento.
- **Trazabilidad:** Máquinas de estado puras en `src/lib/` para incidencias, peticiones de repuesto y compras.

### Seguridad

- **AppSec:** Suite de tests de seguridad en `tests/seguridad.test.ts` y guardrails estrictos de gobernanza en `AGENTS.md` para proteger mutaciones e inmutabilidad de `securityAuditLog`.

---

## [0.3.0] - 2026-10-14

### Novedades

- **Infraestructura:** Scripts de instalación desatendida (`nas-setup.mjs`) y copias de seguridad automáticas (`nas-backup.mjs`) para Synology NAS.
- **Dashboard:** Panel de métricas con indicadores clave de disponibilidad del taller.

### Mejoras

- **Scripts:** Solicitud interactiva de contraseña centralizada para agilizar operaciones de administración.

### Correcciones

- **Convex:** Validación preventiva del índice de módulos de Convex previo al empaquetado para despliegue.

---

## [0.2.0] - 2026-10-13

### Novedades

- **Informes:** Módulo de informes semanales de mantenimiento con agregación de incidencias, peticiones y horas dedicadas.

### Mejoras

- **Arquitectura:** Refactorización de las máquinas de estado finitas de incidencias (`incidentFlow.ts`) y peticiones de repuesto (`requestFlow.ts`).

### Correcciones

- **Peticiones de repuesto:** Bloqueo de transiciones huérfanas y corrección de cancelaciones de material.

---

## [0.1.0] - 2026-10-11

### Novedades

- **Base:** Estructura inicial de la aplicación con React 19, Vite 7, Tailwind CSS v4 y componentes accesibles Radix UI.
- **Repuestos:** Catálogo de repuestos con control de stock, ubicaciones en almacén y compatibilidad con equipos.
- **Compras:** Flujo de órdenes de compra y peticiones de repuesto asociadas a incidencias de taller.

### Seguridad

- **Autenticación:** Integración con Convex Auth, control de acceso basado en roles (admin, técnico) y registro de auditoría.
