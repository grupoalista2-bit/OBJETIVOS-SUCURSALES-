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

// true mientras la persona está en medio del flujo de "recuperar
// contraseña" (llegó acá desde el link del mail, todavía no puso su
// contraseña nueva). Mientras dure, se le esconde el resto de la app para
// que no pueda tocar nada más hasta terminar ese paso.
let enRecuperacion = false;

// Supabase crea una sesión temporal apenas se detecta el link de
// recuperación en la URL y dispara el evento PASSWORD_RECOVERY (esto lo
// registra config.js apenas se crea supabaseClient, antes que nada más;
// acá solo se define QUÉ hacer cuando eso pasa).
function mostrarRecuperacionClave() {
  enRecuperacion = true;
  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  document.getElementById('main').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
  document.getElementById('btn-cambiar-clave').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
  document.getElementById('clave-nueva').value = '';
  document.getElementById('clave-repetir').value = '';
  document.getElementById('clave-error').style.display = 'none';
  document.getElementById('clave-ok').style.display = 'none';
  document.getElementById('panel-cambiar-clave').style.display = 'block';
}

// Deshace lo que hizo mostrarRecuperacionClave() y vuelve a dejar la app
// como estaba (usado al cancelar o al terminar de cambiar la contraseña).
function salirDeRecuperacionClave() {
  enRecuperacion = false;
  document.getElementById('main').style.display = '';
  document.querySelector('.bottom-nav').style.display = '';
  document.getElementById('btn-cambiar-clave').style.display = '';
  document.getElementById('btn-logout').style.display = '';
  document.getElementById('panel-cambiar-clave').style.display = 'none';
}

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
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  errEl.classList.remove('exito');
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
  errEl.classList.remove('exito');
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

// ---- Cambiar mi contraseña (mientras ya estoy logueado) ----

document.getElementById('btn-cambiar-clave').addEventListener('click', () => {
  document.getElementById('clave-nueva').value = '';
  document.getElementById('clave-repetir').value = '';
  document.getElementById('clave-error').style.display = 'none';
  document.getElementById('clave-ok').style.display = 'none';
  document.getElementById('panel-cambiar-clave').style.display = 'block';
});

document.addEventListener('click', (ev) => {
  const cancelarClaveBtn = ev.target.closest('[data-action="cancelar-clave"]');
  if (cancelarClaveBtn) {
    if (enRecuperacion) {
      // No la dejamos "cancelar" sin más: si vino del link de
      // recuperación, la sesión temporal no le sirve para nada dentro de
      // la app (no eligió contraseña nueva), así que la cerramos y la
      // mandamos de vuelta al login.
      salirDeRecuperacionClave();
      Auth.cerrarSesion().then(mostrarLogin);
      return;
    }
    document.getElementById('panel-cambiar-clave').style.display = 'none';
    return;
  }

  const guardarClaveBtn = ev.target.closest('[data-action="guardar-clave"]');
  if (guardarClaveBtn) {
    const nueva = document.getElementById('clave-nueva').value;
    const repetir = document.getElementById('clave-repetir').value;
    const errEl = document.getElementById('clave-error');
    const okEl = document.getElementById('clave-ok');
    errEl.style.display = 'none';
    okEl.style.display = 'none';

    if (!nueva || nueva.length < 6) {
      errEl.textContent = 'La contraseña tiene que tener al menos 6 caracteres.';
      errEl.style.display = 'block';
      return;
    }
    if (nueva !== repetir) {
      errEl.textContent = 'Las dos contraseñas no coinciden.';
      errEl.style.display = 'block';
      return;
    }

    guardarClaveBtn.disabled = true;
    Auth.cambiarPassword(nueva).then(async res => {
      guardarClaveBtn.disabled = false;
      if (!res.ok) {
        errEl.textContent = res.mensaje;
        errEl.style.display = 'block';
        return;
      }
      document.getElementById('clave-nueva').value = '';
      document.getElementById('clave-repetir').value = '';

      if (enRecuperacion) {
        // Ya quedó guardada la contraseña nueva: cerramos esta sesión
        // temporal y la mandamos a loguearse de cero con la contraseña
        // que acaba de elegir (más prolijo que dejarla a mitad de camino
        // dentro de una sesión que arrancó como recuperación).
        salirDeRecuperacionClave();
        await Auth.cerrarSesion();
        mostrarLogin();
        const loginErrEl = document.getElementById('login-error');
        loginErrEl.textContent = 'Contraseña actualizada. Iniciá sesión con la nueva contraseña.';
        loginErrEl.classList.add('exito');
        loginErrEl.style.display = 'block';
        return;
      }

      okEl.textContent = 'Listo — contraseña actualizada. La vas a usar la próxima vez que inicies sesión.';
      okEl.style.display = 'block';
    }).catch(() => {
      guardarClaveBtn.disabled = false;
      errEl.textContent = 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.';
      errEl.style.display = 'block';
    });
    return;
  }
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
