# Design

## Visual theme

Mood: mercado gourmet antes del amanecer — luz fría de bodega/estudio (índigo/cobalt) sobre fondo blanco puro, con la fotografía/video real del producto (gotas de agua, texturas, cortes) llevando toda la calidez y la "frescura". Evita deliberadamente el verde-orgánico-genérico asociado por defecto a "productos frescos".

Estrategia de color: **Committed** — el índigo profundo carga los elementos de marca (header, botones, footer, contenedores del carrito) contra un fondo blanco puro que deja respirar la fotografía de producto; un acento cítrico cálido (naranja/terracota) marca precios, badges y el CTA secundario.

## Color (OKLCH)

```css
--primary:  oklch(0.42 0.16 256);   /* índigo/cobalt profundo — marca */
--primary-ink: oklch(0.30 0.13 256); /* hover/pressed */
--bg:       oklch(1.00 0.00 0);     /* blanco puro — deja respirar la foto */
--surface:  oklch(0.96 0.012 256);  /* tarjetas, paneles, off-white frío */
--ink:      oklch(0.18 0.02 256);   /* texto principal, casi negro con tinte frío */
--muted:    oklch(0.52 0.02 256);   /* texto secundario */
--accent:   oklch(0.45 0.17 55);    /* cítrico cálido (terracota) — precios, badges, acentos */
--whatsapp: #25D366;                /* convención reconocible, no se toca */
```

Regla de texto sobre relleno: verificado con contraste real (canvas + fórmula WCAG), no solo por la heurística de L/chroma. El acento original en L=0.72 fallaba (2.3:1 texto blanco encima, 2.3:1 como texto sobre superficie clara) — se bajó a L=0.45, que da ~7.8:1 en ambos sentidos (texto blanco sobre acento relleno, y acento como texto sobre `--bg`/`--surface`). `--primary` (L=0.42) sigue usando texto blanco (8.6:1).

## Typography

Familia única: **Switzer** (Fontshare, variable, pesos 400/500/600/700/800) — grotesco contemporáneo, ni geométrico-genérico (Poppins/Outfit) ni de la lista de reflejo prohibida (Inter, DM Sans, etc). Contraste de voz vía peso y tamaño, no vía segunda familia.

- Display / H1: `clamp(2.25rem, 5vw, 3.6rem)`, peso 700, letter-spacing -0.02em, `text-wrap: balance`.
- H2 de sección: `clamp(1.6rem, 3vw, 2.2rem)`, peso 600.
- Body: 16px/1.55, peso 400, `--ink` sobre `--bg`.
- Precios / cifras: peso 700, `--accent` o `--ink` según contexto (nunca gris sobre blanco).

## Layout

- Hero: video real full-bleed (no split como NIDO — este negocio es catálogo, no inmobiliaria), scrim oscuro con gradiente índigo para legibilidad, headline centrado.
- Catálogo: grid uniforme `repeat(auto-fill, minmax(220px, 1fr))` — la variedad visual la aportan las fotos reales de cada producto, no el layout (prioridad: escaneabilidad de precio/cantidad sobre experimentación de grid).
- Secciones alternan fondo de video real (con scrim) y fondo blanco puro, para dar ritmo sin sacrificar la lectura del carrito.

## Imagery

- Video de stock real (Mixkit, licencia libre), mismo flujo que NIDO: `curl` para extraer URLs, verificar con `curl -sI`, comprimir con ffmpeg antes de subir.
- Fotografía de producto: frames extraídos y recortados de esos mismos videos Mixkit (still-life profesional con gotas de agua, luz cálida) — coherente visualmente con los videos de fondo, en vez de íconos o emoji.
- Ver `assets/products/README` (o el README raíz) para la procedencia de cada recorte.

## Motion

- Entrada de producto al carrito: micro-feedback en el botón (no fade genérico repetido en cada tarjeta).
- Scroll-reveal por sección con `IntersectionObserver`, distinto stagger para grid de catálogo vs. bloques de texto.
- Todo con alternativa `prefers-reduced-motion: reduce` (crossfade instantáneo, sin reveal).

## Componentes existentes

- `.product-card`: foto real full-bleed arriba, nombre/unidad/precio abajo, stepper +/-, botón agregar.
- `.cart-drawer`: panel lateral, persistente en `localStorage`.
- `.btn-whatsapp`: único elemento que conserva el verde de marca de WhatsApp (#25D366) — convención reconocible, no forma parte de la paleta del sitio.
