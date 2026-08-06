// Vista Encargado: solo lectura del propio progreso. El login ya pasó
// (pantalla global en app.js); acá solo se muestra lo que le corresponde
// al usuario logueado, según lo que permite Row Level Security.

// ---- Progreso semanal (compartido entre la tarjeta de solo lectura y el
// dashboard editable del dueño en ui-dueno.js) ----

function progresoSemanalHTML(obj) {
  const semanas = progresoSemanalObjetivo(obj);
  if (semanas.every(s => s.metaSemana === 0)) return '';
  const filas = semanas.map(s => {
    const pctBarra = Math.min(100, Math.max(0, s.pct));
    let color = 'var(--azul)';
    if (s.metaSemana > 0 && s.cumplida) color = 'var(--verde)';
    else if (s.metaSemana > 0 && s.yaTermino) color = 'var(--rojo)';
    return `
      <div class="ranking-item">
        <div class="ranking-nombre">Sem. ${s.numero} (${formatearFechaCorta(s.inicio)}–${formatearFechaCorta(s.fin)})</div>
        <div class="ranking-barra-track"><div class="ranking-barra-fill" style="width:${pctBarra}%;background:${color}"></div></div>
        <div class="ranking-pct">${s.logrado}/${s.metaSemana}</div>
      </div>
    `;
  }).join('');
  return `<div class="section-title" style="font-size:12px;margin:16px 0 8px;">Progreso semanal</div>${filas}`;
}

// ---- Identidad institucional (Propósito / Misión / Visión) ----
// Solo muestra los bloques que el dueño habilitó para ESE encargado
// puntual, y solo si además tienen texto cargado.

