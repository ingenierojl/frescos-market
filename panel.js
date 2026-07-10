const API_BASE_URL = "https://frescos-market-api.onrender.com/api/v1";

const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

let productsById = {}; // se llena al cargar productos, para mostrar nombres en los pedidos
let openChatOrderId = null;
let chatChannel = null;
let chatPollInterval = null;
let isAdmin = false; // true si /admin/products respondio OK (el despachador recibe 403 ahi)

function setState(html) {
  document.getElementById("adminState").innerHTML = html;
}

async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function authedFetch(path, options = {}) {
  const token = await getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

/* Tabs */
function setupTabs() {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById("ordersTab").hidden = target !== "orders";
      document.getElementById("productsTab").hidden = target !== "products";
      document.getElementById("settingsTab").hidden = target !== "settings";
      if (target === "products" && document.getElementById("productsList").dataset.loaded !== "true") {
        loadProducts();
      }
      if (target === "settings") {
        loadSettings();
      }
    });
  });
}

/* Pedidos */
function renderOrders(orders) {
  const list = document.getElementById("ordersList");

  if (orders.length === 0) {
    list.innerHTML = "<p>Todavía no hay pedidos.</p>";
    return;
  }

  list.innerHTML = orders
    .map((order) => {
      const itemsHtml = order.items
        .map((item) => {
          const product = productsById[item.product_id];
          const label = product ? product.name : `Producto #${item.product_id}`;
          return `<li>${label} × ${item.quantity} — ${currency.format(item.subtotal)}</li>`;
        })
        .join("");
      const date = new Date(order.created_at).toLocaleString("es-CO");

      return `
        <div class="order-card" data-id="${order.id}">
          <div class="order-card-head">
            <div>
              <div class="order-customer">${order.customer_name}</div>
              <div class="order-date">${date} · ${order.customer_phone}</div>
            </div>
            <div class="order-total">${currency.format(order.total)}</div>
          </div>
          <div class="order-address">${order.delivery_address}</div>
          <ul class="order-items">${itemsHtml}</ul>
          <label class="order-status-label">
            Estado:
            <select class="order-status-select" data-id="${order.id}">
              ${Object.entries(STATUS_LABELS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${value === order.status ? "selected" : ""}>${label}</option>`
                )
                .join("")}
            </select>
          </label>
          <div class="order-actions">
            <button class="btn-small chat-toggle-btn" data-id="${order.id}">💬 Chat</button>
            ${isAdmin ? `<button class="btn-small danger order-delete-btn" data-id="${order.id}">Eliminar</button>` : ""}
          </div>
          <div class="order-chat" data-id="${order.id}" hidden>
            <div class="order-chat-messages"></div>
            <div class="chat-image-preview-row" hidden>
              <img class="chat-image-preview" alt="Vista previa">
              <button type="button" class="chat-image-remove" aria-label="Quitar imagen">✕</button>
            </div>
            <form class="order-chat-form">
              <button type="button" class="chat-attach-btn order-chat-camera-btn" aria-label="Tomar foto">📷</button>
              <button type="button" class="chat-attach-btn order-chat-gallery-btn" aria-label="Elegir de galería">🖼️</button>
              <input type="file" class="order-chat-camera" accept="image/*" capture="environment" hidden>
              <input type="file" class="order-chat-gallery" accept="image/*" hidden>
              <input type="text" class="order-chat-input" placeholder="Escribe un mensaje..." maxlength="1000">
              <button type="submit" class="btn-small">Enviar</button>
            </form>
          </div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".chat-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleChat(btn.dataset.id));
  });

  list.querySelectorAll(".order-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.id;
      const card = btn.closest(".order-card");
      const customer = card.querySelector(".order-customer").textContent;
      if (!confirm(`¿Eliminar el pedido de ${customer}? Esto borra también sus mensajes y no se puede deshacer.`)) return;

      btn.disabled = true;
      const res = await authedFetch(`/admin/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("No se pudo eliminar el pedido.");
        btn.disabled = false;
        return;
      }
      loadOrders();
    });
  });

  list.querySelectorAll(".order-chat").forEach((chatEl) => {
    const previewRow = chatEl.querySelector(".chat-image-preview-row");
    const preview = previewRow.querySelector(".chat-image-preview");
    const cameraInput = chatEl.querySelector(".order-chat-camera");
    const galleryInput = chatEl.querySelector(".order-chat-gallery");

    chatEl.querySelector(".order-chat-camera-btn").addEventListener("click", () => cameraInput.click());
    chatEl.querySelector(".order-chat-gallery-btn").addEventListener("click", () => galleryInput.click());

    function onFileSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      chatEl.selectedImageFile = file;
      preview.src = URL.createObjectURL(file);
      previewRow.hidden = false;
    }
    cameraInput.addEventListener("change", onFileSelected);
    galleryInput.addEventListener("change", onFileSelected);

    previewRow.querySelector(".chat-image-remove").addEventListener("click", () => {
      chatEl.selectedImageFile = null;
      cameraInput.value = "";
      galleryInput.value = "";
      previewRow.hidden = true;
    });
  });

  list.querySelectorAll(".order-chat-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const chatEl = form.closest(".order-chat");
      const orderId = chatEl.dataset.id;
      const input = form.querySelector(".order-chat-input");
      const body = input.value.trim();
      const imageFile = chatEl.selectedImageFile;
      if (!body && !imageFile) return;

      let imageUrl = null;
      if (imageFile) {
        try {
          imageUrl = await uploadChatImage(imageFile);
        } catch (err) {
          alert("No se pudo subir la imagen. Intenta de nuevo.");
          return;
        }
      }

      input.value = "";
      chatEl.selectedImageFile = null;
      chatEl.querySelector(".chat-image-preview-row").hidden = true;
      chatEl.querySelector(".order-chat-camera").value = "";
      chatEl.querySelector(".order-chat-gallery").value = "";

      await authedFetch(`/orders/${orderId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: body || null, image_url: imageUrl }),
      });
      loadMessages(orderId);
    });
  });

  list.querySelectorAll(".order-status-select").forEach((select) => {
    select.addEventListener("change", async () => {
      const orderId = select.dataset.id;
      const newStatus = select.value;
      select.disabled = true;
      try {
        const res = await authedFetch(`/admin/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("update failed");
      } catch (e) {
        alert("No se pudo actualizar el estado. Intenta de nuevo.");
      }
      select.disabled = false;
    });
  });
}

/* Chat por pedido */
function renderMessages(orderId, messages) {
  const container = document.querySelector(`.order-chat[data-id="${orderId}"] .order-chat-messages`);
  if (!container) return;
  container.innerHTML = messages
    .map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const imageHtml = m.image_url
        ? `<img class="chat-message-image" src="${m.image_url}" alt="Imagen enviada">`
        : "";
      const bodyHtml = m.body ? `<span>${m.body}</span>` : "";
      return `<div class="chat-bubble chat-bubble-${m.sender_role}">${imageHtml}${bodyHtml}<time>${time}</time></div>`;
    })
    .join("");
  container.scrollTop = container.scrollHeight;
}

async function loadMessages(orderId) {
  const res = await authedFetch(`/orders/${orderId}/messages`);
  if (res.status === 404) {
    // el pedido fue eliminado: dejar de refrescar su chat y recargar la lista
    clearInterval(chatPollInterval);
    if (openChatOrderId === orderId) openChatOrderId = null;
    loadOrders();
    return;
  }
  if (!res.ok) return;
  const messages = await res.json();
  renderMessages(orderId, messages);
}

/* Escucha nuevos mensajes por WebSocket (Supabase Realtime) -- ver la nota
   equivalente en script.js: el polling con setInterval lo throttlean los
   navegadores a ~60s aunque la pestaña este visible. */
async function subscribeToOrderMessages(orderId) {
  if (chatChannel) supabaseClient.removeChannel(chatChannel);

  // Sin esto, el canal no sabe quien sos y las policies de RLS bloquean todo.
  const token = await getAccessToken();
  supabaseClient.realtime.setAuth(token);

  chatChannel = supabaseClient
    .channel(`order-messages-${orderId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
      () => loadMessages(orderId)
    )
    .subscribe((status) => console.log("[chat] realtime status:", status));
}

function toggleChat(orderId) {
  const chatEl = document.querySelector(`.order-chat[data-id="${orderId}"]`);
  if (!chatEl) return;

  if (openChatOrderId === orderId) {
    chatEl.hidden = true;
    openChatOrderId = null;
    if (chatChannel) supabaseClient.removeChannel(chatChannel);
    clearInterval(chatPollInterval);
    return;
  }

  document.querySelectorAll(".order-chat").forEach((el) => (el.hidden = true));

  chatEl.hidden = false;
  openChatOrderId = orderId;
  loadMessages(orderId);
  subscribeToOrderMessages(orderId);
  // Respaldo mientras confirmamos que realtime entrega bien: polling cada 5s
  // (el navegador puede estirarlo hasta ~60s, pero garantiza que los mensajes
  // llegan aunque el canal realtime falle).
  clearInterval(chatPollInterval);
  chatPollInterval = setInterval(() => loadMessages(orderId), 2500);
}

// Respaldo: si el canal realtime se cae, al volver a la pestaña igual se
// refresca una vez (no depende de esto para funcionar).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && openChatOrderId) loadMessages(openChatOrderId);
});

async function loadOrders() {
  const token = await getAccessToken();
  if (!token) {
    setState("<p>Inicia sesión para continuar.</p>");
    return;
  }

  setState("Cargando pedidos…");
  const res = await authedFetch("/admin/orders");

  if (res.status === 401 || res.status === 403) {
    setState("<p>Tu cuenta no tiene acceso a este panel.</p>");
    return;
  }
  if (!res.ok) {
    setState("<p>Ocurrió un error cargando los pedidos. Intenta recargar la página.</p>");
    return;
  }

  document.getElementById("adminTabs").hidden = false;
  setState("");
  const orders = await res.json();
  renderOrders(orders);
}

/* Productos */
function renderProducts(products) {
  productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const list = document.getElementById("productsList");
  document.getElementById("productsList").dataset.loaded = "true";

  list.innerHTML = products
    .map(
      (p) => `
      <div class="product-admin-row ${p.active ? "" : "product-admin-inactive"}" data-id="${p.id}">
        <img class="product-admin-photo" src="${p.photo_url}" alt="">
        <div class="product-admin-info">
          <div class="product-admin-name">${p.name} ${p.active ? "" : "(inactivo)"}</div>
          <div class="product-admin-meta">${p.slug} · ${currency.format(p.price)} ${p.unit} · ${p.category}</div>
        </div>
        <div class="product-admin-actions">
          <button class="btn-small" data-action="edit">Editar</button>
          <button class="btn-small danger" data-action="delete">Borrar</button>
        </div>
      </div>
    `
    )
    .join("");

  list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".product-admin-row").dataset.id;
      openProductModal(productsById[id]);
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest(".product-admin-row").dataset.id;
      if (!confirm(`¿Borrar "${productsById[id].name}"? Si tiene pedidos asociados, mejor desactívalo.`)) return;
      const res = await authedFetch(`/admin/products/${id}`, { method: "DELETE" });
      if (res.status === 400) {
        const body = await res.json();
        alert(body.detail);
        return;
      }
      if (!res.ok) {
        alert("No se pudo borrar el producto.");
        return;
      }
      loadProducts();
    });
  });
}

