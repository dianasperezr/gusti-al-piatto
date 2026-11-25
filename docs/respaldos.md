# Respaldos y recuperación

El respaldo diario combina un volcado lógico de PostgreSQL, el volumen multimedia, el archivo de configuración del despliegue, el Compose, la revisión desplegada y este procedimiento. El programa pausa la aplicación durante el volcado y la copia multimedia y la vuelve a iniciar antes de transferir el respaldo. Programa esa ventana fuera del horario de servicio y de los despliegues. Los volúmenes de Docker son almacenamiento operativo. La copia recuperable reside en un repositorio externo cifrado con restic.

## Activar el respaldo en Ubuntu o en el host de Coolify

1. Instala restic y habilita el CLI de Docker Compose en el host. Prepara un repositorio en otro proveedor o servidor. Guarda sus credenciales y la contraseña de cifrado en el gestor de secretos y conserva un acceso de recuperación fuera del VPS.
2. Copia `ops/backup/gusti-backup.env.example` a `/etc/gusti-backup.env`, con propietario root y modo `0600`. Configura el repositorio y sus credenciales. Guarda la contraseña en `RESTIC_PASSWORD_FILE` con modo `0600`. Inicializa un repositorio nuevo con `restic init` en una sesión que tenga esas variables disponibles.
3. Apunta `GUSTI_PROJECT_DIR`, `GUSTI_COMPOSE_PROJECT` y `GUSTI_ENV_FILE` al proyecto **ya desplegado**. Comprueba con `docker compose ps` que usas los mismos servicios y volúmenes de Coolify. Si Coolify inyecta secretos desde su panel, prepara el archivo protegido con los valores efectivos, incluida `INTEGRATION_ENCRYPTION_KEY`. Actualízalo cuando cambie la configuración. Registra la revisión con `GUSTI_RELEASE` si el checkout carece de metadatos de Git.
4. Instala y verifica el servicio. El temporizador se ejecuta a las 03:00 de Ciudad de México y recupera una ejecución omitida tras un reinicio.

```bash
sudo install -D -m 0755 ops/backup/gusti-backup.sh /usr/local/libexec/gusti-backup
sudo install -m 0644 ops/backup/gusti-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start gusti-backup.service
sudo journalctl -u gusti-backup.service -n 40 --no-pager
sudo systemctl enable --now gusti-backup.timer
sudo systemctl list-timers gusti-backup.timer
```

Comprueba que el snapshot figura en `restic snapshots --tag gusti`. Configura alertas por fallos y por antigüedad del último snapshot. Acuerda la retención con el restaurante y protege el bucket con controles de retención o versionado cuando el proveedor lo permita. Realiza una restauración de prueba periódica en un entorno aislado. [Documentación oficial de restic para respaldos](https://restic.readthedocs.io/en/stable/040_backup.html).

## Restaurar en un entorno nuevo

Ejecuta la restauración en un proyecto Compose nuevo con volúmenes vacíos. Conserva el proyecto anterior hasta verificar el reemplazo.

1. Carga las credenciales de restic. Identifica el snapshot con `restic snapshots --tag gusti`. Examina el manifiesto y la ruta del directorio `stage` mediante `restic ls ID_DEL_SNAPSHOT`. Restaura el subdirectorio en una ruta privada con `restic restore 'ID_DEL_SNAPSHOT:/var/lib/gusti-backup/stage' --target /ruta/privada/recuperacion`. Usa la ruta real que mostró `restic ls`. [Documentación oficial de restic para restauración](https://restic.readthedocs.io/en/stable/050_restore.html).
2. Obtén la revisión del manifiesto y devuelve la configuración al gestor de secretos o instálala como `.env` con modo `0600`. Verifica el nombre del proyecto, los secretos y los destinos de integración antes de iniciar el entorno. En una prueba aislada, desactiva las credenciales externas y usa un número de WhatsApp ficticio.
3. En el directorio de esa revisión, arranca únicamente PostgreSQL y restaura el volcado. El nombre de proyecto de ejemplo mantiene separados los volúmenes de producción.

```bash
export GUSTI_EXTERNAL_VOLUMES=false
export POSTGRES_VOLUME_NAME=gusti-recuperacion_postgres_data
export MENU_MEDIA_VOLUME_NAME=gusti-recuperacion_menu_media
dc=(docker compose -p gusti-recuperacion -f docker-compose.yml)
"${dc[@]}" up -d --wait db
"${dc[@]}" exec -T db sh -ec 'pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /ruta/privada/recuperacion/database.dump
"${dc[@]}" build app
"${dc[@]}" run --no-deps --rm -T --entrypoint tar app -C /app/storage -xf - < /ruta/privada/recuperacion/media.tar
"${dc[@]}" up -d --build --wait
"${dc[@]}" exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health").then(r => { if (!r.ok) process.exit(1) })'
```

Confirma que los nombres de ejemplo están disponibles o elige otros nombres nuevos. Las variables exportadas prevalecen sobre las del entorno respaldado. En una revisión anterior usa el nombre de Compose y las opciones de persistencia de esa revisión.

4. Comprueba el acceso administrativo, el catálogo público, imágenes y videos, el historial del pedido y `/api/health`. Comprueba las referencias multimedia con archivos de distintos tipos. Si la recuperación responde a una exposición de secretos, rota los secretos comprometidos y revoca sesiones antes de cambiar el tráfico. Registra la fecha del snapshot y el tiempo real de recuperación.

El directorio de recuperación contiene secretos en claro. Mantén acceso restringido y retíralo al terminar la prueba según la política de almacenamiento del host.
