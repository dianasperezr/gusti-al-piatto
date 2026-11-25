# Decisiones técnicas

- Un solo restaurante con configuración centralizada. PostgreSQL proporciona claves foráneas para categorías, paquetes, multimedia, sesiones y auditoría.
- Los registros de contenido comparten campos básicos y validan sus opciones con un esquema Zod por tipo. Las relaciones de catálogo y la identidad de usuario viven en columnas o tablas dedicadas.
- El menú público excluye borradores y promociones fuera de su vigencia. Los paquetes no se pueden solicitar cuando alguno de sus platillos deja de estar disponible. Los turnos pueden pasar de medianoche.
- El carrito conserva identificadores y cantidades en el navegador. La API recalcula el total y construye el enlace de WhatsApp con los precios vigentes.
- Multimedia almacena los archivos en disco persistente y sus metadatos en PostgreSQL. Las imágenes se normalizan a WebP. Los videos admiten rangos HTTP.
- El PDF y el PNG comparten una cuadrícula de dos columnas, con fotos del catálogo, encabezado por página y logotipo por plantilla. El titular, los colores y la posición del logotipo se guardan con el formato en las opciones de la plantilla.
- Sheets sincroniza categorías y platillos por ID en ambas direcciones mediante acciones del administrador. Se comparan las huellas de ambos lados antes de sobrescribir el destino. Google Sheets carece de una operación de comparación y escritura atómica para este flujo.
- Canva Connect usa OAuth con PKCE para importar una exportación PDF. El servidor cifra los tokens guardados en PostgreSQL.
- La imagen final distribuye la salida standalone, sus recursos estáticos y un paquete independiente con el CLI de Prisma y las herramientas de arranque. `app` aplica el historial de Prisma antes de ejecutar Next.js y usa un pool de cinco conexiones. `/api/health` devuelve HTTP 503 cuando falla la conexión a PostgreSQL.

## Gestión del catálogo

- Los importes persistentes usan columnas enteras para precios y valores enteros en las configuraciones de complementos y promociones. La migración convierte el catálogo existente y conserva UUID, vínculos y archivos.
- Los horarios se interpretan en la zona IANA del restaurante, incluido el día de apertura para turnos nocturnos. El menú refresca los datos mientras la pestaña está visible y el servidor revalida las solicitudes de WhatsApp.
- Los archivos nuevos usan un almacenamiento en disco con claves relativas, carpetas por tipo y miniaturas separadas. Sharp redimensiona y FFmpeg transcodifica MP4, MOV y WebM a H.264 en MP4 con arranque rápido. El ejecutable seleccionado proviene de la ruta configurada, del directorio local de herramientas o de PATH.

## Diseño visual y moneda

- PostgreSQL guarda dos documentos JSON validados con Zod. La vista previa privada consume el borrador y el menú público consume la versión publicada. Las secciones aceptan texto, enlaces HTTP(S), referencias a multimedia y componentes predefinidos.
- El editor usa dnd-kit para ordenar con puntero, pantalla táctil y teclado. La vista previa usa el renderizador público dentro de un marco de ancho configurable.
- La conversión usa enteros y aritmética BigInt a partir de un tipo de cambio manual de hasta seis decimales. El servidor rechaza pedidos con una moneda deshabilitada, vuelve a cotizar los importes y devuelve el total original y los datos del tipo de cambio.

## Solicitudes de pedido

- El navegador conserva la selección y las notas por línea. El servidor cotiza dos veces, al mostrar el resumen y al confirmar, con datos actuales del catálogo y los horarios. Una huella vincula la confirmación al resumen exacto.
- El flujo usa Click to Chat. El registro opcional conserva la cotización y la referencia cuando se genera el enlace. El estado registrado describe una acción local y la confirmación del restaurante sucede en WhatsApp.
- El mensaje muestra la selección y un único total. Los importes por línea y la referencia se conservan en la cotización y el historial administrativo.

## Esquema PostgreSQL normalizado

