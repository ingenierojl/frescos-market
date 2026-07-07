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
      if (target === "products" && document.getElementById("productsList").dataset.loaded !== "true") {
        loadProducts();
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
        </div>
      `;
    })
    .join("");

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
  if (!res.ok) return;
  const products = await res.json();
  renderProducts(products);
}

function openProductModal(product) {
  const form = document.getElementById("productForm");
  form.reset();
  document.getElementById("productModalTitle").textContent = product ? "Editar producto" : "Agregar producto";
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productSlug").value = product ? product.slug : "";
  document.getElementById("productSlug").disabled = !!product; // el slug no se cambia al editar
  document.getElementById("productName").value = product ? product.name : "";
  document.getElementById("productUnit").value = product ? product.unit : "";
  document.getElementById("productPrice").value = product ? product.price : "";
  document.getElementById("productCategory").value = product ? product.category : "hortalizas";
  document.getElementById("productPhoto").value = product ? product.photo_url : "";
  document.getElementById("productStock").value = product && product.stock !== null ? product.stock : "";
  document.getElementById("productActive").checked = product ? product.active : true;
  document.getElementById("productModal").classList.add("open");
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

  document.getElementById("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("productId").value;
    const stockValue = document.getElementById("productStock").value;

    const payload = {
      name: document.getElementById("productName").value.trim(),
      unit: document.getElementById("productUnit").value.trim(),
      price: parseInt(document.getElementById("productPrice").value, 10),
      category: document.getElementById("productCategory").value,
      photo_url: document.getElementById("productPhoto").value.trim(),
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
  await loadProducts(); // llena productsById antes de mostrar pedidos, para ver nombres en vez de #id
  await loadOrders();

  supabaseClient.auth.onAuthStateChange(() => {
    loadProducts();
    loadOrders();
  });
}

document.addEventListener("DOMContentLoaded", init);
