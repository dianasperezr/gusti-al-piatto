# Arquitectura

- `src/app` contiene rutas, layouts y endpoints de App Router. Delega la lógica de negocio a los módulos.
- `src/modules` agrupa las funcionalidades por dominio. Cada módulo puede incorporar sus propias validaciones, servicios y componentes cuando los necesite.
- `src/components` contiene componentes compartidos y `src/components/ui`, las primitivas de shadcn/ui.
- `src/lib` aloja configuración y utilidades compartidas. `src/services` contiene adaptadores externos. `src/hooks` y `src/types` se reservan para código compartido.
- `prisma` contiene el esquema y el historial de migraciones. `scripts` se reserva para tareas auxiliares y `tests` para pruebas.
- `storage` se reserva para multimedia local, fuera del directorio público.
- Conserva los componentes de servidor por defecto. Usa componentes cliente para formularios e interacciones.
