# Dirección de diseño que debe conservarse

## Intención
Restaurante italiano de barrio, cálido y artesanal, con protagonismo de la comida. Identidad de Gusti Al Piatto y frase «Del corazón a la mesa». La usuaria aprobó la estructura general; pidió cambiar el proceso de pedidos tomando como referencia un catálogo con carrito y salida a WhatsApp. Esa referencia es funcional, no una solicitud de copiar la marca o estética de Nutri Life Club.

## Paleta exacta de style.css
| Uso | Valor |
| --- | --- |
| Fondo crema | #f8f3e8 |
| Texto principal | #29291f |
| Terracota de marca | #a94f2b |
| Oliva | #56603b |
| Líneas | #ded8c9 |
| Fondo de historia gastronómica | #e8e8d8 |
| Pie oscuro | #292d23 |
| Acción WhatsApp | #17763d |

Hay tonos auxiliares en el CSS. Mantener style.css como referencia visual exacta, no sustituir por una paleta aproximada.

## Tipografía
- Titulares: Georgia, Times New Roman, serif; peso normal, espaciado negativo.
- Cuerpo/interfaz: Arial, Helvetica, sans-serif, base 16 px y altura de línea 1.5.
- Énfasis de titulares: cursiva terracota.
- Etiquetas superiores: mayúsculas pequeñas con espaciado amplio.
- No hay fuentes externas ni archivos tipográficos de pago.

## Estructura de inicio, en orden
1. Franja «Versión de revisión».
2. Cabecera terracota: logo a la izquierda; menú, visita y carrito a la derecha.
3. Portada partida en dos columnas: titular grande y CTA a la izquierda; foto de pizza a la derecha. Recuadro crema superpuesto con sombra terracota.
4. Franja oliva horizontal con mensajes cortos.
5. Menú: título, categorías en botones redondeados, buscador y lista de platillos en dos columnas. Cada entrada muestra nombre, descripción, precio y Agregar.
6. Nota sobre bebidas/promociones pendientes.
7. Bloque con foto de pasta y texto «Hoy se come con gusto».
8. Dirección, enlace a Maps y teléfonos.
9. Pie oscuro.

## Catálogo e interacción
No transformar automáticamente el menú en una cuadrícula de grandes fotografías: la estructura actual usa filas editoriales con separadores finos y solo muestra imagen cuando existe una real asociada. Los títulos abren un diálogo de detalle. Buscar un ingrediente o nombre consulta todas las categorías y muestra categoría para evitar confundir productos homónimos.

## Carrito
Página separada, fondo crema, tarjetas blancas con bordes suaves y radios de 18 px. Imagen del producto si existe; si no, bloque neutro con la palabra Gusti. Nombre, categoría y precio unitario; controles de cantidad, importe de línea y Eliminar. Resumen, notas y botón ancho verde de WhatsApp. Sin pago en línea.

## Recursos originales incluidos
- `logo.png`: recorte de la identidad del material del cliente; provisional, sustituir por logo original de calidad cuando llegue.
- `pizza.png`: fotografía usada en la portada.
- `menu-0-0.jpeg`: foto asociada al producto de champiñones.
- `menu-0-2.jpeg`: fotografía de pasta del bloque gastronómico.
No son fotos individuales de todos los productos. No asignar una misma pizza o pasta como si representara platillos distintos. Las imágenes pueden reemplazarse manteniendo proporción, encuadre y diseño.

## Responsive y accesibilidad
El CSS cambia a una columna bajo 800 px; el carrito tiene ajustes bajo 600 px. Categorías con desplazamiento horizontal en móvil. Diálogos nativos, etiquetas accesibles, estilos de foco y soporte de movimiento reducido.
Pendiente importante detectado al exportar: la regla móvil `nav>a{display:none}` también puede ocultar el enlace Carrito y el regreso al menú, porque ahora son enlaces. Corregir selectivamente, por ejemplo preservando `.bag` y el enlace de regreso. No se modificó el original durante la exportación. Revisar además contraste de textos secundarios, tamaños pequeños, botones táctiles y navegación por teclado en móvil.