async function loadProducts() {
  const res = await authedFetch("/admin/products");
  if (res.status === 403) {
    // el despachador no administra productos: se oculta la pestaña, no es un error
    isAdmin = false;
    document.querySelector('.admin-tab[data-tab="products"]').hidden = true;
    document.getElementById("settingsTabBtn").hidden = true;
    return;
  }
  if (!res.ok) return;
  isAdmin = true; // solo el admin puede listar productos, sirve para mostrar "Eliminar" en pedidos
  document.getElementById("settingsTabBtn").hidden = false;
  const products = await res.json();
  renderProducts(products);
}

async function loadSettings() {
  const res = await authedFetch("/admin/settings");
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById("telegramChatId").value = data.telegram_chat_id || "";
  document.getElementById("whatsappNumber").value = data.whatsapp_number || "";
  document.getElementById("businessPhone").value = data.business_phone || "";
  document.getElementById("streetAddress").value = data.street_address || "";
  document.getElementById("postalCode").value = data.postal_code || "";
  loadCatalogOptionsManager();
  loadPaymentOptionsManager();
}

function setupSettingsForm() {
  document.getElementById("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const telegramChatId = document.getElementById("telegramChatId").value.trim();
    const whatsappNumber = document.getElementById("whatsappNumber").value.trim();
    const businessPhone = document.getElementById("businessPhone").value.trim();
    const streetAddress = document.getElementById("streetAddress").value.trim();
    const postalCode = document.getElementById("postalCode").value.trim();
    const res = await authedFetch("/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        telegram_chat_id: telegramChatId || null,
        whatsapp_number: whatsappNumber || null,
        business_phone: businessPhone || null,
        street_address: streetAddress || null,
        postal_code: postalCode || null,
      }),
    });
    if (!res.ok) {
      alert("No se pudo guardar la configuración.");
      return;
    }
    const saved = document.getElementById("settingsSaved");
    saved.hidden = false;
    setTimeout(() => {
      saved.hidden = true;
    }, 2000);
  });
  setupCatalogOptionsForms();
  setupPaymentOptionAddForm();
}