- Las tablas nuevas usan UUID nativo, nombres SQL en snake_case y relaciones Prisma. Los importes se expresan en centavos enteros y las tasas en `DECIMAL(24,12)`. En `currency_settings`, la tasa expresa unidades de la moneda indicada por cada unidad de la moneda base. Los horarios guardan horas locales y las fechas de excepción usan el calendario de la zona del restaurante.
- Esta migración conserva las tablas de contenido y estado que sirven al panel y al menú. El catálogo, el diseño, la disponibilidad y las integraciones se trasladarán por dominio junto con sus lecturas y escrituras. Las tablas normalizadas de esos dominios quedan listas para datos de prueba.
- La tabla `users` incorpora los campos básicos de Better Auth, junto con los modelos de sesión, cuenta y verificación. El panel sigue usando sus sesiones y hashes administrativos actuales hasta implementar el cambio de autenticación. [Esquema oficial de Better Auth](https://better-auth.com/docs/concepts/database#core-schema).
- Las solicitudes usan partidas con nombre, importes y configuración congelados. El identificador de la partida es histórico y admite platillos o paquetes que se hayan eliminado; su clave foránea pertenece a la solicitud. La migración conserva la cotización original y materializa las partidas existentes. La tasa de una solicitud conserva la dirección anotada en la cotización. El nombre opcional del cliente sigue formando parte del mensaje de WhatsApp y se omite en el historial.
- La migración SQL añade restricciones de dominio e índices únicos parciales para las imágenes principales. Prisma administra el resto de las claves e índices.

## Experiencia del panel y del menú

- El panel comparte la navegación por rol y muestra el progreso dentro del enlace durante una transición. Los diálogos nativos gestionan el foco y permiten cancelar con Escape.
- Los listados de catálogo y horarios se muestran a ancho completo. El formulario se abre desde la URL del registro o desde el enlace de alta. Los horarios usan el mismo modelo de reglas con una selección semanal o por fecha.
- La carga múltiple envía cada archivo por separado a la acción existente. Así conserva los límites por archivo, permite reintentar fallos individuales y mantiene la clasificación de la cola.
- El menú público y su vista previa comparten los componentes y formatos del constructor. Los diseños guardados con la configuración de carrito anterior conservan la paleta y los títulos que mostraban. Los diseños nuevos aplican los títulos y colores editados directamente.
- La búsqueda ignora acentos y consulta el nombre, la descripción, los ingredientes y la categoría. Las tarjetas muestran una miniatura cuando hay multimedia asociada. El detalle, las variantes y la galería se abren en un diálogo.
- El carrito ocupa la pantalla completa y reserva un área desplazable para las partidas. Los importes aparecen con el mismo peso visual que el resto de la información secundaria.
- El editor de platillos conserva los indicadores de publicación, actividad y destacado detrás de un solo desplegable. La lista de variantes usa los mismos grupos y validaciones que el carrito.
- La migración de etiquetas y alérgenos elimina las columnas normalizadas y las claves del JSON de platillos. Los ingredientes y la información alimentaria siguen disponibles.

## Rendimiento y operación

- El desarrollo local usa Webpack, igual que la compilación de producción. Tailwind busca clases en los directorios de interfaz para limitar la vigilancia de archivos durante la recarga en desarrollo.

- El servidor almacena durante 60 segundos los datos públicos del catálogo en la caché de Next.js. Las mutaciones invalidan la etiqueta del menú. Los horarios se evalúan al renderizar y la vista previa y el checkout consultan datos vigentes. Los clientes con reglas temporales consultan cambios mientras el menú está visible.
- El panel consulta 24 elementos por página y un elemento adicional para detectar la siguiente página. La edición consulta el registro elegido y sus archivos asociados. El selector multimedia exige una sesión y pagina sus búsquedas.
- Los límites de pedidos, exportaciones y sincronización están acotados en memoria por proceso. Los intentos de acceso conservan además una ventana persistente por correo y global. Los límites del proxy permiten aplicar una cuota compartida cuando haya varias réplicas.
- El respaldo captura PostgreSQL y multimedia mientras se detienen las escrituras de la aplicación. La transferencia externa se realiza después de volver a iniciar el servicio. Restic cifra el repositorio y el procedimiento restaura en volúmenes nuevos.

### Medición local inicial

Se compararon dos compilaciones de producción en loopback contra PostgreSQL local, con 51 platillos y 12 referencias multimedia. En cada compilación se hicieron 30 solicitudes HTTP secuenciales a `/menu` después del calentamiento. La mediana hasta recibir las cabeceras pasó de 15.6 ms a 6.9 ms y el percentil 95 pasó de 44.1 ms a 42.6 ms. El documento inicial pasó de 16 elementos de video a cero. Los videos se crean tras la interacción.

La prueba mide la respuesta HTTP del servidor. Quedan por medir LCP, INP y CLS en un navegador en el VPS, con red móvil y con la biblioteca real.
