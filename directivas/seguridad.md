# Seguridad

- Guarda los secretos en variables de entorno. En Git solo deben entrar ejemplos con valores ficticios.
- Mantén Prisma y las credenciales fuera del código cliente. Reserva `NEXT_PUBLIC_` para valores públicos.
- Aplica autenticación y autorización en el servidor antes de habilitar el panel o las operaciones de escritura.
- Minimiza los datos personales de pedidos y excluye datos sensibles de los logs.
- Antes de habilitar cargas, valida tamaño y tipo. Genera nombres de archivo en el servidor y controla el acceso.
- Aplica la limitación de solicitudes antes de procesar pedidos y exportaciones. Acepta la IP reenviada únicamente desde un proxy que sobrescriba el encabezado de confianza. Comprueba el origen en las solicitudes de navegador que corresponda.