const CATALOG_OPTION_TYPES = ["unit", "category", "department", "city"];

async function loadProductFormOptions() {
  const res = await fetch(`${API_BASE_URL}/catalog-options`);
  if (!res.ok) return;
  const all = await res.json();
  const units = all.filter((o) => o.type === "unit");
  const categories = all.filter((o) => o.type === "category");
  document.getElementById("productUnit").innerHTML = units
    .map((o) => `<option value="${o.value}">${o.value}</option>`)
    .join("");
  document.getElementById("productCategory").innerHTML = categories
    .map((o) => `<option value="${o.value}">${o.value}</option>`)
    .join("");
}

async function loadCatalogOptionsManager() {
  const res = await fetch(`${API_BASE_URL}/catalog-options`);
  if (!res.ok) return;
  const all = await res.json();

  CATALOG_OPTION_TYPES.forEach((type) => {
    const list = document.querySelector(`.catalog-options-list[data-type="${type}"]`);
    const items = all.filter((o) => o.type === type);
    list.innerHTML = items
      .map(
        (o) => `
        <span class="catalog-option-chip">
          ${o.value}
          <button type="button" class="catalog-option-remove" data-id="${o.id}" aria-label="Quitar">✕</button>
        </span>
      `
      )
      .join("");
  });

  document.querySelectorAll(".catalog-option-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = await authedFetch(`/admin/catalog-options/${btn.dataset.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("No se pudo quitar la opción.");
        return;
      }
      loadCatalogOptionsManager();
      loadProductFormOptions();
    });
  });
}

