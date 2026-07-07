const WHATSAPP_NUMBER = "573008079369"; // +57 300 807 9369, contacto general (no para hacer el pedido)
const API_BASE_URL = "https://frescos-market-api.onrender.com/api/v1";
// supabaseClient, renderAuthUI y setupAuth vienen de auth.js (compartido con panel-fm93k.html)

const PRODUCTS = [
  { id: "papa", name: "Papa", unit: "por libra", price: 1900, photo: "assets/products/camote.jpg", category: "hortalizas" },
  { id: "tomate", name: "Tomate", unit: "por libra", price: 2200, photo: "assets/products/tomate.jpg", category: "hortalizas" },
  { id: "cebolla", name: "Cebolla", unit: "por libra", price: 2000, photo: "assets/products/cebolla.jpg", category: "hortalizas" },
  { id: "zanahoria", name: "Zanahoria", unit: "por libra", price: 1700, photo: "assets/products/zanahoria.jpg", category: "hortalizas" },
  { id: "pimenton", name: "Pimentón", unit: "por libra", price: 2600, photo: "assets/products/pimenton.jpg", category: "hortalizas" },
  { id: "cilantro", name: "Cilantro", unit: "atado", price: 1500, photo: "assets/products/cilantro.jpg", category: "hortalizas" },
  { id: "aguacate", name: "Aguacate", unit: "por unidad", price: 2500, photo: "assets/products/aguacate.jpg", category: "frutas" },
  { id: "manzana", name: "Manzana", unit: "por libra", price: 3200, photo: "assets/products/manzana.jpg", category: "frutas" },
  { id: "banano", name: "Banano", unit: "por libra", price: 1500, photo: "assets/products/banano.jpg", category: "frutas" },
  { id: "naranja", name: "Naranja", unit: "por libra", price: 1900, photo: "assets/products/naranja.jpg", category: "frutas" },
  { id: "mango", name: "Mango", unit: "por unidad", price: 2300, photo: "assets/products/mango.jpg", category: "frutas" },
  { id: "fresa", name: "Fresa", unit: "canasta", price: 5500, photo: "assets/products/fresa.jpg", category: "frutas" },
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
    <div class="product-card" data-id="${p.id}">
      <img class="product-photo" src="${p.photo}" alt="${p.name} fresco">
      <div class="product-body">
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
  const placeOrderBtn = document.getElementById("placeOrderBtn");

  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);
  countEl.textContent = totalCount;

  if (entries.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Tu carrito está vacío. Agrega productos del catálogo.</p>';
    totalEl.textContent = currency.format(0);
    placeOrderBtn.disabled = true;
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
        <img class="cart-item-photo" src="${p.photo}" alt="${p.name}">
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
  placeOrderBtn.disabled = false;

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

/* Datos de entrega (telefono/direccion/departamento/ciudad) -- el nombre ya no
   se pide, viene del login de Google. Se cachean en localStorage para prefill
   instantaneo y ademas se guardan en la base de datos (perfil por usuario). */
function getCustomerInfo() {
  try {
    return JSON.parse(localStorage.getItem("fm-customer-info") || "null");
  } catch (e) {
    return null;
  }
}

function saveCustomerInfo(info) {
  localStorage.setItem("fm-customer-info", JSON.stringify(info));
}

async function prefillOrderInfoForm() {
  let info = getCustomerInfo();

  if (!info) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session ? data.session.access_token : null;
      if (token) {
        const res = await fetch(`${API_BASE_URL}/users/me/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          info = {
            phone: profile.phone,
            address: profile.address,
            department: profile.department,
            city: profile.city,
          };
          saveCustomerInfo(info);
        }
      }
    } catch (e) {
      /* sin perfil guardado todavia, se llena vacio */
    }
  }

  if (info) {
    document.getElementById("orderInfoPhone").value = info.phone || "";
    document.getElementById("orderInfoAddress").value = info.address || "";
    if (info.department) document.getElementById("orderInfoDepartment").value = info.department;
    if (info.city) document.getElementById("orderInfoCity").value = info.city;
  }
}

function openOrderInfoModal() {
  prefillOrderInfoForm();
  document.getElementById("orderInfoModal").classList.add("open");
}

function closeOrderInfoModal() {
  document.getElementById("orderInfoModal").classList.remove("open");
}

async function placeOrder() {
  const info = getCustomerInfo();
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);

  const items = entries.map(([id, qty]) => ({ product_slug: id, quantity: qty }));

  const placeOrderBtn = document.getElementById("placeOrderBtn");
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = "Enviando…";

  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session ? data.session.access_token : null;

    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        customer_phone: info.phone,
        delivery_address: info.address,
        department: info.department,
        city: info.city,
        items,
      }),
    });

    if (!res.ok) throw new Error("order creation failed");

    const order = await res.json();
    localStorage.setItem("fm-last-order-id", order.id);
    showChatWidget();

    Object.keys(cart).forEach((id) => delete cart[id]);
    saveCart();
    renderCart();
    closeCart();
    alert("¡Pedido recibido! Te contactaremos para confirmar la entrega. Puedes escribirnos desde el botón de chat.");
  } catch (e) {
    alert("No se pudo enviar el pedido. Verifica tu conexión e intenta de nuevo.");
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Hacer pedido";
  }
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

  document.getElementById("placeOrderBtn").addEventListener("click", async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      alert("Inicia sesión con Google para hacer tu pedido.");
      openLoginModal();
      return;
    }
    if (getCustomerInfo()) {
      placeOrder();
    } else {
      openOrderInfoModal();
    }
  });

  document.getElementById("orderInfoClose").addEventListener("click", closeOrderInfoModal);
  document.getElementById("orderInfoModal").addEventListener("click", (e) => {
    if (e.target.id === "orderInfoModal") closeOrderInfoModal();
  });

  document.getElementById("orderInfoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const info = {
      phone: document.getElementById("orderInfoPhone").value.trim(),
      address: document.getElementById("orderInfoAddress").value.trim(),
      department: document.getElementById("orderInfoDepartment").value,
      city: document.getElementById("orderInfoCity").value,
    };
    saveCustomerInfo(info);
    closeOrderInfoModal();

    // guarda tambien en el perfil de la base de datos, no solo en este navegador
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session ? data.session.access_token : null;
    if (token) {
      fetch(`${API_BASE_URL}/users/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(info),
      }).catch(() => {});
    }

    placeOrder();
  });

  document.getElementById("footerWhatsapp").href = `https://wa.me/${WHATSAPP_NUMBER}`;
}

