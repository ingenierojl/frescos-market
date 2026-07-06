# Frescos Market — Catálogo de verduras y frutas con pedido por WhatsApp

Sitio estático (HTML/CSS/JS puro, sin build ni `package.json`). Repo independiente de `online` (NIDO), mismo flujo de trabajo (Mixkit + ffmpeg + git/Netlify), pero diseño propio — ver `PRODUCT.md` y `DESIGN.md` (generados con la skill `impeccable`).

La primera versión de este sitio usaba emojis y fondo de color plano; se descartó por verse genérica/plantilla-IA. Se rehizo con video real de mercado/producto de fondo (mismo enfoque que NIDO) y fotografía real de producto (recortes de esos mismos videos Mixkit) en las tarjetas del catálogo.

## Estructura

```
frescos-market/
├── index.html
├── style.css
├── script.js
├── PRODUCT.md         # register, usuarios, personalidad de marca, anti-referencias
├── DESIGN.md           # paleta OKLCH, tipografía, layout, motion
└── assets/
    ├── hero-veggies.mp4, hero-fruits.mp4      # hero (crossfade cada 9s)
    ├── hortalizas-basket.mp4                  # banda de intro sección hortalizas
    ├── frutas-tropical.mp4                    # banda de intro sección frutas
    ├── proceso-mercado.mp4                    # fondo sección "¿Cómo pedir?"
    └── products/*.jpg                          # foto de cada producto (recorte de los videos de arriba)
```

## Qué hace

- Catálogo de hortalizas (camote, tomate, cebolla, zanahoria, pimentón, cilantro) y frutas (aguacate, manzana, banano, naranja, mango, fresa), definido como array en `script.js` (`PRODUCTS`), con foto real por producto.
- Cada producto tiene selector de cantidad (+/-) y botón "Agregar" que suma al carrito.
- El carrito vive en `localStorage` (`fm-cart`) para no perderse si se recarga la página.
- El botón "Enviar pedido por WhatsApp" arma un mensaje de texto con el detalle del pedido y el total, y abre `https://wa.me/<numero>?text=...` con todo prellenado.
- Número de WhatsApp configurado en la constante `WHATSAPP_NUMBER` al inicio de `script.js` — cambiarlo ahí si el número de pedidos cambia.
- Paleta índigo/cobalt + acento terracota (evitando a propósito el verde-orgánico genérico), tipografía Switzer (Fontshare). Detalle completo en `DESIGN.md`.

## Nota sobre "Camote" (antes "Papa")

Mixkit no tiene ningún video de papa blanca/criolla — solo camote/batata (`farmers-hands-handling-sweet-potatoes...-48127`). En vez de mostrar una foto de camote con la etiqueta "Papa" (inexacto), se renombró el producto a "Camote". Si se consigue una foto real de papa, swap directo: reemplazar `assets/products/camote.jpg` y el `id`/`name` en `PRODUCTS` (`script.js`).

## Pendiente / ideas a futuro

- Conseguir foto real de papa blanca/criolla (Mixkit no la tiene) para reemplazar "Camote" si se quiere ese producto específico.
- Si se necesita inventario en tiempo real, historial de pedidos o pago en línea, eso va en un backend aparte (Render/Railway/Fly.io) — este repo es solo el front.
- Deploy: mismo patrón que NIDO, sitio estático en Netlify conectado a este repo, sin build command.
