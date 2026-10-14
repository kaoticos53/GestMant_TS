# Glosario del producto

Qué palabra usa Pulso Taller para cada cosa, y qué palabras no se usan. La copia
que se ve —etiquetas, botones, avisos, textos vacíos, mensajes de error,
permisos, buscadores y los documentos que genera la app— se escribe con esta
lista y con ninguna otra.

**La regla es una:** si el concepto está aquí, se escribe con su término. Si
alguien escribe una palabra de la columna «no usar», la copia se corrige: no son
matices, son el mismo producto llamando a lo mismo de dos maneras.

## El taller y sus cosas

| Término         | Qué nombra                                                                                                                                                                                                                                                  | No usar                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **equipo**      | La entrada del inventario del taller: el aparato con su código, marca, modelo y nº de serie. Es lo que se da de alta, lo que se vincula a una incidencia, lo que se marca como compatible con un repuesto y lo que tiene ficha e historial.                 | modelo (para la entrada), máquina, aparato, dispositivo, equipo audiovisual (salvo en la presentación), unidad |
| **modelo**      | El nombre comercial del fabricante. Es **un campo** de la ficha del equipo («Marca y modelo»), y solo se usa como término propio cuando el criterio es de verdad el nombre: el filtro de manuales por modelo y la búsqueda por marca, modelo o nº de serie. | usar «modelo» para nombrar una entrada del inventario                                                          |
| **marca**       | El fabricante del equipo o del repuesto.                                                                                                                                                                                                                    | —                                                                                                              |
| **Nº de serie** | El número de serie de un equipo concreto. Se escribe así, con la preposición.                                                                                                                                                                               | Nº serie, serial, S/N                                                                                          |
| **Nº de parte** | La referencia del fabricante o del proveedor de un repuesto.                                                                                                                                                                                                | Part number, part number, referencia de fabricante (como etiqueta del campo), Nº parte                         |
| **manual**      | El archivo que sube el taller: el del fabricante o una nota del taller escrita con el editor. Vive en el módulo Manuales y cuelga de un modelo o de un equipo.                                                                                              | documentación, guía, PDF (como nombre del concepto)                                                            |
| **nota**        | La entrada que escribe una persona: la del cuaderno de una incidencia, la del historial de un equipo o la nota del taller de un manual.                                                                                                                     | comentario, anotación (como nombre de la entrada)                                                              |

## El almacén

| Término | Qué nombra | No usar |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- || **repuesto** | El artículo del taller: el que se pide, se aprueba, se descuenta y se sustituye. Es la entrada del catálogo. | referencia, recambio, pieza, artículo, consumible, ítem |
| **Consumibles** | Con mayúscula, es una de las categorías del catálogo (junto a Conectividad, Audio, Iluminación…): un dato, no un sinónimo de repuesto. | usar «consumible» para nombrar un repuesto |
| **catálogo** | El conjunto de repuestos del taller. | inventario (para repuestos) |
| **inventario** | El conjunto de equipos del taller. | catálogo (para equipos) |
| **almacén** | El sitio físico donde está el material. | — |
| **stock** | Las existencias de un repuesto. | existencias |
| **stock mínimo** | El umbral por debajo del cual un repuesto avisa. | mínimo (a secas) |
| **ubicación** | Dónde está un repuesto en el almacén (una estantería, un cajón). | localización, emplazamiento, sitio |
| **proveedor** | Quien vende el repuesto. | — |
| **ficha del proveedor** | La página del proveedor donde se compra ese repuesto (la dirección). | URL de la ficha, enlace del fabricante, ficha proveedor |
| **compatible** | Un repuesto es compatible **con equipos**: los que puede reponer. | compatible con modelos |

## Las compras

