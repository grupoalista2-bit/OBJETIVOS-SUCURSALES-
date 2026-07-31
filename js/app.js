// Arranque de la app: pantalla de login (Supabase Auth), y una vez
// logueado, decide qué pestaña(s) mostrar según el rol del usuario
// (dueño o encargado) y deja esa vista activa. supabase-js guarda la
// sesión sola en este navegador, así que si ya habías iniciado sesión
// antes, entrás directo sin volver a loguearte.

// Rol del usuario logueado en esta sesión: 'dueno' o 'encargado'. Lo fija
// mostrarApp() una sola vez al entrar, y lo usan switchView() y los
// render de "Encargado"/"Gastos" para saber qué mitad de esa pestaña
// mostrar (la del dueño mirando a alguien, o la de un encargado viendo lo
// suyo). No reemplaza ningún control de seguridad — eso lo sigue haciendo
// Row Level Security en la base pase lo que pase acá en pantalla.
let rolActual = null;

async function mostrarApp() {
  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';

  const navEnc = document.getElementById('nav-btn-encargado');
  const navDueno = document.getElementById('nav-btn-dueno');

  const esDueno = await Auth.esDueno();
  rolActual = esDueno ? 'dueno' : 'encargado';

  document.getElementById('encargado-propio').style.display = rolActual === 'encargado' ? 'block' : 'none';
  document.getElementById('encargado-como-dueno').style.display = rolActual === 'dueno' ? 'block' : 'none';
  document.getElementById('gastos-encargado').style.display = rolActual === 'encargado' ? 'block' : 'none';
  document.getElementById('gastos-dueno').style.display = rolActual === 'dueno' ? 'block' : 'none';

  if (esDueno) {
    // El dueño ve las tres pestañas: su panel, la vista de un encargado a
    // elección (de solo lectura), y Gastos.
    navEnc.style.display = 'flex';
    navDueno.style.display = 'flex';
    await switchView('dueno');
    return;
  }

  // No es dueño: es un encargado (vinculado o no todavía). Solo ve
  // Encargado y Gastos — nunca la pestaña de Dueño.
  navEnc.style.display = 'flex';
  navDueno.style.display = 'none';
  await switchView('encargado');
}

function mostrarLogin() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('pantalla-login').style.display = 'block';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

async function switchView(view) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'view-' + view);
  });
  if (view === 'encargado') {
    if (rolActual === 'dueno') await renderEncargadoComoDueno();
    else await renderEncargado();
  }
  if (view === 'dueno') await renderDueno();
  if (view === 'gastos') {
    if (rolActual === 'dueno') await renderGastosDueno();
    else await renderGastosEncargado();
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

async function intentarLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!email || !password) {
    errEl.textContent = 'Completá el email y la contraseña.';
    errEl.style.display = 'block';
    return;
  }
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';
  const res = await Auth.iniciarSesion(email, password);
  btn.disabled = false;
  btn.textContent = 'Ingresar';
  if (!res.ok) {
    errEl.textContent = res.mensaje;
    errEl.style.display = 'block';
    return;
  }
  await mostrarApp();
}

document.getElementById('btn-login').addEventListener('click', intentarLogin);
['login-email', 'login-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') intentarLogin();
  });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await Auth.cerrarSesion();
  mostrarLogin();
});

document.getElementById('fecha-hoy').textContent =
  'Hoy: ' + new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

document.getElementById('nuevo-mes').value = mesActualISO();
calendarios.nuevo = new Set(diasDomingoDelMes(mesActualISO()));

document.getElementById('informe-desde').value = mesActualISO() + '-01';
document.getElementById('informe-hasta').value = hoyISO();

(async () => {
  const session = await Auth.sesionActual();
  if (session) {
    await mostrarApp();
  } else {
    mostrarLogin();
  }
})();
