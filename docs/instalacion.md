# Instalación y despliegue

Gusti usa Node.js 24, pnpm 10.34.9 y PostgreSQL 17. El despliegue tiene dos servicios, `app` y `db`. Next.js sirve desde la imagen standalone y ejecuta Prisma antes de aceptar conexiones. PostgreSQL permanece en una red privada de Docker.

## 1. Preparar el proyecto en Antigravity y subirlo a GitHub

1. Abre la carpeta raíz del proyecto en Antigravity. Deben verse `package.json`, `Dockerfile` y `docker-compose.yml` en la misma carpeta.
2. Verifica `git --version` desde la terminal del IDE. En macOS, instala las herramientas de línea de comandos si el sistema las solicita. Comprueba `git status`. Si la carpeta todavía carece de repositorio, usa **Initialize Repository** desde Control de código fuente o ejecuta `git init -b main`.
3. En GitHub, crea un repositorio privado vacío para el proyecto. Si ya existe un repositorio con historial, conserva su rama y su remoto. Revisa los archivos que se van a subir. Incluye `.env.example`, el lockfile, el esquema y todo el historial de migraciones. Excluye `.env`, llaves, respaldos, multimedia operativa, dependencias y compilaciones.
4. Desde el IDE revisa los cambios en Control de código fuente, crea el commit y publica la rama. También puedes usar la terminal:

```bash
git status --short --ignored
git add -A
git diff --cached --stat
git diff --cached
git commit -m "Preparar Gusti al Piatto para Coolify"
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Usa `git remote -v` antes de agregar el remoto y omite `git remote add` si ya está configurado. Autentícate en GitHub mediante el flujo del IDE o un gestor de credenciales. [Guía oficial para subir un proyecto local a GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## 2. Variables de entorno

| Variable | Uso | Valor |
| --- | --- | --- |
| `POSTGRES_DB` | Nombre de la base | `gusti` en una instalación nueva. Conserva el valor anterior al reutilizar volúmenes. |
| `POSTGRES_USER` | Usuario inicial utilizado por la aplicación y las migraciones | `gusti` en una instalación nueva. |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | Genera un secreto nuevo con `openssl rand -hex 32`. Usa caracteres válidos sin escape en una URL. |
| `APP_ORIGIN` | Origen público usado al validar solicitudes | `https://menu.ejemplo.mx`. Omite el puerto interno, la ruta y la barra final. |
| `COOKIE_SECURE` | Transporte de la cookie administrativa | `true` en producción por defecto. El override local usa `false`. |
| `ORDER_TRUST_PROXY` | Cuota de pedidos por dirección IP | `false` por defecto. Habilítala solo si el proxy sobrescribe `X-Real-IP` y controla todo el ingreso. |
| `GUSTI_EXTERNAL_VOLUMES` | Reutilizar volúmenes creados antes o administrados fuera de este proyecto | `false` para instalación nueva. Usa `true` junto con los dos nombres físicos al adoptar datos existentes. |
| `POSTGRES_VOLUME_NAME`, `MENU_MEDIA_VOLUME_NAME` | Nombres físicos opcionales de Docker | Vacíos para que Compose derive los nombres del proyecto. Para volúmenes externos usa los nombres que devuelve `docker inspect`. |
| `MEDIA_MAX_MB`, `MEDIA_VIDEO_MAX_SECONDS` | Límites de carga | `15` MB y `30` s por defecto. Mantén estos límites al medir un VPS pequeño. |
| `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY` | Integración opcional con Sheets | Deja las tres vacías hasta configurar la cuenta de servicio. |
| `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI`, `INTEGRATION_ENCRYPTION_KEY` | Integración opcional con Canva | Configura la URL exacta `https://menu.ejemplo.mx/api/admin/canva/callback` y genera la clave con `openssl rand -hex 32`. Conserva esa clave para restaurar credenciales cifradas. |
| `APP_PORT`, `POSTGRES_PORT` | Puertos del override local | `3000` y `5432`, publicados solo en loopback. |
| `DATABASE_URL` | Conexión para comandos Node ejecutados fuera de Docker | En Compose se construye con los valores de PostgreSQL y el host interno `db`. En desarrollo local actualiza la URL si cambias los puertos o credenciales. |

