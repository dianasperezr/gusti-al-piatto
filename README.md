# Gusti al piatto

CMS para un restaurante. El catálogo vive en `/menu` y el panel privado en `/admin`. La aplicación usa Next.js, Prisma y PostgreSQL.

## Desarrollo

Requisitos: Node.js 24, pnpm 10.34.9 y PostgreSQL. Puedes levantar PostgreSQL con Docker Compose.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:deploy
pnpm dev
```

Abre <http://localhost:3000/menu> o <http://localhost:3000/admin>. La base arranca vacía. Crea el primer administrador desde el mismo directorio. Usa tu correo y escribe una contraseña de al menos 12 caracteres cuando el comando `read` la espere.

```bash
read -rs GUSTI_ADMIN_PASSWORD
printf '%s\n' "$GUSTI_ADMIN_PASSWORD" | pnpm admin:create admin@example.com "Administración"
unset GUSTI_ADMIN_PASSWORD
```

Entra al panel, publica una categoría y un platillo y ajusta el diseño y las monedas. En **Pedidos y WhatsApp**, guarda el número internacional sin espacios ni `+` y activa las solicitudes. La restricción por horarios es opcional y usa la zona horaria IANA del restaurante. Configura en Monedas y precios el tipo de cambio para los importes en moneda alternativa.

El carrito se guarda en el navegador. El servidor comprueba la disponibilidad y calcula el importe a partir del catálogo vigente. El cliente abre WhatsApp con el mensaje, y la confirmación se realiza en esa conversación.

El rol Administrador gestiona cuentas, auditoría, integraciones, monedas y pedidos. El rol Editor administra el contenido y puede descargar las exportaciones. Las cuentas nuevas se crean en el panel y su acceso se puede desactivar.

## Docker y Coolify

El [manual de instalación y despliegue](docs/instalacion.md) cubre la publicación desde Antigravity, las variables de entorno, DNS y HTTPS, la actualización y la prueba de consumo en un VPS de 2 vCPU y 4 GB.

Para una instalación local, copia `.env.example` a `.env`, sustituye la contraseña de ejemplo y ejecuta:

```bash
docker compose up -d --build --wait
curl -fsS http://localhost:3000/api/health
```

La aplicación espera a PostgreSQL y aplica las migraciones antes de abrir el puerto. En producción usa `docker-compose.yml` sin el override local. Antes de actualizar una instalación antigua, identifica y adopta los volúmenes existentes siguiendo el manual. Consulta el [procedimiento de respaldo y recuperación](docs/respaldos.md) para activar las copias externas.

## Integraciones

### Google Sheets

Habilita Sheets API, crea una cuenta de servicio de Google y comparte la hoja con esa cuenta como editora. Crea una pestaña dedicada llamada `Gusti`. Configura `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_KEY` en el servidor. La clave admite saltos de línea reales o secuencias literales `\n`.

En **Google Sheets**, envía primero el catálogo para crear los encabezados. Importa los cambios después de editar la pestaña. Conserva los UUID y usa `CATEGORY` o `PRODUCT` en «Tipo». Puedes agregar filas con UUID nuevos y únicos. La importación aplica los datos por ID, conserva los archivos asociados y deja intactos los registros de las filas omitidas. El panel pide confirmación explícita si detecta cambios en el destino desde la última sincronización. Evita editar la pestaña mientras corre una exportación.

[Documentación oficial de Google Sheets API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).

### Canva

Registra una integración de Canva y concede `design:content:write`. Configura `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` y `CANVA_REDIRECT_URI` (URL exacta de `/api/admin/canva/callback`). Genera una clave con `openssl rand -hex 32` y guárdala en `INTEGRATION_ENCRYPTION_KEY`. Conserva la clave para poder leer las autorizaciones guardadas.

Conecta una cuenta desde el panel, publica una plantilla, envía el PDF y consulta el resultado para abrirlo en Canva. La cuenta y la aplicación deben tener acceso a la API de importación. Las descargas propias de PDF y PNG están disponibles desde **Plantillas y exportaciones**.

[Documentación oficial de Canva para importación de diseños](https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/create-design-import-job/).

## Verificación

```bash
pnpm db:validate
pnpm lint --max-warnings 0
pnpm test
pnpm typecheck
pnpm build
docker compose config --quiet
```

Consulta [las directivas](directivas/directivas.md), [las decisiones técnicas](docs/decisiones-tecnicas.md) y [el roadmap](directivas/roadmap.md) antes de cambiar la arquitectura o el despliegue.

## Rendimiento y controles de seguridad

- El menú usa la caché de datos de Next.js para el catálogo publicado, con invalidación al guardar, publicar, sincronizar o cambiar archivos. La disponibilidad se evalúa a la hora de cada respuesta. La confirmación del pedido vuelve a consultar PostgreSQL y valida cantidades, variantes e importes.
- Las imágenes subidas se normalizan a WebP y la mayoría se carga de forma diferida. Los videos muestran una portada y descargan el archivo al pulsar Reproducir.
- El panel pagina catálogo, multimedia, cuentas, auditoría e historial de solicitudes. Los filtros de catálogo buscan en toda la base. Los editores cargan solo los archivos ya asociados y buscan otros archivos cuando lo solicitas.
- El pedido acepta JSON del mismo origen con un máximo de 32 KiB. El límite es de 180 solicitudes por minuto por proceso. Puedes habilitar 30 por minuto por cliente con `ORDER_TRUST_PROXY=true` solo si el proxy sobrescribe `X-Real-IP` y la aplicación solo recibe tráfico a través de ese proxy. En varias réplicas aplica además un límite compartido en el proxy.
- Las sesiones administrativas usan cookies HttpOnly y tokens guardados como hashes. El inicio de sesión limita intentos en PostgreSQL. Las exportaciones y operaciones de Sheets tienen límites propios. Sheets conserva la autorización de administrador y rechaza otra sincronización mientras una está en curso.

## Esquema PostgreSQL y datos de prueba

Para actualizar una instalación existente, respalda PostgreSQL y ejecuta `pnpm db:deploy` antes de arrancar la versión nueva. La migración conserva usuarios, sesiones, archivos e historial de WhatsApp.

Apunta `DATABASE_URL` a una base desechable para cargar la semilla:

```bash
pnpm db:deploy
pnpm db:generate
GUSTI_SEED_TEST=1 pnpm db:seed
```

La semilla es idempotente. Incluye una categoría, un platillo con variantes y complementos, un paquete, monedas y una solicitud de ejemplo. Los datos del catálogo sembrado se consultan en las tablas normalizadas. El menú y el panel de catálogo todavía consultan `Content`.

## Administración del catálogo

- La barra lateral agrupa el catálogo, las herramientas de operación y las integraciones. **Configuración** reúne usuarios y auditoría. **Vista previa** abre el borrador privado en otra pestaña y **Menú** abre la carta publicada.
- En **Platillos**, busca por nombre, slug, UUID o identificador de Sheets. Cambia entre tabla y tarjetas, selecciona filas para aplicar cambios en lote y arrastra los registros para ordenar. Los botones de subir y bajar permiten ordenar con teclado. Archivar conserva las relaciones y permite restaurar el registro como borrador.
- Para **variantes y complementos**, escribe un grupo por línea. Por ejemplo: `Tamaño | 1 | 1 | Sencilla=0 | Doble=35` y `Extras | 0 | 2 | Queso=15 | Tocino=20`. Los importes del formulario se leen en la moneda base y se guardan en centavos enteros. Cambiar la moneda base convierte los importes persistidos con el tipo de cambio indicado y redondea al centavo.
- En **Horarios y disponibilidad**, publica reglas del restaurante, reglas dirigidas al menú o cierres especiales. Selecciona días, fecha de excepción si aplica, objetivos, prioridad y comportamiento. En reglas simultáneas gana la de mayor prioridad que esté dentro de horario. Si ninguna está activa, se aplica el comportamiento exterior de la de mayor prioridad. Una categoría oculta también oculta su contenido. Para un cierre de día completo configura la misma hora inicial y final.
- En **Promociones**, un precio fijo por grupo se aplica a cada grupo completo de la cantidad indicada. Una promoción de dos unidades a 199 pesos usa 2 como mínimo y 19900 como importe. Los complementos se cobran aparte. La promoción de mayor prioridad se aplica primero y la acumulación requiere que las promociones involucradas la permitan.
- Los **paquetes** admiten precio fijo o calculado a partir de sus componentes y cantidades. Publica una plantilla de paquetes o promociones para descargar un PDF/PNG o enviar el PDF a Canva.
- En **Multimedia**, sube una imagen o video, elige su carpeta y adjúntalo como principal o agrégalo a una galería. Reemplazar conserva las referencias. Los recortes usan porcentajes sobre la imagen orientada. Los límites se ajustan con `MEDIA_MAX_MB` y `MEDIA_VIDEO_MAX_SECONDS`. La imagen Docker incluye FFmpeg y FFprobe. En ejecución local instala ambos para procesar video o configura `FFMPEG_PATH` y `FFPROBE_PATH`.
- Puedes seleccionar o arrastrar varios archivos a la cola multimedia. La clasificación se aplica a la cola y cada archivo muestra su resultado. Para adjuntar una portada o aplicar un recorte, usa **Subir un archivo con recorte o portada**.
- La nueva hoja de Sheets usa las columnas A a K, con precio en moneda base e identificador externo. El UUID sigue siendo la clave de sincronización. Al migrar una hoja anterior, envía el catálogo para actualizar los encabezados y verifica la pestaña antes de volver a importar.

Las imágenes, videos y miniaturas nuevas viven bajo `/app/storage/uploads/` en Docker. Los archivos cargados antes del cambio siguen leyéndose desde su ubicación anterior en el mismo volumen.

## Constructor visual y monedas

En **Diseño del menú** o **Constructor de secciones**, agrega componentes, configura sus propiedades y arrastra desde el asa para cambiar el orden. Con teclado, enfoca el asa, pulsa espacio, usa las flechas y pulsa espacio de nuevo. **Guardar y ver vista previa** abre el borrador en un marco de escritorio o móvil. **Publicar diseño** reemplaza el diseño público con esa versión. Los cambios de contacto, disponibilidad y moneda se gestionan en sus paneles y se reflejan en el diseño publicado.

En **Monedas y precios**, habilita MXN y USD, elige la moneda base y registra el tipo de cambio en cualquiera de las dos direcciones. La base permanece habilitada. El servidor registra la fecha cuando cambia el valor o la dirección. Puedes configurar el redondeo de conversiones y mostrar símbolos, códigos ISO o ambos. La selección del cliente dura lo que dura la sesión de la pestaña.

Los precios alternativos se derivan del único importe en moneda base. Los precios fijos USD heredados se conservan en la base de datos como datos históricos. La columna histórica de USD en Google Sheets se deja vacía en las exportaciones nuevas. El servidor vuelve a calcular el pedido y conserva en la cotización el total base y el tipo de cambio aplicado. El mensaje usa siempre el código ISO de la moneda seleccionada y distingue conversión de referencia de tipo de cambio garantizado.

## Carrito y solicitudes por WhatsApp

En móvil, el carrito ocupa la pantalla y mantiene el total y el siguiente paso a la vista. En escritorio usa el panel lateral o el modal centrado según el diseño publicado.

En **Pedidos y WhatsApp**, configura el número internacional completo, la moneda principal que acepta el restaurante, los textos, la disponibilidad y el registro opcional. **Monedas visibles** lleva a la configuración monetaria compartida por el menú y el carrito. Puedes usar los horarios generales y añadir una ventana específica para pedidos. Los cierres especiales se respetan en ambos casos.

El resumen se valida en el servidor. Si cambia un importe, vuelve a confirmar el resumen actualizado. Al confirmarlo se genera un enlace oficial con el mensaje y la referencia. El cliente revisa y envía el mensaje dentro de WhatsApp o WhatsApp Web. [Documentación oficial de Click to Chat](https://faq.whatsapp.com/5913398998672934).

Al activar el historial se guardan los importes, el tipo de cambio, los artículos y sus notas. El nombre opcional se incluye en el mensaje de WhatsApp. El historial distingue entre enlace generado y referencia cancelada localmente. La cancelación local afecta al registro administrativo. Los mensajes compartidos se gestionan en WhatsApp.

## Demostración local

Para abrir el catálogo de ejemplo, prepara un PostgreSQL local con una base llamada
`gusti_demo`. Configura `DATABASE_URL` y `MEDIA_DIRECTORY` en `.env` con los datos de
esa base y un directorio exclusivo para multimedia de la demo. Luego ejecuta:

```bash
pnpm db:deploy
pnpm db:generate
pnpm db:demo
pnpm dev --hostname 127.0.0.1
```

Usa `admin@gusti.test` y `Gusti-Demo-Local-2026` para el panel. Las credenciales y el
número para WhatsApp son ficticios y están reservados al entorno local. La semilla
agrega categorías, platillos, variantes, un paquete, una promoción, horarios,
monedas, multimedia, un diseño publicado y una plantilla de exportación.