/* Hero: crossfade entre los 2 videos cada 9s, como en NIDO */
function setupHeroRotation() {
  const videos = [document.getElementById("heroVideo1"), document.getElementById("heroVideo2")];
  let active = 0;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return; // se queda en el primer video, sin rotación

  setInterval(() => {
    const next = (active + 1) % videos.length;
    videos[next].currentTime = 0;
    videos[next].play().catch(() => {});
    videos[next].classList.add("active");
    videos[active].classList.remove("active");
    active = next;
  }, 9000);
}

/* Videos de sección: cargan y reproducen solo cuando entran en pantalla */
function setupSectionVideos() {
  const videos = document.querySelectorAll(".section-video, .proceso video.section-video");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.src && video.dataset.src) {
            video.src = video.dataset.src;
            video.addEventListener("loadeddata", () => video.classList.add("ready"), { once: true });
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.15 }
  );

  videos.forEach((v) => observer.observe(v));
}

/* Autoplay bloqueado en algunos navegadores móviles: reintenta en la primera interacción */
function setupAutoplayUnlock() {
  const retry = () => {
    document.querySelectorAll("video").forEach((v) => {
      if (v.paused && v.dataset.src && v.src) v.play().catch(() => {});
      if (v.paused && !v.dataset.src) v.play().catch(() => {});
    });
  };
  ["touchstart", "click", "scroll"].forEach((evt) =>
    window.addEventListener(evt, retry, { once: true, passive: true })
  );
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

/* Chat con el cliente sobre su ultimo pedido */
let customerChatChannel = null;
let customerChatPollInterval = null;

function showChatWidget() {
  document.getElementById("chatFab").hidden = false;
}

function renderCustomerMessages(messages) {
  const container = document.getElementById("customerChatMessages");
  container.innerHTML = messages
    .map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const role = m.sender_role === "team" ? "team" : "customer";
      return `<div class="chat-bubble chat-bubble-${role}"><span>${m.body}</span><time>${time}</time></div>`;
    })
    .join("");
  container.scrollTop = container.scrollHeight;
}