function setupCatalogOptionsForms() {
  document.querySelectorAll(".catalog-option-add-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const value = input.value.trim();
      if (!value) return;

      const res = await authedFetch("/admin/catalog-options", {
        method: "POST",
        body: JSON.stringify({ type: form.dataset.type, value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.detail || "No se pudo agregar.");
        return;
      }
      input.value = "";
      loadCatalogOptionsManager();
      loadProductFormOptions();
    });
  });
}

async function loadPaymentOptionsManager() {
  const res = await fetch(`${API_BASE_URL}/payment-options`);
  if (!res.ok) return;
  const options = await res.json();

  const list = document.getElementById("paymentOptionsList");
  list.innerHTML = options
    .map(
      (o) => `
      <div class="payment-option-chip">
        ${o.qr_image_url ? `<img class="payment-option-chip-qr" src="${o.qr_image_url}" alt="">` : ""}
        <div>
          <strong>${o.label}</strong>
          <div>${o.phone_or_account}</div>
        </div>
        <button type="button" class="catalog-option-remove" data-id="${o.id}" aria-label="Quitar">✕</button>
      </div>
    `
    )
    .join("");

  list.querySelectorAll(".catalog-option-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = await authedFetch(`/admin/payment-options/${btn.dataset.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("No se pudo quitar el método de pago.");
        return;
      }
      loadPaymentOptionsManager();
    });
  });
}

