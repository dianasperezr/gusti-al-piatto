# Roadmap

1. Base Next.js, Prisma, PostgreSQL, Docker y directivas.
2. Panel privado con roles, auditoría, catálogo, diseño, horarios y biblioteca multimedia.
3. Menú público, selector MXN/USD y carrito con solicitudes por WhatsApp.
4. Plantillas PDF/PNG, sincronización de catálogo con Google Sheets e importación a Canva.
5. Validación con credenciales reales, carga del menú del restaurante y despliegue en Coolify.
6. Operación en el VPS, copias de seguridad y seguimiento de incidencias.

El catálogo incorpora las operaciones masivas, las variantes, las promociones calculadas, los turnos con excepciones y las galerías. La validación con las cuentas externas y el despliegue corresponden al entorno del restaurante.

El constructor visual publica una copia del borrador y ofrece vista previa privada. La configuración monetaria incluye monedas habilitadas, conversión manual, redondeo y formato.

El carrito dispone de edición de variantes, notas por línea, resumen validado y un historial opcional de enlaces generados.

La base cuenta con un esquema normalizado y solicitudes de WhatsApp con partidas históricas. El traslado de los módulos que usan `Content` y la activación de Better Auth requieren sus propias etapas.

El despliegue Compose de dos servicios y la guía de Coolify quedan preparados. La medición con cuotas de Docker y las verificaciones de dominio, HTTPS y recuperación requieren el entorno de despliegue.