function identidadBannerHTML(identidad, encargado) {
  const bloques = [];
  if (encargado.veProposito && identidad.proposito) bloques.push({ titulo: 'Propósito', texto: identidad.proposito });
  if (encargado.veMision && identidad.mision) bloques.push({ titulo: 'Misión', texto: identidad.mision });
  if (encargado.veVision && identidad.vision) bloques.push({ titulo: 'Visión', texto: identidad.vision });
  if (bloques.length === 0) return '';
  return `
    <div class="card estado-azul" style="background:var(--azul-bg);">
      ${bloques.map(b => `
        <div style="margin-bottom:10px;">
          <div class="label" style="color:var(--azul);">${b.titulo}</div>
          <div style="font-size:14px;line-height:1.5;">${b.texto}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function tarjetaProgresoSoloLecturaHTML(obj) {
  const { avance, superado, r, unidad, mensajeEstado, colorCard } = resumenObjetivoProgreso(obj);

  const historialHTML = obj.historial.length === 0
    ? '<div class="empty-msg">Todavía no hay tickets cargados este mes.</div>'
    : obj.historial.map(h => `
        <div class="historial-row">
          <span>${formatearFechaCorta(h.fecha)}</span>
          <strong>${h.valor} ${unidad}</strong>
        </div>
        ${h.nota ? `<div class="historial-nota">${h.nota}</div>` : ''}
      `).join('');

  return `
    <div class="card estado-${colorCard}">
      <div class="card-top">
        <div class="card-title">${obj.titulo}</div>
        <span class="estado-tag estado-${superado ? 'verde' : 'azul'}">${avance}%${superado ? ' · meta alcanzada' : ''}</span>
      </div>
      <div class="meta-grid">
        <div><span class="label">Meta</span>${obj.meta} ${unidad}</div>
        <div><span class="label">Llevás</span>${obj.valorActual} ${unidad}</div>
        <div><span class="label">Mes</span>${formatearMes(obj.mes)}</div>
        <div><span class="label">Días no laborales</span>${formatearListaFechasCorta(obj.diasNoLaborales)}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${avance}%"></div></div>
      <div class="meta-grid">
        <div><span class="label">Días hábiles del mes</span>${r.totalHabiles}</div>
        <div><span class="label">Transcurridos</span>${r.habilesTranscurridos}</div>
        <div><span class="label">Restantes</span>${r.habilesRestantes}</div>
        <div><span class="label">Deberías llevar hoy</span>${r.avanceEsperado} ${unidad}</div>
      </div>
      <div class="decision-note" style="background:${r.enRitmo || r.faltante <= 0 ? 'var(--verde-bg)' : 'var(--rojo-bg)'};color:${r.enRitmo || r.faltante <= 0 ? 'var(--verde)' : 'var(--rojo)'};">
        ${mensajeEstado}
      </div>
      <div class="section-title" style="font-size:12px;margin:16px 0 8px;">Historial de cargas</div>
      ${historialHTML}
      ${progresoSemanalHTML(obj)}
    </div>
  `;
}

// ---- Gastos de la sucursal ----

const ESTADO_GASTO_LABEL = { pendiente: 'Pendiente de aprobación', aprobado: 'Aprobado', rechazado: 'Rechazado' };
const ESTADO_GASTO_COLOR = { pendiente: 'amarillo', aprobado: 'verde', rechazado: 'rojo' };
const ESTADO_PAGO_LABEL = { pendiente: 'Pendiente de pago', pagado: 'Pagado' };
const ESTADO_PAGO_COLOR = { pendiente: 'amarillo', pagado: 'verde' };
const FORMA_PAGO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque' };

async function poblarSelectCategoriaGasto() {
  const sel = document.getElementById('gasto-categoria');
  if (!sel) return;
  try {
    const categorias = (await Repo.getCategoriasGasto()).filter(c => c.activa);
    const prev = sel.value;
    sel.innerHTML = categorias.length === 0
      ? '<option value="">Todavía no hay categorías cargadas</option>'
      : categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    if (prev && categorias.some(c => c.id === prev)) sel.value = prev;
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudieron cargar las categorías</option>';
  }
}

async function poblarSelectProveedor() {
  const sel = document.getElementById('gasto-proveedor');
  if (!sel) return;
  try {
    const proveedores = (await Repo.getProveedores()).filter(p => p.activo);
    const prev = sel.value;
    sel.innerHTML = proveedores.length === 0
      ? '<option value="">Todavía no hay proveedores cargados</option>'
      : proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    if (prev && proveedores.some(p => p.id === prev)) sel.value = prev;
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudieron cargar los proveedores</option>';
  }
}

// Muestra u oculta los campos de "Número de cheque" / "Firma" según la
// forma de pago elegida. Se llama al cambiar el select y también al
// renderizar, para que arranque en el estado correcto.
function actualizarCamposCheque() {
  const formaPago = document.getElementById('gasto-forma-pago').value;
  const cont = document.getElementById('gasto-cheque-datos');
  if (!cont) return;
  cont.style.display = formaPago === 'cheque' ? 'block' : 'none';
}
document.getElementById('gasto-forma-pago').addEventListener('change', actualizarCamposCheque);

function detalleFormaPagoHTML(g) {
  const base = FORMA_PAGO_LABEL[g.formaPago] || g.formaPago;
  if (g.formaPago !== 'cheque') return base;
  const partes = [];
  if (g.chequeNumero) partes.push(`N.° ${g.chequeNumero}`);
  if (g.chequeFirma) partes.push(`firma: ${g.chequeFirma}`);
  return partes.length ? `${base} (${partes.join(', ')})` : base;
}

function tarjetaGastoHTML(g) {
  const color = ESTADO_GASTO_COLOR[g.estado] || 'gris';
  const pagoTagHTML = g.estado === 'aprobado'
    ? `<span class="estado-tag estado-${ESTADO_PAGO_COLOR[g.estadoPago] || 'gris'}" style="margin-left:6px;">${ESTADO_PAGO_LABEL[g.estadoPago] || g.estadoPago}</span>`
    : '';
  return `
    <div class="card estado-${color}" style="padding:12px 16px;">
      <div class="card-top">
        <div>
          <div style="font-weight:600;">${g.categoriaNombre}${g.proveedorNombre ? ' — ' + g.proveedorNombre : ''}</div>
          <div style="font-size:12px;color:var(--texto-sec);">${formatearFechaCorta(g.fecha)} · ${detalleFormaPagoHTML(g)}</div>
        </div>
        <div style="text-align:right;">
          <span class="estado-tag estado-${color}">${ESTADO_GASTO_LABEL[g.estado] || g.estado}</span>
          ${pagoTagHTML}
        </div>
      </div>
      <div style="font-size:17px;font-weight:800;margin-top:6px;">$ ${formatearMonto(g.monto)}</div>
      ${g.nota ? `<div class="historial-nota" style="margin-top:6px;">${g.nota}</div>` : ''}
    </div>
  `;
}

async function renderMisGastos(encargadoId) {
  const cont = document.getElementById('mis-gastos-lista');
  if (!cont) return;
  try {
    const gastos = await Repo.getMisGastos(encargadoId);
    cont.innerHTML = gastos.length === 0
      ? '<div class="empty-msg">Todavía no cargaste ningún gasto.</div>'
      : gastos.map(tarjetaGastoHTML).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty-msg">No se pudieron cargar tus gastos. Revisá tu conexión.</div>';
  }
}

document.addEventListener('click', (ev) => {
  const crearGastoBtn = ev.target.closest('[data-action="crear-gasto"]');
  if (!crearGastoBtn) return;

  (async () => {
    const encargado = await Auth.miEncargado();
    if (!encargado) { alert('Tu usuario todavía no está vinculado a ningún encargado.'); return; }

    const categoriaId = document.getElementById('gasto-categoria').value;
    const proveedorId = document.getElementById('gasto-proveedor').value;
    const monto = document.getElementById('gasto-monto').value;
    const fecha = document.getElementById('gasto-fecha').value;
    const nota = document.getElementById('gasto-nota').value.trim();
    const formaPago = document.getElementById('gasto-forma-pago').value;
    const chequeNumero = document.getElementById('gasto-cheque-numero').value.trim();
    const chequeFirma = document.getElementById('gasto-cheque-firma').value.trim();

    if (!categoriaId) { alert('Elegí una categoría (si no hay ninguna, pedile al dueño que cargue alguna primero).'); return; }
    if (!proveedorId) { alert('Elegí un proveedor/entidad (si no hay ninguno, pedile al dueño que cargue alguno primero).'); return; }
    if (!nota) { alert('Completá el concepto del gasto.'); return; }
    if (!monto || Number(monto) <= 0) { alert('Ingresá un monto mayor a cero.'); return; }
    if (!fecha) { alert('Elegí la fecha del gasto.'); return; }
    if (formaPago === 'cheque' && (!chequeNumero || !chequeFirma)) {
      alert('Completá el número de cheque y a nombre de quién es la firma.');
      return;
    }

    Repo.crearGasto({
      encargadoId: encargado.id, categoriaId, proveedorId, monto, fecha, nota,
      formaPago, chequeNumero, chequeFirma,
    }).then(() => {
      document.getElementById('gasto-monto').value = '';
      document.getElementById('gasto-nota').value = '';
      document.getElementById('gasto-fecha').value = hoyISO();
      document.getElementById('gasto-cheque-numero').value = '';
      document.getElementById('gasto-cheque-firma').value = '';
      renderMisGastos(encargado.id);
    }).catch(manejarErrorRepo);
  })();
});

// Arma las tarjetas de progreso de un encargado (propias o, si mira el
// dueño, de quien haya elegido) dentro del contenedor indicado. Compartida
// entre renderEncargado() y renderEncargadoComoDueno() para no duplicar
// la lógica de lectura.
async function renderTarjetasObjetivos(contenedorId, encargado, mensajePausado) {
  const cont = document.getElementById(contenedorId);
  let html = '';
  if (!encargado.activo) {
    html += `<div class="card estado-gris" style="font-size:13px;">${mensajePausado}</div>`;
  }
  try {
    const objetivos = await Repo.getObjetivosDeEncargado(encargado.id);
    html += objetivos.length === 0
      ? '<div class="empty-msg">Todavía no tiene un objetivo de progreso asignado.</div>'
      : objetivos.map(tarjetaProgresoSoloLecturaHTML).join('');
  } catch (e) {
    html += '<div class="empty-msg">No se pudieron cargar los objetivos. Revisá tu conexión e intentá de nuevo.</div>';
  }
  cont.innerHTML = html;
}

async function renderEncargado() {
  const cont = document.getElementById('encargado-lista');
  const bannerCont = document.getElementById('identidad-banner-propio');
  cont.innerHTML = '<div class="empty-msg">Cargando...</div>';
  if (bannerCont) bannerCont.innerHTML = '';

  let encargado;
  try {
    encargado = await Auth.miEncargado();
  } catch (e) {
    cont.innerHTML = '<div class="empty-msg">No se pudo cargar tu información. Revisá tu conexión e intentá de nuevo.</div>';
    return;
  }

  if (!encargado) {
    cont.innerHTML = '<div class="empty-msg">Tu usuario todavía no está vinculado a ningún encargado. Pedile al dueño que complete el campo "ID de usuario" en tu perfil, dentro de su panel.</div>';
    return;
  }

  // Si esto falla, no rompe el resto de la pantalla: el progreso es lo
  // importante y tiene que verse igual aunque el banner no cargue.
  if (bannerCont) {
    try {
      const identidad = await Repo.getIdentidad();
      bannerCont.innerHTML = identidadBannerHTML(identidad, encargado);
    } catch (e) { /* silencioso a propósito */ }
  }

  await renderTarjetasObjetivos(
    'encargado-lista',
    encargado,
    'Este perfil está pausado por el dueño. Podés seguir viendo el progreso, pero no se van a cargar tickets nuevos hasta que se reactive.'
  );
}

// ---- Vista "Encargado" cuando quien mira es el dueño ----
// Le deja elegir a quién ver, y muestra exactamente la misma tarjeta de
// solo lectura que ve ese encargado, sin poder editar nada desde acá
// (para eso está el Dashboard de progreso, dentro de su propio panel).

async function poblarSelectVerEncargado() {
  const sel = document.getElementById('select-ver-encargado');
  const encargados = await Repo.getEncargados();
  const prev = sel.value;
  sel.innerHTML = encargados.length === 0
    ? '<option value="">Todavía no hay encargados cargados</option>'
    : encargados.map(e => `<option value="${e.id}">${e.nombre} — ${e.sucursal}${e.activo ? '' : ' (pausado)'}</option>`).join('');
  if (prev && encargados.some(e => e.id === prev)) sel.value = prev;
  return encargados;
}

async function renderEncargadoComoDueno() {
  const cont = document.getElementById('encargado-lista-dueno');
  let encargados;
  try {
    encargados = await poblarSelectVerEncargado();
  } catch (e) {
    cont.innerHTML = '<div class="empty-msg">No se pudo cargar la lista de encargados. Revisá tu conexión.</div>';
    return;
  }

  if (encargados.length === 0) {
    cont.innerHTML = '<div class="empty-msg">Todavía no agregaste ningún encargado.</div>';
    return;
  }

  const sel = document.getElementById('select-ver-encargado');
  const encargado = encargados.find(e => e.id === sel.value) || encargados[0];
  sel.value = encargado.id;

  const bannerCont = document.getElementById('identidad-banner-dueno');
  if (bannerCont) {
    try {
      const identidad = await Repo.getIdentidad();
      bannerCont.innerHTML = identidadBannerHTML(identidad, encargado);
    } catch (e) { bannerCont.innerHTML = ''; }
  }

  await renderTarjetasObjetivos(
    'encargado-lista-dueno',
    encargado,
    'Este perfil está pausado. No se van a cargar tickets nuevos hasta que lo reactives.'
  );
}

document.getElementById('select-ver-encargado').addEventListener('change', () => {
  renderEncargadoComoDueno();
});

// Contenido de la pestaña "Gastos" cuando el usuario logueado es un
// encargado (la otra mitad de esa pestaña, para el dueño, vive en
// ui-dueno.js como renderGastosDueno()).
async function renderGastosEncargado() {
  const encargado = await Auth.miEncargado();
  if (!encargado) {
    document.getElementById('mis-gastos-lista').innerHTML = '<div class="empty-msg">Tu usuario todavía no está vinculado a ningún encargado. Pedile al dueño que lo vincule desde su panel.</div>';
    return;
  }
  const fechaInput = document.getElementById('gasto-fecha');
  if (!fechaInput.value) fechaInput.value = hoyISO();
  await poblarSelectCategoriaGasto();
  await poblarSelectProveedor();
  actualizarCamposCheque();
  await renderMisGastos(encargado.id);
}