En Coolify define secretos como variables de ejecución. El proceso de compilación funciona sin acceso a la base ni a las integraciones. Cambiar las variables de inicialización de PostgreSQL con un volumen existente requiere actualizar las credenciales en la base antes de reiniciar la aplicación.

## 3. Instalación local con Docker

```bash
cp .env.example .env
chmod 600 .env
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
curl -fsS http://localhost:3000/api/health
```

Cambia la contraseña de ejemplo antes de arrancar. En la terminal Bash o Zsh, crea el primer administrador pasando su contraseña por entrada estándar:

```bash
read -rs GUSTI_ADMIN_PASSWORD
printf '%s\n' "$GUSTI_ADMIN_PASSWORD" | docker compose exec -T app node /app/runtime-tools/scripts/create-admin.mjs admin@example.com "Administración"
unset GUSTI_ADMIN_PASSWORD
```

Abre `http://localhost:3000/admin` y `http://localhost:3000/menu`. La instalación arranca con el catálogo vacío.

## 4. Instalación en Coolify

1. Prepara un registro DNS A para `menu.ejemplo.mx` que apunte al VPS. Si publicas un AAAA, comprueba que el VPS atiende IPv6. El proxy de Coolify debe recibir los puertos 80 y 443.
2. Crea un recurso de aplicación desde el repositorio de GitHub. Para un repositorio privado, autoriza el GitHub App de Coolify para ese repositorio o usa una clave de despliegue de lectura. Elige la rama que vas a desplegar.
3. Selecciona la estrategia **Docker Compose**, con directorio base `/` y ruta `/docker-compose.yml`. Confirma que la definición muestra únicamente `app` y `db` y que utiliza el archivo base de producción. [Configuración oficial de Docker Compose en Coolify](https://coolify.io/docs/applications/builds/docker-compose).
4. Define las variables de ejecución de la sección anterior. En **Domains** asigna exclusivamente el servicio `app` al dominio `https://menu.ejemplo.mx:3000`. El sufijo indica el puerto interno. Define `APP_ORIGIN=https://menu.ejemplo.mx` y habilita la redirección de HTTP a HTTPS. [Configuración oficial de dominios de Coolify](https://coolify.io/docs/applications/configuration/general).
5. Despliega y revisa los logs. Espera a que PostgreSQL acepte conexiones, Prisma termine y ambos servicios estén sanos. Si Prisma falla, revisa el error de migración antes de intervenir. Cuando el proceso termina con error, la política `unless-stopped` permite que Docker reintente. El healthcheck informa el estado de las dependencias.
6. Crea el administrador desde el host usando el proyecto Compose efectivo de Coolify y el comando anterior. Comprueba `curl -fsS https://menu.ejemplo.mx/api/health`, el inicio de sesión y un archivo multimedia de prueba. Activa un [respaldo externo](respaldos.md).

## 5. Actualizar y conservar los datos

- Antes de cambiar la rama desplegada, captura un respaldo externo y anota la revisión vigente. Mantén PostgreSQL en la versión mayor 17. Una actualización de versión mayor requiere un procedimiento propio de PostgreSQL.
- Conserva el mismo proyecto de Coolify. `postgres_data` monta `/var/lib/postgresql/data` y `menu_media` monta `/app/storage`. Ambos sobreviven al reemplazo de contenedores.
- Si vienes de la versión que usaba `compose.yaml` y los volúmenes `postgres-data` y `media-data`, inspecciona los contenedores antiguos **antes** de desplegar. Usa los nombres físicos actuales y configúralos como externos para conservar la base, archivos y etiquetas originales. Detén la pila anterior si vas a adoptar sus volúmenes desde otro proyecto. Usa un único PostgreSQL por volumen.

```bash
docker inspect --format '{{range .Mounts}}{{println .Destination .Name}}{{end}}' CONTENEDOR_DB
docker inspect --format '{{range .Mounts}}{{println .Destination .Name}}{{end}}' CONTENEDOR_APP
```

- Para adoptar esos datos, fija `GUSTI_EXTERNAL_VOLUMES=true` y copia los nombres a `POSTGRES_VOLUME_NAME` y `MENU_MEDIA_VOLUME_NAME`. Actualiza la ruta de Compose en Coolify a `/docker-compose.yml`. Comprueba los volúmenes en la definición y en el despliegue activo. Mantén esos valores en futuros despliegues. Docker comprueba que ambos volúmenes externos existan.
- En Coolify, despliega la nueva revisión y comprueba migraciones y healthchecks. Fuera de Coolify ejecuta `docker compose -f docker-compose.yml up -d --build --wait` desde el proyecto efectivo. Verifica catálogo, acceso y multimedia. Reserva la eliminación de volúmenes para entornos desechables.
- Si la actualización falla, revisa la compatibilidad del esquema antes de volver a una imagen anterior. Si debes recuperar los datos, restaura una copia en **volúmenes nuevos** y comprueba el entorno antes de cambiar el tráfico. [Procedimiento de respaldo y recuperación](respaldos.md).

## 6. Comprobar un VPS de 2 vCPU y 4 GB

La configuración inicia con límites de 1 vCPU y 1 GiB para Next.js y 0.75 vCPU y 768 MiB para PostgreSQL. El proceso Node tiene un máximo de 512 MiB para el espacio antiguo de V8. Son límites de los servicios en ejecución. La compilación de la imagen usa los recursos del host de compilación y requiere su propia medición.

1. Despliega primero en un entorno de prueba con un catálogo de unos 50 platillos y archivos multimedia representativos. En una terminal en el VPS, ejecuta `docker stats` para observar `app`, `db` y el resto de Coolify. Revisa también `free -h` y `df -h`.
2. Desde una máquina con Node.js 24, genera carga durante 30 segundos con cuatro solicitudes concurrentes. El script devuelve respuestas, errores y percentiles de tiempo hasta cabeceras.

```bash
node scripts/load-menu.mjs https://menu.ejemplo.mx 30 4
```

3. Registra CPU y memoria en reposo y bajo carga. Repite durante una carga de video, una exportación PNG y una actualización. Revisa el consumo del constructor y los reinicios por memoria. En caso de presión de memoria al compilar, usa un servidor de compilación separado o un registro de imágenes.
4. Verifica que el reinicio de los contenedores conserva el archivo de prueba y que el último snapshot remoto restaura correctamente. El resultado local de desarrollo sirve como referencia inicial. La certificación del tamaño del VPS depende de estas mediciones en Linux junto con Coolify.

### Resultado de la prueba local

El 24 de noviembre de 2026 se ejecutó la salida standalone en macOS ARM64 con Node.js 24 y PostgreSQL 18.7 nativo. El arranque aplicó las cinco migraciones a una base vacía y permitió crear el primer administrador. Se repitió el arranque con la base de prueba existente. Al detener PostgreSQL, `/api/health` devolvió HTTP 503.

Con 51 platillos, cuatro clientes y 20 segundos de carga HTTP local, se registraron 4,041 respuestas sin errores y un percentil 95 de 24.4 ms hasta las cabeceras. Los picos muestreados con `ps` fueron 337.4 MiB de RSS y 150.5 % de una CPU para Next.js. PostgreSQL marcó 47.7 MiB de RSS sumado entre procesos y 3.8 % de una CPU. El RSS sumado puede contar memoria compartida varias veces. La prueba se ejecutó sin los límites de CPU de Docker y midió las páginas HTML, no el procesamiento de medios. Quedan por medir la compilación y los contenedores en Ubuntu con PostgreSQL 17, Coolify y los límites configurados.
