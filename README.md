# Frescos Market — Catálogo de verduras y frutas con pedido por WhatsApp

Sitio estático (HTML/CSS/JS puro, sin build ni `package.json`). Repo independiente de `online` (NIDO), mismo enfoque de stack.

## Estructura

```
frescos-market/
├── index.html
├── style.css
├── script.js
└── assets/          # vacío por ahora, para futuras fotos de producto
```

## Qué hace

- Catálogo de hortalizas (papa, tomate, cebolla, zanahoria, pimentón, cilantro) y frutas (aguacate, manzana, banano, naranja, mango, fresa), definido como array en `script.js` (`PRODUCTS`).
- Cada producto tiene selector de cantidad (+/-) y botón "Agregar" que suma al carrito.
- El carrito vive en `localStorage` (`fm-cart`) para no perderse si se recarga la página.
- El botón "Enviar pedido por WhatsApp" arma un mensaje de texto con el detalle del pedido y el total, y abre `https://wa.me/<numero>?text=...` con todo prellenado.
- Número de WhatsApp configurado en la constante `WHATSAPP_NUMBER` al inicio de `script.js` — cambiarlo ahí si el número de pedidos cambia.

## Pendiente / ideas a futuro

- Fotos reales de producto en vez de emojis (seguir el flujo de Mixkit para videos / buscar stock de fotos libres y comprimir antes de subir).
- Si se necesita inventario en tiempo real, historial de pedidos o pago en línea, eso va en un backend aparte (Render/Railway/Fly.io) — este repo es solo el front.
- Deploy: mismo patrón que NIDO, sitio estático en Netlify conectado a este repo, sin build command.