async function loadCustomerMessages() {
  const orderId = localStorage.getItem("fm-last-order-id");
  if (!orderId) return;

  try {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session ? data.session.access_token : null;

    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/messages`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 404) {
      // el pedido ya no existe (lo eliminaron): dejar de apuntar a el
      localStorage.removeItem("fm-last-order-id");
      clearInterval(customerChatPollInterval);
      document.getElementById("customerChatPanel").hidden = true;
      document.getElementById("chatFab").hidden = true;
      return;
    }
    if (!res.ok) return;
    renderCustomerMessages(await res.json());
  } catch (e) {
    console.error("[chat] fallo al consultar mensajes", e);
  }
}

/* Escucha nuevos mensajes por WebSocket (Supabase Realtime) en vez de
   preguntar cada rato -- el polling con setInterval lo throttlean los
   navegadores moviles (y hasta de escritorio) a ~60s, dando la sensacion
   de que "no llega nada solo". Un canal realtime no sufre ese problema. */
async function subscribeToOrderMessages(orderId) {
  console.log("[chat] subscribeToOrderMessages() llamada para orden", orderId);
  try {
    if (customerChatChannel) supabaseClient.removeChannel(customerChatChannel);

    // Sin esto, el canal de Realtime no sabe quien sos: las policies de RLS
    // (dueño del pedido o equipo) lo bloquean todo en silencio.
    const { data } = await supabaseClient.auth.getSession();
    console.log("[chat] sesion para realtime:", data.session ? "hay token" : "SIN token");
    supabaseClient.realtime.setAuth(data.session ? data.session.access_token : null);

    customerChatChannel = supabaseClient
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          console.log("[chat] nuevo mensaje recibido por realtime:", payload);
          loadCustomerMessages();
        }
      )
      .subscribe((status, err) => {
        console.log("[chat] realtime status:", status, err || "");
      });
  } catch (e) {
    console.error("[chat] error en subscribeToOrderMessages:", e);
  }
}

function setupCustomerChat() {
  const orderId = localStorage.getItem("fm-last-order-id");
  if (orderId) showChatWidget();

  document.getElementById("chatFab").addEventListener("click", () => {
    const panel = document.getElementById("customerChatPanel");
    const opening = panel.hidden;
    console.log("[chat] click en el boton de chat. opening =", opening);
    panel.hidden = !opening;
    clearInterval(customerChatPollInterval);
    if (opening) {
      loadCustomerMessages();
      const currentOrderId = localStorage.getItem("fm-last-order-id");
      console.log("[chat] currentOrderId =", currentOrderId);
      if (currentOrderId) {
        subscribeToOrderMessages(currentOrderId);
        // Respaldo mientras confirmamos que realtime entrega bien: polling
        // cada 5s (el navegador puede estirarlo hasta ~60s en segundo plano,
        // pero garantiza que los mensajes llegan aunque el canal falle).
        customerChatPollInterval = setInterval(loadCustomerMessages, 5000);
      }
    }
  });

  document.getElementById("customerChatClose").addEventListener("click", () => {
    document.getElementById("customerChatPanel").hidden = true;
    clearInterval(customerChatPollInterval);
  });

  // Respaldo: si por lo que sea el canal realtime se cae, al volver a la
  // pestana igual se refresca una vez (no depende de esto para funcionar).
  document.addEventListener("visibilitychange", () => {
    const panel = document.getElementById("customerChatPanel");
    if (!document.hidden && panel && !panel.hidden) loadCustomerMessages();
  });

  document.getElementById("customerChatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("customerChatInput");
    const body = input.value.trim();
    const orderId = localStorage.getItem("fm-last-order-id");
    if (!body || !orderId) return;
    input.value = "";

    const { data } = await supabaseClient.auth.getSession();
    const token = data.session ? data.session.access_token : null;

    await fetch(`${API_BASE_URL}/orders/${orderId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body }),
    });
    loadCustomerMessages();
  });
}

function init() {
  loadCart();
  renderGrid("grid-hortalizas", "hortalizas");
  renderGrid("grid-frutas", "frutas");
  setupProductCards();
  setupCartControls();
  renderCart();
  setupAuth();
  setupCustomerChat();
  setupHeroRotation();
  setupSectionVideos();
  setupAutoplayUnlock();
  setupScrollReveal();
}

document.addEventListener("DOMContentLoaded", init);