| Término                 | Qué nombra                                                                                                                                                                          | No usar                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **petición de compra**   | La línea que el responsable aparta de una petición de repuesto porque el almacén no la cubre (no hay stock, o el repuesto es nuevo). Se numera **PC-0001** y espera agrupada por proveedor. | solicitud de compra, pedido (para la línea)                 |
| **orden de compra**      | Lo que se manda de una vez a un proveedor: se numera **OC-0001**, lleva su fecha y dentro van las peticiones de compra de ese proveedor. La monta a mano el responsable.            | pedido de compra (para la orden), OC (a secas en la pantalla) |
| **artículo**             | Cada línea de una orden: el repuesto, lo que se pide, lo que ha llegado y su nota. Es lo que dice de qué petición de repuesto sale.                                                | línea (fuera de la ficha), ítem                              |
| **recepción**            | La entrada de material de un proveedor: se hace sobre una orden, lleva el albarán adjunto y deja el movimiento de recepción.                                                        | entrada (a secas para el documento), albarán (como nombre del hecho) |
| **albarán**              | El papel del proveedor que acompaña al material. Sin él no se recepciona: es lo que respalda la entrada. Se escribe así, con tilde.                                                  | albarán de entrega (como etiqueta del botón), nota de entrega |
| **proveedor**            | Quien vende el repuesto. Es la clave con la que se agrupa lo que está sin tratar y el destinatario de cada orden.                                                                   | suministrador, distribuidor (como término de la app)        |
| **Sin proveedor**        | El grupo de lo que se compra y no tiene proveedor en el catálogo. Se escribe así, con mayúscula inicial: es una etiqueta.                                                           | Proveedor pendiente, sin asignar                            |
| **Sin tratar**           | Lo que está apartado para comprar y todavía no ha entrado en ninguna orden. Es el estado de la cola de compras.                                                                     | pendiente (para la cola de compras), por procesar            |
| **material recibido**    | El estado de una petición cuando ya ha llegado todo lo que se compró para ella: se puede aprobar y entregar.                                                                        | material en almacén, recibido (a secas)                     |

## El trabajo del día a día

| Término                      | Qué nombra                                                                                                                                     | No usar                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **incidencia**               | Lo que se rompe o falla y hay que reparar. Es la unidad de trabajo del taller y tiene referencia (INC-0123), estado y técnico.                 | avería, problema, fallo, rotura, ticket                                   |
| **referencia**               | El número con el que el taller cita una incidencia o una petición entre sí (INC-0123, PET-0001): correlativo, y por eso se queda dentro del taller. | número de incidencia (para el código), id                                  |
| **código**                   | Lo que se le da a quien notificó una incidencia para seguirla desde fuera (A7K2-QX9M): ocho caracteres al azar, en dos grupos, sin letras que se confundan (ni O ni 0, ni I ni 1). No sustituye a la **referencia**: son dos identificadores del mismo caso, uno para dentro y otro para fuera. | referencia (para el código), clave, PIN, ticket        |
| **notificar**                | Dar entrada a una incidencia: quien la sufre la notifica desde el formulario público. De ahí «fecha de notificación» y «Notificar incidencia». | reportar, dar parte, abrir                                                |
| **datos del equipo**         | Lo que describe quien notifica una incidencia del aparato averiado —tipo, modelo y nº de serie—, tal y como lo ve desde fuera. No es la ficha del inventario, que se vincula aparte; y los corrige quien tiene la máquina delante, desde «Corregir datos del equipo». | confundirlos con la ficha del inventario, datos de la avería            |
| **petición**                 | Lo que se pide al almacén: material para un equipo, con sus líneas, su prioridad y sus decisiones. Es la unidad del módulo Peticiones.         | solicitud, pedido, encargo, orden                                         |
| **pedir**                    | El verbo de una petición.                                                                                                                      | solicitar                                                                 |
| **solicitante**              | Quien pide el material. Se usa como etiqueta de campo.                                                                                         | peticionario, requirente                                                  |
| **línea**                    | Cada repuesto de una petición, con su cantidad.                                                                                                | ítem, partida                                                             |
| **contexto o diagnóstico**   | Lo que la persona que pide explica de la avería que repara: síntomas, qué se ha probado, plazos.                                               | —                                                                         |
| **técnico**                  | Quien repara: el rol que lleva las incidencias.                                                                                                | mecánico                                                                  |
| **responsable de repuestos** | Quien decide las peticiones y cuida el almacén.                                                                                                | encargado, jefe de almacén                                                |
| **intervención**             | Cada registro del historial de mantenimiento de un equipo: qué se hizo, cuándo y quién.                                                        | reparación (como nombre del registro), arreglo                            |
| **mantenimiento**            | El área y el conjunto: el historial de mantenimiento de un equipo.                                                                             | usar «mantenimiento» como nombre de un registro (eso es una intervención) |
| **revisión preventiva**      | La intervención que toca por calendario, no porque algo haya fallado.                                                                          | mantenimiento preventivo                                                  |
| **cuaderno**                 | El hilo de notas de una incidencia o de un equipo, en orden.                                                                                   | bitácora, diario, historial (para las notas)                              |
| **expediente**               | Los documentos de una incidencia y su rastro de cambios.                                                                                       | carpeta, dossier                                                          |
| **documento**                | Un archivo que se adjunta al expediente (foto, PDF, oficio).                                                                                   | fichero, adjunto (como sustantivo)                                        |
| **parte**                    | El documento que la app genera de **una** incidencia, para leer o entregar (Markdown, PDF, ZIP). Es el que se imprime y se firma.              | informe (para el parte de una incidencia), reporte                        |
| **informe**                  | El documento que junta **varias** incidencias de un periodo: el que se descarga desde «Informes del periodo».                                  | informe (para el parte de una sola incidencia), reporte                   |
| **seguimiento**               | Lo que ve quien notificó una incidencia al consultarla por su **código** (A7K2-QX9M): estado, equipo, fechas y pasos. Es el recorte que se enseña fuera del taller. | trazabilidad, tracking                                                    |
| **resumen semanal**          | El correo con el balance de la semana que sale solo.                                                                                           | informe semanal, reporte                                                  |

