/* Login compartido (index.html + panel-fm93k.html). Un solo lugar para
   el cliente de Supabase y el flujo de login, asi el selector de
   proveedor (Google / Facebook / Apple) aplica igual en ambas paginas. */

const SUPABASE_URL = "https://ezpqfzjbauxluvxmqxvj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_p_8lr7P8Ll3aqe9ySpNOQQ_Rv-1BXUf"; // publica, segura de exponer en el frontend

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ICONS = {
  google: `<svg viewBox="0 0 18 18" width="20" height="20"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#111" d="M17.05 12.536c-.028-2.79 2.278-4.132 2.38-4.196-1.298-1.897-3.317-2.157-4.033-2.187-1.716-.174-3.35 1.01-4.222 1.01-.872 0-2.216-.984-3.643-.957-1.874.028-3.604 1.09-4.568 2.766-1.95 3.38-.497 8.386 1.4 11.13.93 1.34 2.037 2.845 3.49 2.79 1.4-.056 1.93-.9 3.62-.9 1.687 0 2.166.9 3.646.872 1.505-.028 2.457-1.367 3.375-2.712 1.064-1.552 1.5-3.058 1.522-3.135-.033-.015-2.918-1.12-2.947-4.48zM14.478 4.2c.77-.933 1.29-2.23 1.148-3.522-1.108.045-2.45.738-3.246 1.67-.712.826-1.336 2.145-1.168 3.41 1.232.096 2.494-.626 3.266-1.558z"/></svg>`,
};

function ensureLoginModal() {
  if (document.getElementById("loginModal")) return;

  const overlay = document.createElement("div");
  overlay.id = "loginModal";
  overlay.className = "login-modal-overlay";
  overlay.innerHTML = `
    <div class="login-modal">
      <button class="login-modal-close" id="loginModalClose" aria-label="Cerrar">✕</button>
      <h2>Inicia sesión</h2>
      <p>Elige una cuenta para continuar</p>
      <div class="login-providers">
        <button class="login-provider-btn" data-provider="google">
          ${ICONS.google}<span>Continuar con Google</span>
        </button>
        <button class="login-provider-btn" data-provider="facebook" disabled>
          ${ICONS.facebook}<span>Continuar con Facebook</span><span class="provider-soon">Próximamente</span>
        </button>
        <button class="login-provider-btn" data-provider="apple" disabled>
          ${ICONS.apple}<span>Continuar con Apple</span><span class="provider-soon">Próximamente</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#loginModalClose").addEventListener("click", closeLoginModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLoginModal();
  });

  overlay.querySelector('[data-provider="google"]').addEventListener("click", async () => {
    // window.location.origin no alcanza en GitHub Pages: el sitio vive en una
    // subcarpeta (/frescos-market/), no en la raiz del dominio como en Netlify.
    // .href conserva la carpeta actual para volver exactamente ahi.
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
  });
}

function openLoginModal() {
  ensureLoginModal();
  document.getElementById("loginModal").classList.add("open");
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("open");
}

function renderAuthUI(session) {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;
  const user = session && session.user;

  if (user) {
    const name = user.user_metadata?.full_name || user.email;
    const avatar = user.user_metadata?.avatar_url;
    authArea.innerHTML = `
      <div class="user-chip">
        ${avatar ? `<img class="user-avatar" src="${avatar}" alt="">` : ""}
        <span class="user-name">${name}</span>
        <button class="btn-logout" id="logoutBtn">Salir</button>
      </div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
    });
  } else {
    authArea.innerHTML = `<button class="btn-login" id="loginBtn">Iniciar sesión</button>`;
    document.getElementById("loginBtn").addEventListener("click", openLoginModal);
  }
}

async function setupAuth() {
  // Si getSession() falla (red, CORS al abrir el archivo local, etc.) igual
  // se debe mostrar el boton de login en vez de dejar el area vacia.
  try {
    const { data } = await supabaseClient.auth.getSession();
    renderAuthUI(data.session);
  } catch (e) {
    renderAuthUI(null);
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderAuthUI(session);
    closeLoginModal();
  });
}
