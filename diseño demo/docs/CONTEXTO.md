# Contexto y estado real

## Cliente y objetivo
Gusti Al Piatto, pizza a la leña en Narvarte Poniente, Ciudad de México. La usuaria desarrolla el proyecto para su cliente. Objetivos iniciales: aumentar ventas y visibilidad en Google Maps; el menú web es una pieza del proyecto, no garantiza posiciones en Maps.
El cliente rechazó WordPress. Se acordó una entrega en 10 días, pero este paquete no establece fecha inicial ni si son hábiles o naturales.
Dirección usada: Av. Eugenia 1308, Local A, Narvarte Poniente. Teléfonos impresos: 55 9595 8623 y 55 7049 3405. Ninguno fue confirmado como destino de WhatsApp. No utilizar el teléfono de la referencia de Nutri Life Club.

## Lo implementado
- Sitio estático HTML/CSS/JavaScript sin framework ni backend.
- Inicio, presentación, menú por categorías, buscador y diálogos de detalle.
- 43 productos: 6 entradas/ensaladas, 10 pastas, 4 calzones, 4 pizzas clásicas, 14 pizzas italianas y 5 postres.
- Carrito en página propia: agregar, sumar/restar (máximo 99 por ítem), eliminar, vaciar, subtotal y notas.
- Persistencia del carrito en localStorage (`gusti-cart`) y notas en sessionStorage (`gusti-notes`). No es una base de datos ni sincroniza dispositivos.
- Texto de pedido preparado con cantidades, categoría, importes y notas. Copia al portapapeles con alternativa manual.
- `GustiOrder.phone = null`: el botón presenta una vista previa, no envía nada. La función URL ya está prevista para un número confirmado con código de país y solo dígitos.
- Enlace a Google Maps y teléfonos clicables.
- Soporte básico de `available:false` para bloquear altas; los datos actuales no constituyen inventario verificado.

## Flujo deseado de pedidos
Menú → Agregar → Carrito → ajustar cantidades / eliminar → revisar subtotal y notas → abrir WhatsApp con mensaje preparado → el visitante pulsa Enviar en WhatsApp → el restaurante confirma disponibilidad, precio y entrega/recolección.
Abrir WhatsApp no significa que el pedido se haya enviado o aceptado. No registrar una venta confirmada solo por abrir el enlace.

## Datos provisionales
Los materiales recibidos incluyen menús con precios diferentes. El catálogo es de revisión y requiere validación del cliente. Bebidas, extras, promociones, horarios, fotos individuales y número WhatsApp siguen pendientes. No activar promociones de fotos antiguas automáticamente.
El límite de carga inicial acordado es 50 productos; el texto previo también decía 55 en un párrafo, inconsistencia por resolver. No imponer un límite permanente al catálogo futuro por esa cifra.

## Alcance previsto, todavía NO implementado
- Panel administrativo privado y autenticación.
- Base de datos y almacenamiento de imágenes.
- Altas/ediciones/bajas del catálogo desde el panel.
- Sincronización bidireccional con Google Sheets y política de conflictos.
- Gestión de promociones y platillos destacados/temporada.
- Selección de menú e impresión/PDF y diseño del menú impreso.
- QR estable vinculado al dominio final.
- Dominio y hosting finales, SSL, SEO de producción, formación y documentación de entrega.
La demo contiene `noindex,nofollow`; es deliberado mientras se revisa. La privacidad del despliegue original pertenece al proveedor de alojamiento, no al HTML exportado.

## Verificación y límites
En la sesión original se verificó en navegador de escritorio: agregar dos productos, subtotal $440; aumentar Garlic Bread a dos unidades, subtotal $640; recargar y conservar selección; añadir notas al mensaje; eliminar Margherita y ver $400; vaciar carrito y mostrar estado vacío. No se envió un pedido real y no se verificó exhaustivamente en móvil.
Al exportar se comprobaron integridad de archivos, sintaxis JavaScript, catálogo y referencias locales. El diseño está preservado; no se hizo rediseño ni despliegue nuevo.

## Continuación sugerida
1. Arrancar la copia y conservar la apariencia existente.
2. Corregir navegación móvil y verificar accesibilidad.
3. Confirmar datos/precios/WhatsApp con cliente.
4. Habilitar WhatsApp y cambiar los textos de prueba solo cuando corresponda; probar mensaje sin enviarlo a terceros automáticamente.
5. Planear backend/admin y Sheets separadamente; elegir tecnología según hosting y requisitos confirmados.