## Personas y accesos

| Término                      | Qué nombra                                                                                                                                         | No usar                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **persona**                  | Alguien del taller, con su ficha: puesto, ubicación, teléfono. Es lo que se dice en prosa.                                                         | miembro, empleado, trabajador      |
| **usuario**                  | El módulo y la lista donde se dan de alta las personas, sus roles y sus accesos. Se usa en la navegación y en los títulos («Usuarios del taller»). | —                                  |
| **cuenta**                   | Las credenciales de acceso: crear cuenta, entrar, correo de la cuenta.                                                                             | —                                  |
| **invitado**                 | Una sesión anónima, sin cuenta. Solo puede consultar el **seguimiento** de una incidencia con el **código** que se le dio al notificarla.            | anónimo (en la interfaz)           |
| **administrador**            | Quien lo puede todo, con candado.                                                                                                                  | superusuario                       |
| **rol**                      | El conjunto de permisos que se asigna a una persona.                                                                                               | perfil, puesto (para los permisos) |
| **puesto**                   | El oficio de la persona (Realización, Iluminación).                                                                                                | cargo, posición                    |
| **área o equipo de trabajo** | El equipo humano al que pertenece quien pide: Plató 1, Producción.                                                                                 | equipo (a secas), departamento     |

## Avisos y acciones

