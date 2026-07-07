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

function setState(html) {
  document.getElementById("adminState").innerHTML = html;
}

function renderOrders(orders) {
  const list = document.getElementById("ordersList");

  if (orders.length === 0) {
    list.innerHTML = "";
    setState("<p>Todavía no hay pedidos.</p>");
    return;
  }

  setState("");
  list.innerHTML = orders
    .map((order) => {
      const itemsHtml = order.items
        .map(
          (item) =>
            `<li>Producto #${item.product_id} × ${item.quantity} — ${currency.format(item.subtotal)}</li>`
        )
        .join("");
      const date = new Date(order.created_at).toLocaleString("es-CO");

      return `
        <div class="order-card" data-id="${order.id}">
          <div class="order-card-head">
            <div>
              <div class="order-customer">${order.customer_name}</div>
              <div class="order-date">${date}</div>
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
        await updateOrderStatus(orderId, newStatus);
      } catch (e) {
        alert("No se pudo actualizar el estado. Intenta de nuevo.");
      }
      select.disabled = false;
    });
  });
}

async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function loadOrders() {
  const token = await getAccessToken();
  if (!token) {
    setState("<p>Inicia sesión para continuar.</p>");
    document.getElementById("ordersList").innerHTML = "";
    return;
  }

  setState("Cargando pedidos…");

  const res = await fetch(`${API_BASE_URL}/admin/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    setState("<p>Tu cuenta no tiene acceso a este panel.</p>");
    document.getElementById("ordersList").innerHTML = "";
    return;
  }

  if (!res.ok) {
    setState("<p>Ocurrió un error cargando los pedidos. Intenta recargar la página.</p>");
    return;
  }

  const orders = await res.json();
  renderOrders(orders);
}

async function updateOrderStatus(orderId, status) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("update failed");
}

async function init() {
  await setupAuth();
  await loadOrders();

  supabaseClient.auth.onAuthStateChange(() => {
    loadOrders();
  });
}

document.addEventListener("DOMContentLoaded", init);
