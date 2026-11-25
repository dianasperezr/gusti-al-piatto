# Gusti Al Piatto — demostración exportada

Este paquete contiene una copia del código de la demostración y sus imágenes, lista para abrir como carpeta de proyecto y continuar en Antigravity. No utiliza WordPress, dependencias npm ni compilación.

## Comenzar
1. Descomprime el ZIP.
2. Abre la carpeta `Gusti-Antigravity` en tu editor/proyecto.
3. Lee `docs/CONTEXTO.md` y `docs/DISENO.md`.
4. Copia el contenido de `PROMPT-ANTIGRAVITY.md` en el asistente del proyecto.
5. Para visualizarla, ejecuta desde esta carpeta: `python3 -m http.server 8080 --directory dist` (en Windows puede ser `python` en lugar de `python3`). Abre `http://localhost:8080`.

Usa un servidor HTTP local: abrir index.html directamente con doble clic puede impedir la carga de catalog.json. Si Python no está instalado, utiliza el servidor de vista previa de tu editor apuntando a dist.

## Archivos
- `dist/index.html`: página principal.
- `dist/carrito.html`: carrito independiente.
- `dist/style.css`: diseño completo y reglas responsive.
- `dist/app.js`: categorías, buscador y detalle de productos.
- `dist/order.js`: almacenamiento local, formato del mensaje y enlace WhatsApp.
- `dist/cart.js`: cantidades, eliminación, subtotal, notas y vista previa del mensaje.
- `dist/catalog.json`: 43 productos con precios provisionales.
- `dist/assets/`: logo y fotografías usadas en la demostración.
- `tools/prepare_catalog_original.py`: script histórico de extracción del menú. No es necesario para ejecutar el sitio; requiere PyMuPDF y el PDF original, no incluido. Tiene una ruta del entorno original que debe adaptarse antes de reutilizarlo. No ejecutarlo sobre el catálogo editado sin respaldo.
- `docs/`: contexto, diseño, estado y comprobaciones.
- `MANIFEST-SHA256.txt`: inventario y huellas de integridad de esta exportación.

## Alcance de la copia
Los archivos de dist se exportan sin cambios respecto al commit ba78fed88e5b76c9436d8037f197aa6046c74920. No se incluyen credenciales, historial Git ni configuración de alojamiento vinculada a la cuenta original. La interfaz funciona por sí misma; la protección privada del alojamiento original no se exporta. No se incluyen datos del carrito de ningún navegador.

Referencia visual publicada: https://gusti-menu-narvarte.dianasperezr.chatgpt.site (puede requerir acceso de la propietaria).

No es una entrega final de todo el alcance contratado. Consulta los pendientes antes de habilitar pedidos o publicar para clientes reales.
