# Infraestructura

- Usa el Dockerfile multietapa y la salida standalone de Next.js. La imagen ejecuta la aplicación con un usuario sin privilegios.
- Usa Compose para el entorno local. En producción, PostgreSQL se conecta solo a la red interna de base de datos. El override local añade acceso al puerto en loopback.
- Gestiona los secretos de despliegue en Coolify. Define dominio, recursos, persistencia y copias de seguridad cuando se conozca el entorno.
- Aplica las migraciones de producción antes de abrir el puerto de Next.js. El servicio app incluye el CLI de Prisma y reutiliza el mismo historial del entorno local.
- Respalda PostgreSQL, multimedia y configuración en un repositorio restic externo y cifrado. Instala el temporizador en el host y prueba la recuperación en volúmenes nuevos. [Procedimiento operativo](../docs/respaldos.md).
