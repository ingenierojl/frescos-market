const WHATSAPP_NUMBER = "573008079369"; // +57 300 807 9369, formato internacional sin '+' ni espacios

const PRODUCTS = [
  { id: "papa", name: "Papa", unit: "por libra", price: 1800, icon: "🥔", bg: "#f1e4d0", category: "hortalizas" },
  { id: "tomate", name: "Tomate", unit: "por libra", price: 2200, icon: "🍅", bg: "#fbe1de", category: "hortalizas" },
  { id: "cebolla", name: "Cebolla", unit: "por libra", price: 2000, icon: "🧅", bg: "#f6e6f2", category: "hortalizas" },
  { id: "zanahoria", name: "Zanahoria", unit: "por libra", price: 1700, icon: "🥕", bg: "#fbe6d4", category: "hortalizas" },
  { id: "pimenton", name: "Pimentón", unit: "por libra", price: 2600, icon: "🫑", bg: "#e2f2e0", category: "hortalizas" },
  { id: "papaya-verde", name: "Cilantro / Hierbas", unit: "atado", price: 1500, icon: "🌿", bg: "#e2f2e0", category: "hortalizas" },
  { id: "aguacate", name: "Aguacate", unit: "por unidad", price: 2500, icon: "🥑", bg: "#e5f0da", category: "frutas" },
  { id: "manzana", name: "Manzana", unit: "por libra", price: 3200, icon: "🍎", bg: "#fbe1de", category: "frutas" },
  { id: "banano", name: "Banano", unit: "por libra", price: 1500, icon: "🍌", bg: "#faf1cf", category: "frutas" },
  { id: "naranja", name: "Naranja", unit: "por libra", price: 1900, icon: "🍊", bg: "#fbe6d4", category: "frutas" },
  { id: "mango", name: "Mango", unit: "por unidad", price: 2300, icon: "🥭", bg: "#faf1cf", category: "frutas" },
  { id: "fresa", name: "Fresa", unit: "canasta", price: 5500, icon: "🍓", bg: "#fbe1de", category: "frutas" },
];

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const cart = {}; // { productId: qty }

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("fm-cart") || "{}");
    Object.assign(cart, saved);
  } catch (e) {
    /* localStorage no disponible o corrupto: se ignora y arranca vacío */
  }
}

function saveCart() {
  localStorage.setItem("fm-cart", JSON.stringify(cart));
}

function renderGrid(containerId, category) {
  const container = document.getElementById(containerId);
  const items = PRODUCTS.filter((p) => p.category === category);

  container.innerHTML = items
    .map(
      (p) => `
    <div class="product-card io-reveal" data-id="${p.id}">
      <div class="product-icon" style="background:${p.bg}">${p.icon}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-unit">${p.unit}</div>
      <div class="product-price">${currency.format(p.price)}</div>
      <div class="qty-row">
        <button class="qty-btn" data-action="minus" aria-label="Restar">−</button>
        <span class="qty-value" data-role="qty">1</span>
        <button class="qty-btn" data-action="plus" aria-label="Sumar">+</button>
      </div>
      <button class="add-btn" data-action="add">Agregar</button>
    </div>
  `
    )
    .join("");
}

function setupProductCards() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = card.dataset.id;
    const qtyEl = card.querySelector('[data-role="qty"]');
    const addBtn = card.querySelector('[data-action="add"]');
    let localQty = 1;

    card.querySelector('[data-action="minus"]').addEventListener("click", () => {
      localQty = Math.max(1, localQty - 1);
      qtyEl.textContent = localQty;
    });

    card.querySelector('[data-action="plus"]').addEventListener("click", () => {
      localQty += 1;
      qtyEl.textContent = localQty;
    });

    addBtn.addEventListener("click", () => {
      cart[id] = (cart[id] || 0) + localQty;
      saveCart();
      renderCart();
      openCart();

      addBtn.textContent = "Agregado ✓";
      addBtn.classList.add("added");
      setTimeout(() => {
        addBtn.textContent = "Agregar";
        addBtn.classList.remove("added");
      }, 1200);

      localQty = 1;
      qtyEl.textContent = localQty;
    });
  });
}

function renderCart() {
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const countEl = document.getElementById("cartCount");
  const sendBtn = document.getElementById("sendWhatsapp");

  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);
  countEl.textContent = totalCount;

  if (entries.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío. Agrega productos del catálogo.</p>';
    totalEl.textContent = currency.format(0);
    sendBtn.disabled = true;
    return;
  }

  let total = 0;
  itemsEl.innerHTML = entries
    .map(([id, qty]) => {
      const p = PRODUCTS.find((prod) => prod.id === id);
      const subtotal = p.price * qty;
      total += subtotal;
      return `
      <div class="cart-item" data-id="${id}">
        <div class="cart-item-icon" style="background:${p.bg}">${p.icon}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-sub">${currency.format(p.price)} ${p.unit}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-cart-action="minus">−</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" data-cart-action="plus">+</button>
            <button class="cart-item-remove" data-cart-action="remove" aria-label="Eliminar">🗑</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  totalEl.textContent = currency.format(total);
  sendBtn.disabled = false;

  itemsEl.querySelectorAll(".cart-item").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-cart-action="minus"]').addEventListener("click", () => {
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
      if (cart[id] === 0) delete cart[id];
      saveCart();
      renderCart();
    });
    row.querySelector('[data-cart-action="plus"]').addEventListener("click", () => {
      cart[id] = (cart[id] || 0) + 1;
      saveCart();
      renderCart();
    });
    row.querySelector('[data-cart-action="remove"]').addEventListener("click", () => {
      delete cart[id];
      saveCart();
      renderCart();
    });
  });
}

function buildWhatsappMessage() {
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  let total = 0;
  const lines = entries.map(([id, qty]) => {
    const p = PRODUCTS.find((prod) => prod.id === id);
    const subtotal = p.price * qty;
    total += subtotal;
    return `• ${p.name} x${qty} (${p.unit}) — ${currency.format(subtotal)}`;
  });

  const message = [
    "¡Hola! Quiero pedir lo siguiente:",
    "",
    ...lines,
    "",
    `Total: ${currency.format(total)}`,
    "",
    "Nombre y dirección de entrega:",
  ].join("\n");

  return message;
}

function openCart() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
}

function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
}

function setupCartControls() {
  document.getElementById("cartToggle").addEventListener("click", openCart);
  document.getElementById("cartClose").addEventListener("click", closeCart);
  document.getElementById("cartOverlay").addEventListener("click", closeCart);

  document.getElementById("sendWhatsapp").addEventListener("click", () => {
    const message = buildWhatsappMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  });

  const footerLink = document.getElementById("footerWhatsapp");
  footerLink.href = `https://wa.me/${WHATSAPP_NUMBER}`;
}

function setupScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("visible", entry.isIntersecting);
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".io-reveal").forEach((el) => observer.observe(el));
}

function init() {
  loadCart();
  renderGrid("grid-hortalizas", "hortalizas");
  renderGrid("grid-frutas", "frutas");
  setupProductCards();
  setupCartControls();
  renderCart();
  setupScrollReveal();
}

document.addEventListener("DOMContentLoaded", init);