function setupPaymentOptionAddForm() {
  document.getElementById("paymentOptionAddForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = document.getElementById("newPaymentLabel").value.trim();
    const account = document.getElementById("newPaymentAccount").value.trim();
    const qrFile = document.getElementById("newPaymentQr").files[0];
    if (!label || !account) return;

    let qrImageUrl = null;
    if (qrFile) {
      try {
        qrImageUrl = await uploadProductPhoto(qrFile);
      } catch (err) {
        alert("No se pudo subir el QR. Intenta de nuevo.");
        return;
      }
    }

    const res = await authedFetch("/admin/payment-options", {
      method: "POST",
      body: JSON.stringify({ label, phone_or_account: account, qr_image_url: qrImageUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.detail || "No se pudo agregar el método de pago.");
      return;
    }

    e.target.reset();
    loadPaymentOptionsManager();
  });
}

function openProductModal(product) {
  const form = document.getElementById("productForm");
  form.reset();
  document.getElementById("productModalTitle").textContent = product ? "Editar producto" : "Agregar producto";
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productSlug").value = product ? product.slug : "";
  document.getElementById("productSlug").disabled = !!product; // el slug no se cambia al editar
  document.getElementById("productName").value = product ? product.name : "";
  document.getElementById("productUnit").value = product ? product.unit : "por libra";
  document.getElementById("productPrice").value = product ? product.price : "";
  document.getElementById("productCategory").value = product ? product.category : "hortalizas";
  document.getElementById("productPhotoUrl").value = product ? product.photo_url : "";
  document.getElementById("productStock").value = product && product.stock !== null ? product.stock : "";
  document.getElementById("productActive").checked = product ? product.active : true;

  const preview = document.getElementById("productPhotoPreview");
  if (product && product.photo_url) {
    preview.src = product.photo_url;
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
  document.getElementById("productPhotoStatus").hidden = true;
  selectedProductPhotoFile = null;

  document.getElementById("productModal").classList.add("open");
}

let selectedProductPhotoFile = null; // viene de la camara o de la galeria, cualquiera de los 2 botones
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // igual al limite del bucket en Supabase Storage

async function uploadProductPhoto(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from("product-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from("product-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadChatImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from("chat-images").upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from("chat-images").getPublicUrl(path);
  return data.publicUrl;
}

function closeProductModal() {
  document.getElementById("productModal").classList.remove("open");
}

function setupProductForm() {
  document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(null));
  document.getElementById("productModalClose").addEventListener("click", closeProductModal);
  document.getElementById("productModal").addEventListener("click", (e) => {
    if (e.target.id === "productModal") closeProductModal();
  });

  document.getElementById("productPhotoCameraBtn").addEventListener("click", () => {
    document.getElementById("productPhotoCamera").click();
  });
  document.getElementById("productPhotoGalleryBtn").addEventListener("click", () => {
    document.getElementById("productPhotoGallery").click();
  });

  const handlePhotoChosen = (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("productPhotoPreview");
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      alert("La foto pesa demasiado (máximo 8MB). Elige otra o toma una nueva con menor calidad.");
      e.target.value = "";
      return;
    }

    selectedProductPhotoFile = file;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  };
  document.getElementById("productPhotoCamera").addEventListener("change", handlePhotoChosen);
  document.getElementById("productPhotoGallery").addEventListener("change", handlePhotoChosen);

  document.getElementById("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("productId").value;
    const stockValue = document.getElementById("productStock").value;
    const file = selectedProductPhotoFile;
    let photoUrl = document.getElementById("productPhotoUrl").value;

    if (!file && !photoUrl) {
      alert("Selecciona una foto para el producto.");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const statusEl = document.getElementById("productPhotoStatus");

    if (file) {
      submitBtn.disabled = true;
      statusEl.hidden = false;
      statusEl.textContent = "Subiendo foto…";
      try {
        photoUrl = await uploadProductPhoto(file);
      } catch (err) {
        alert("No se pudo subir la foto. Intenta de nuevo.");
        submitBtn.disabled = false;
        statusEl.hidden = true;
        return;
      }
      statusEl.hidden = true;
      submitBtn.disabled = false;
    }

    const payload = {
      name: document.getElementById("productName").value.trim(),
      unit: document.getElementById("productUnit").value.trim(),
      price: parseInt(document.getElementById("productPrice").value, 10),
      category: document.getElementById("productCategory").value,
      photo_url: photoUrl,
      stock: stockValue === "" ? null : parseInt(stockValue, 10),
      active: document.getElementById("productActive").checked,
    };

    let res;
    if (id) {
      res = await authedFetch(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      payload.slug = document.getElementById("productSlug").value.trim();
      res = await authedFetch("/admin/products", { method: "POST", body: JSON.stringify(payload) });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.detail || "No se pudo guardar el producto.");
      return;
    }

    closeProductModal();
    loadProducts();
  });
}

async function init() {
  await setupAuth();
  setupTabs();
  setupProductForm();
  setupSettingsForm();
  loadProductFormOptions(); // opciones de Unidad/Categoria para el modal de productos
  await loadProducts(); // llena productsById antes de mostrar pedidos, para ver nombres en vez de #id
  await loadOrders();

  supabaseClient.auth.onAuthStateChange(async () => {
    await loadProducts(); // primero: define isAdmin antes de pintar los pedidos
    await loadOrders();
  });
}

document.addEventListener("DOMContentLoaded", init);