| Término                  | Qué nombra                                                                                                                                                                                                | No usar                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **aviso**                | El mensaje que la app da o muestra: el aviso de stock bajo, el del trabajo sin constancia, el aviso que aparece en la cabecera. Y «notificación» solo en la fecha en que se dio entrada a una incidencia. | alerta                                |
| **aviso a quien notificó** | El correo que se le manda cuando su incidencia cambia de estado y cuando el taller la **retira** (la retirada no es un estado, pero deja su **código** sin seguir el caso). Lleva el código —lo único que ata el correo al caso— y el mismo **seguimiento** que ve el invitado: ni notas ni historial del taller. | correo de notificación, email de seguimiento |
| **mensaje**              | Lo que una persona escribe a otra desde la mensajería.                                                                                                                                                    | chat, privado                         |
| **archivo**              | El módulo donde se guarda lo que ya no es del día a día: incidencias cerradas y peticiones decididas. También, el fichero subido. Y «archivar» es llevarlo ahí.                                           | histórico (para el archivo)           |     | **historial** | La lista de lo que ha pasado con una entidad: el historial de mantenimiento de un equipo, el historial de decisiones de una petición, el historial de una nota. | histórico (como sustantivo del módulo) |
| **registro**             | Solo la acción: «el registro de intervenciones» es registrarlas («Registrar intervención»). Nunca el nombre de la cosa registrada: eso es una intervención, una nota, un movimiento.                      | registro (como nombre de un elemento) |
| **papelera**             | Donde va lo retirado, a la espera de borrarse o volver.                                                                                                                                                   | basura, contenedor                    |
| **retirar**              | Quitar algo que puede volver: una nota se retira al cuaderno, un manual se retira de la ficha, una incidencia o una petición equivocada o duplicada se retira a la papelera del módulo Archivo.              | —                                     |
| **borrar**               | Quitar sin vuelta: «Se borra la ficha… no se puede deshacer».                                                                                                                                             | eliminar                              |
| **aprobar / rechazar**   | Decidir una petición: aprobar descuenta stock, rechazar guarda el motivo.                                                                                                                                 | aceptar, denegar, autorizar           |
| **entregar**             | Poner el material en manos del técnico: de ahí «entregada».                                                                                                                                               | servir, despachar                     |
| **recuperar / deshacer** | Traer de vuelta: recuperar del archivo o de la papelera, deshacer un cambio.                                                                                                                              | restaurar (salvo el icono), revertir  |
| **quitar**               | Sacar algo de una lista o de una relación: quitar un repuesto de la línea, quitar un documento del expediente. No es borrar: lo que se quita de una relación sigue existiendo.                            | usar «quitar» para borrar un registro |
| **ficha**                | La página de detalle de una entidad: la ficha del equipo, la del repuesto, la del usuario. Y «fichas archivadas», las que están en el archivo.                                                            | tarjeta, hoja, registro               |

## Cómo se escribe

- **Voz de taller, tuteo y frases cortas.** Lo que se lee en un botón es lo que
  hace: «Registrar intervención», «Aprobar y descontar stock», «Recuperar».
- **Minúscula de frase** en etiquetas, botones y títulos de sección. Solo el
  nombre del producto y las siglas van con su caja: Pulso Taller, INC-0123,
  AV, PDF, CSV, ZIP.
- **Dos puntos de elipsis** (`...`), no el carácter «…», como el resto de la app.
- **Sin jerga en inglés** en lo que se ve: se escribe «nº de parte», «enlace»,
  «archivo», «ajustes». Lo que en el código se llame `partNumber`, `upload` o
  `reference` no se enseña tal cual.
- **Los ejemplos entre comillas angulares** («Equipos», «Entrar») para citar un
  botón o una pestaña.

## Cómo se comprueba

Cuando se cambie una etiqueta, un texto o un mensaje, se busca el término en
`src` y se mira si lo que se va a escribir ya está dicho de otra manera en la
pantalla de al lado. Esta lista se mantiene a mano: si un concepto no está aquí,
es que hay que decidirlo antes de escribirlo.

## Fuera de alcance

Esta lista manda sobre la copia del producto. No manda sobre lo que escriben las
personas: las notas del cuaderno, los mensajes, las descripciones de una
incidencia o una petición y los datos de ejemplo del taller se quedan como los
escribió quien los escribió —ahí «se sustituyó la pieza» o «el fallo no se
reproduce» es una frase de un técnico, no una etiqueta del producto—. Tampoco
manda sobre marcas y nombres propios (Sony, HDC-3500) ni sobre los textos de los
componentes de la biblioteca de interfaz que no enseña la app.

Los datos de ejemplo se quedan tal y como están —incluidas sus frases sueltas—
porque son la muestra de lo que escribe la gente, no la voz del producto. Lo que
sí manda esta lista es sobre las etiquetas que la app pone encima de ellos:
el título de la columna, el texto que aparece cuando no hay nada, el aviso que
sale al guardar.
