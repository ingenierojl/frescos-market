let WHATSAPP_NUMBER = "573008079369"; // valor de respaldo si /settings no responde; se reemplaza con loadWhatsappNumber()
const API_BASE_URL = "https://frescos-market-api.onrender.com/api/v1";

function formatWhatsappDisplay(number) {
  // Formato internacional sin "+": codigo de pais (2 digitos) + 10 digitos locales
  const match = number.match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/);
  if (match) return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  return `+${number}`;
}
// supabaseClient, renderAuthUI y setupAuth vienen de auth.js (compartido con panel-fm93k.html)

const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

let PRODUCTS = []; // se llena desde GET /api/v1/products (catalogo real del CRUD del panel, ya no es una lista fija)

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    PRODUCTS = data.map((p) => ({
      id: p.slug,
      name: p.name,
      unit: p.unit,
      price: p.price,
      photo: p.photo_url,
      category: p.category,
    }));
  } catch (e) {
    PRODUCTS = [];
  }
}

async function loadWhatsappNumber() {
  try {
    const res = await fetch(`${API_BASE_URL}/settings`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    if (data.whatsapp_number) WHATSAPP_NUMBER = data.whatsapp_number;
  } catch (e) {
    // se queda con el valor de respaldo
  }
}

async function loadDeliveryOptions() {
  const departmentSelect = document.getElementById("orderInfoDepartment");
  const citySelect = document.getElementById("orderInfoCity");
  try {
    const [deptRes, cityRes] = await Promise.all([
      fetch(`${API_BASE_URL}/catalog-options?type=department`),
      fetch(`${API_BASE_URL}/catalog-options?type=city`),
    ]);
    const departments = deptRes.ok ? await deptRes.json() : [];
    const cities = cityRes.ok ? await cityRes.json() : [];
    departmentSelect.innerHTML = departments.map((d) => `<option value="${d.value}">${d.value}</option>`).join("");
    citySelect.innerHTML = cities.map((c) => `<option value="${c.value}">${c.value}</option>`).join("");
  } catch (e) {
    // si falla, los selects quedan vacios; el required del form evita enviar sin elegir
  }
}

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Estas 2 ya tienen su seccion curada en el HTML (video + texto propios). Cualquier
// categoria nueva que se agregue desde el panel se muestra en una seccion generica.
const CURATED_CATEGORY_SECTIONS = ["hortalizas", "frutas"];

function ensureCategorySection(category) {
  if (document.getElementById(`grid-${category}`)) return;

  const label = category.charAt(0).toUpperCase() + category.slice(1);

  // sin la clase io-reveal: esta seccion se crea despues de setupScrollReveal(),
  // que solo observa lo que ya existe en el DOM al momento de llamarse
  const header = document.createElement("div");
  header.className = "category-section-header";
  header.innerHTML = `<h2>${label}</h2>`;

  const catalogSection = document.createElement("div");
  catalogSection.className = "catalog-section";
  catalogSection.innerHTML = `<div class="product-grid" id="grid-${category}"></div>`;

  const anchor = document.getElementById("dynamicCategoriesAnchor");
  anchor.before(header);
  anchor.before(catalogSection);

  const comoLink = document.querySelector('.nav-cats a[href="#proceso"]');
  const link = document.createElement("a");
  link.href = `#grid-${category}`;
  link.textContent = label;
  comoLink.parentElement.insertBefore(link, comoLink);
}

function renderAllCategories() {
  const categories = [...new Set(PRODUCTS.map((p) => p.category))];
  const ordered = [
    ...CURATED_CATEGORY_SECTIONS.filter((c) => categories.includes(c)),
    ...categories.filter((c) => !CURATED_CATEGORY_SECTIONS.includes(c)),
  ];
  ordered.forEach((category) => {
    ensureCategorySection(category);
    renderGrid(`grid-${category}`, category);
  });
}

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

  if (items.length === 0) {
    container.innerHTML = '<p class="catalog-empty">No se pudo cargar el catálogo. Intenta recargar la página.</p>';
    return;
  }

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
    customerChatPrimed = false; // nuevo pedido: reiniciar la linea base del chat
    lastSeenMessageCount = 0;
    showChatWidget();
    startCustomerChatBackground(); // empezar a escuchar ya, sin abrir el widget

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

  const footerWhatsapp = document.getElementById("footerWhatsapp");
  footerWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  footerWhatsapp.textContent = formatWhatsappDisplay(WHATSAPP_NUMBER);
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
let lastSeenMessageCount = 0; // cuantos mensajes ya "vio" el cliente (con el chat abierto)
let customerChatPrimed = false; // ya se cargo el historial inicial

function showChatWidget() {
  document.getElementById("chatFab").hidden = false;
}

function isChatPanelOpen() {
  const panel = document.getElementById("customerChatPanel");
  return panel && !panel.hidden;
}

function setChatUnread(on) {
  document.getElementById("chatFab").classList.toggle("has-unread", on);
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
      if (customerChatChannel) supabaseClient.removeChannel(customerChatChannel);
      document.getElementById("customerChatPanel").hidden = true;
      document.getElementById("chatFab").hidden = true;
      return;
    }
    if (!res.ok) return;

    const messages = await res.json();
    renderCustomerMessages(messages);

    if (isChatPanelOpen()) {
      // el cliente esta mirando: se marcan como vistos, sin puntito
      lastSeenMessageCount = messages.length;
      setChatUnread(false);
    } else if (!customerChatPrimed) {
      // primera carga con el chat cerrado: el historial ya existente no
      // cuenta como "nuevo", solo se toma como linea base
      lastSeenMessageCount = messages.length;
    } else if (messages.length > lastSeenMessageCount) {
      // llego algo nuevo con el chat cerrado: avisar con el puntito
      setChatUnread(true);
    }
    customerChatPrimed = true;
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

// Empieza a escuchar en segundo plano (sin abrir el widget): realtime para
// recibir al instante + un poll lento de respaldo cada 8s por si realtime
// falla. Asi el cliente recibe mensajes aunque nunca toque el icono.
function startCustomerChatBackground() {
  const orderId = localStorage.getItem("fm-last-order-id");
  if (!orderId) return;
  subscribeToOrderMessages(orderId);
  loadCustomerMessages(); // carga inicial y fija la linea base
  clearInterval(customerChatPollInterval);
  customerChatPollInterval = setInterval(loadCustomerMessages, 8000);
}

function setupCustomerChat() {
  const orderId = localStorage.getItem("fm-last-order-id");
  if (orderId) {
    showChatWidget();
    startCustomerChatBackground();
  }

  document.getElementById("chatFab").addEventListener("click", () => {
    const panel = document.getElementById("customerChatPanel");
    const opening = panel.hidden;
    panel.hidden = !opening;
    if (opening) {
      setChatUnread(false); // al abrir, se marca como visto (quita el puntito)
      loadCustomerMessages();
      const currentOrderId = localStorage.getItem("fm-last-order-id");
      if (currentOrderId) {
        subscribeToOrderMessages(currentOrderId); // reasegura el canal
        // con el chat abierto, respaldo mas rapido (2.5s)
        clearInterval(customerChatPollInterval);
        customerChatPollInterval = setInterval(loadCustomerMessages, 2500);
      }
    } else {
      // al cerrar, vuelve al ritmo lento de segundo plano (sigue escuchando)
      clearInterval(customerChatPollInterval);
      customerChatPollInterval = setInterval(loadCustomerMessages, 8000);
    }
  });

  document.getElementById("customerChatClose").addEventListener("click", () => {
    document.getElementById("customerChatPanel").hidden = true;
    // no se detiene la escucha: vuelve al ritmo lento de segundo plano
    clearInterval(customerChatPollInterval);
    customerChatPollInterval = setInterval(loadCustomerMessages, 8000);
  });

  // Al volver a la pestana, refrescar de una (los timers se throttlean en
  // segundo plano; esto garantiza que el puntito/mensajes se actualicen ya).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && localStorage.getItem("fm-last-order-id")) loadCustomerMessages();
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

/* Mis pedidos (cliente) */
let myOrdersProductsById = null; // cache: id numerico -> producto (viene del catalogo publico, no de PRODUCTS que usa slug)

async function ensureMyOrdersProductsById() {
  if (myOrdersProductsById) return myOrdersProductsById;
  myOrdersProductsById = {};
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (res.ok) {
      const products = await res.json();
      products.forEach((p) => {
        myOrdersProductsById[p.id] = p;
      });
    }
  } catch (e) {
    // si falla, se muestran los items con su id como respaldo
  }
  return myOrdersProductsById;
}

function renderMyOrders(orders) {
  const list = document.getElementById("myOrdersList");
  if (orders.length === 0) {
    list.innerHTML = "<p>Todavía no has hecho ningún pedido.</p>";
    return;
  }

  list.innerHTML = orders
    .map((order) => {
      const itemsHtml = order.items
        .map((item) => {
          const product = myOrdersProductsById[item.product_id];
          const label = product ? product.name : `Producto #${item.product_id}`;
          return `<li>${label} × ${item.quantity} — ${currency.format(item.subtotal)}</li>`;
        })
        .join("");
      const date = new Date(order.created_at).toLocaleString("es-CO");
      const statusLabel = STATUS_LABELS[order.status] || order.status;

      return `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <span class="order-status-badge status-${order.status}">${statusLabel}</span>
              <div class="order-date">${date}</div>
            </div>
            <div class="order-total">${currency.format(order.total)}</div>
          </div>
          <div class="order-address">${order.delivery_address}, ${order.city}</div>
          <ul class="order-items">${itemsHtml}</ul>
        </div>
      `;
    })
    .join("");
}

async function loadMyOrders() {
  const list = document.getElementById("myOrdersList");
  list.innerHTML = "<p>Cargando…</p>";

  const { data } = await supabaseClient.auth.getSession();
  const token = data.session ? data.session.access_token : null;
  if (!token) {
    list.innerHTML = "<p>Inicia sesión para ver tus pedidos.</p>";
    return;
  }

  try {
    await ensureMyOrdersProductsById();
    const res = await fetch(`${API_BASE_URL}/orders/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("fetch failed");
    const orders = await res.json();
    renderMyOrders(orders);
  } catch (e) {
    list.innerHTML = "<p>No se pudieron cargar tus pedidos. Intenta de nuevo.</p>";
  }
}

function openMyOrdersModal() {
  document.getElementById("myOrdersModal").classList.add("open");
  loadMyOrders();
}

function closeMyOrdersModal() {
  document.getElementById("myOrdersModal").classList.remove("open");
}

function setupMyOrders() {
  document.getElementById("myOrdersClose").addEventListener("click", closeMyOrdersModal);
  document.getElementById("myOrdersModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("myOrdersModal")) closeMyOrdersModal();
  });
}

window.openMyOrdersModal = openMyOrdersModal;

async function init() {
  loadCart();
  document.getElementById("grid-hortalizas").innerHTML = "<p class=\"catalog-loading\">Cargando catálogo…</p>";
  document.getElementById("grid-frutas").innerHTML = "<p class=\"catalog-loading\">Cargando catálogo…</p>";
  setupAuth();
  setupCustomerChat();
  setupMyOrders();
  setupHeroRotation();
  setupSectionVideos();
  setupAutoplayUnlock();
  setupScrollReveal();

  await Promise.all([loadProducts(), loadWhatsappNumber(), loadDeliveryOptions()]);
  renderAllCategories();
  setupProductCards();
  setupCartControls();
  renderCart();
}

document.addEventListener("DOMContentLoaded", init);
