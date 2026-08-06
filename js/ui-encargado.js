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

// ---- Notificaciones del dueño (recordatorios puntuales, p. ej. al cargar
// un ticket). Se muestran arriba de todo, sin colapsar, hasta que el
// colaborador las marca como vistas. ----

function notificacionHTML(n) {
  return `
    <div class="card estado-amarillo" style="padding:12px 16px;margin-bottom:8px;">
      <div class="encargado-row">
        <div style="flex:1;min-width:140px;">
          <div style="font-weight:600;">${n.mensaje}</div>
          <div class="hint" style="margin:2px 0 0;">${n.creadoPor} · ${new Date(n.creadoEn).toLocaleDateString('es-AR')}</div>
        </div>
        <button class="secondary" data-action="marcar-notificacion-leida" data-key="${n.id}">Ya lo vi</button>
      </div>
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

// ---- Informe de gastos (compartido entre el del dueño, en ui-dueno.js, y
// el de cada encargado sobre su propia sucursal, más abajo) ----

const COLORES_INFORME = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#78350f'];

function filaInformeHTML(item, totalRef, color) {
  const pct = totalRef > 0 ? Math.round((item.total / totalRef) * 100) : 0;
  return `
    <div class="ranking-item">
      <span class="leyenda-dot" style="background:${color};"></span>
      <div class="ranking-nombre">${item.clave}</div>
      <div class="ranking-barra-track"><div class="ranking-barra-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="ranking-pct">$ ${formatearMonto(item.total)} <span style="opacity:.55;font-weight:600;">· ${pct}%</span></div>
    </div>
  `;
}

function tarjetaTotalInformeHTML(total) {
  return `
    <div class="card" style="padding:18px 20px;margin-bottom:14px;background:linear-gradient(135deg, var(--azul-bg), var(--superficie));">
      <span class="label">Total aprobado en el rango</span>
      <div style="font-size:26px;font-weight:800;">$ ${formatearMonto(total)}</div>
    </div>
  `;
}

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

// camposFormaPagoHTML() y opcionesFormaPago() están definidas en
// ui-dueno.js (mismo patrón que usan sus colas de aprobación y de pago),
// pero como acá solo se usan adentro de una función que se ejecuta
// después de que todos los scripts ya cargaron, no importa que estén en
// un archivo que se carga más tarde -- para cuando de verdad se llaman,
// ya existen.
function tarjetaGastoHTML(g) {
  const color = ESTADO_GASTO_COLOR[g.estado] || 'gris';
  const pagoTagHTML = g.estado === 'aprobado'
    ? `<span class="estado-tag estado-${ESTADO_PAGO_COLOR[g.estadoPago] || 'gris'}" style="margin-left:6px;">${ESTADO_PAGO_LABEL[g.estadoPago] || g.estadoPago}</span>`
    : '';

  const puedeMarcarPagado = g.estado === 'aprobado' && g.estadoPago === 'pendiente';
  const marcarPagadoHTML = puedeMarcarPagado ? `
    <div class="row-actions">
      <button class="secondary" data-action="toggle-marcar-pagado-propio" data-key="${g.id}" style="width:100%;">Marcar como pagado</button>
    </div>
    <div id="mp-${g.id}" style="display:none;margin-top:10px;">
      ${camposFormaPagoHTML('mp', g)}
      <div class="row-actions">
        <button class="primary" data-action="confirmar-pagado-propio" data-key="${g.id}" style="width:100%;">Confirmar pago</button>
      </div>
    </div>
  ` : '';

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
      ${marcarPagadoHTML}
    </div>
  `;
}

// Informe de gastos de UN encargado: solo su propia sucursal (RLS ya
// garantiza que Repo.getMisGastos() no puede traer gastos de nadie más),
// solo aprobados, dentro del rango de fechas elegido.
async function renderInformeGastosPropio(encargadoId) {
  const contCat = document.getElementById('informe-propio-categoria');
  if (!contCat) return;

  const desdeInput = document.getElementById('informe-propio-desde');
  const hastaInput = document.getElementById('informe-propio-hasta');
  if (!desdeInput.value) desdeInput.value = mesActualISO() + '-01';
  if (!hastaInput.value) hastaInput.value = hoyISO();

  try {
    const gastos = await Repo.getMisGastos(encargadoId);
    const porCategoria = agruparGastosAprobados(gastos, desdeInput.value, hastaInput.value, 'categoriaNombre');
    const total = porCategoria.reduce((s, x) => s + x.total, 0);

    if (porCategoria.length === 0) {
      contCat.innerHTML = '<div class="empty-msg">No hay gastos aprobados tuyos en ese rango de fechas.</div>';
      return;
    }

    contCat.innerHTML = tarjetaTotalInformeHTML(total)
      + porCategoria.map((item, i) => filaInformeHTML(item, total, COLORES_INFORME[i % COLORES_INFORME.length])).join('');
  } catch (e) {
    contCat.innerHTML = '<div class="empty-msg">No se pudo cargar el informe. Revisá tu conexión.</div>';
  }
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
  if (crearGastoBtn) {
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
    return;
  }

  const toggleMarcarPagadoBtn = ev.target.closest('[data-action="toggle-marcar-pagado-propio"]');
  if (toggleMarcarPagadoBtn) {
    const el = document.getElementById('mp-' + toggleMarcarPagadoBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const confirmarPagadoBtn = ev.target.closest('[data-action="confirmar-pagado-propio"]');
  if (confirmarPagadoBtn) {
    const key = confirmarPagadoBtn.dataset.key;
    const formaPago = document.getElementById(`mp-forma-${key}`).value;
    const chequeNumero = document.getElementById(`mp-cheque-num-${key}`).value;
    const chequeFirma = document.getElementById(`mp-cheque-firma-${key}`).value;
    if (formaPago === 'cheque' && (!chequeNumero || !chequeFirma)) {
      alert('Completá el número de cheque y la firma antes de confirmar el pago.');
      return;
    }
    (async () => {
      const encargado = await Auth.miEncargado();
      if (!encargado) return;
      Repo.marcarGastoPagadoPropio(key, { formaPago, chequeNumero, chequeFirma }).then(() => {
        renderMisGastos(encargado.id);
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  const marcarNotifLeidaBtn = ev.target.closest('[data-action="marcar-notificacion-leida"]');
  if (marcarNotifLeidaBtn) {
    const id = marcarNotifLeidaBtn.dataset.key;
    Repo.marcarNotificacionLeida(id).then(async () => {
      const encargado = await Auth.miEncargado();
      if (encargado) renderNotificacionesPropio(encargado.id);
    }).catch(manejarErrorRepo);
    return;
  }

  const filtrarInformePropioBtn = ev.target.closest('[data-action="filtrar-informe-propio"]');
  if (filtrarInformePropioBtn) {
    (async () => {
      const encargado = await Auth.miEncargado();
      if (encargado) renderInformeGastosPropio(encargado.id);
    })();
    return;
  }

  // --- Tareas de la semana ---

  const agregarTareaPropioBtn = ev.target.closest('[data-action="agregar-tarea-propio"]');
  if (agregarTareaPropioBtn) {
    (async () => {
      const input = document.getElementById('tarea-propio-texto');
      const texto = input.value.trim();
      if (!texto) { alert('Escribí la tarea.'); return; }
      const encargado = await Auth.miEncargado();
      if (!encargado) return;
      const nombre = await Auth.nombreActor();
      Repo.crearTareaSemana({ encargadoId: encargado.id, semana: lunesDeLaSemana(), texto, creadoPor: nombre }).then(() => {
        input.value = '';
        renderTareasSemana('tareas-propio-lista', 'tareas-propio-rango', encargado.id);
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  const agregarTareaDuenoBtn = ev.target.closest('[data-action="agregar-tarea-dueno"]');
  if (agregarTareaDuenoBtn) {
    (async () => {
      const input = document.getElementById('tarea-dueno-texto');
      const texto = input.value.trim();
      if (!texto) { alert('Escribí la tarea.'); return; }
      const sel = document.getElementById('select-ver-encargado');
      if (!sel || !sel.value) return;
      Repo.crearTareaSemana({ encargadoId: sel.value, semana: lunesDeLaSemana(), texto, creadoPor: 'Dueño' }).then(() => {
        input.value = '';
        renderTareasSemana('tareas-dueno-lista', 'tareas-dueno-rango', sel.value);
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  const marcarTareaHechaBtn = ev.target.closest('[data-action="marcar-tarea-hecha"]');
  const reabrirTareaBtn = ev.target.closest('[data-action="reabrir-tarea"]');
  if (marcarTareaHechaBtn || reabrirTareaBtn) {
    const btn = marcarTareaHechaBtn || reabrirTareaBtn;
    const id = btn.dataset.key;
    const enPropio = !!ev.target.closest('#panel-tareas-propio');
    const promesa = marcarTareaHechaBtn ? Repo.marcarTareaHecha(id) : Repo.reabrirTarea(id);
    promesa.then(async () => {
      if (enPropio) {
        const encargado = await Auth.miEncargado();
        if (encargado) renderTareasSemana('tareas-propio-lista', 'tareas-propio-rango', encargado.id);
      } else {
        const sel = document.getElementById('select-ver-encargado');
        if (sel && sel.value) renderTareasSemana('tareas-dueno-lista', 'tareas-dueno-rango', sel.value);
      }
    }).catch(manejarErrorRepo);
    return;
  }

  const cancelarTareaBtn = ev.target.closest('[data-action="cancelar-tarea"]');
  if (cancelarTareaBtn) {
    const id = cancelarTareaBtn.dataset.key;
    const motivo = window.prompt('¿Por qué se saca esta tarea? (queda guardado, no se borra)');
    if (motivo === null) return;
    const enPropio = !!ev.target.closest('#panel-tareas-propio');
    (async () => {
      const nombre = await Auth.nombreActor();
      Repo.cancelarTarea(id, { canceladaPor: nombre, motivo }).then(async () => {
        if (enPropio) {
          const encargado = await Auth.miEncargado();
          if (encargado) renderTareasSemana('tareas-propio-lista', 'tareas-propio-rango', encargado.id);
        } else {
          const sel = document.getElementById('select-ver-encargado');
          if (sel && sel.value) renderTareasSemana('tareas-dueno-lista', 'tareas-dueno-rango', sel.value);
        }
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  // --- Temas de reunión ---

  const crearTemaBtn = ev.target.closest('[data-action="crear-tema-reunion"]');
  if (crearTemaBtn) {
    (async () => {
      const titulo = document.getElementById('tema-titulo').value.trim();
      const descripcion = document.getElementById('tema-descripcion').value.trim();
      if (!titulo) { alert('Escribí un título para el tema.'); return; }
      const nombre = await Auth.nombreActor();
      Repo.crearTemaReunion({ titulo, descripcion, creadoPor: nombre }).then(() => {
        document.getElementById('tema-titulo').value = '';
        document.getElementById('tema-descripcion').value = '';
        renderTemasReunion();
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  const guardarTemaBtn = ev.target.closest('[data-action="guardar-tema-reunion"]');
  if (guardarTemaBtn) {
    const id = guardarTemaBtn.dataset.key;
    const respuesta = document.getElementById(`tema-respuesta-${id}`).value;
    const estado = document.getElementById(`tema-estado-${id}`).value;
    const comentario = document.getElementById(`tema-comentario-${id}`).value;
    (async () => {
      const nombre = await Auth.nombreActor();
      Repo.editarTemaReunion(id, { respuesta, estado, autor: nombre, comentario }).then(() => {
        renderTemasReunion();
      }).catch(manejarErrorRepo);
    })();
    return;
  }

  const toggleHistorialTemaBtn = ev.target.closest('[data-action="toggle-historial-tema"]');
  if (toggleHistorialTemaBtn) {
    const el = document.getElementById('historial-tema-' + toggleHistorialTemaBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
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

async function renderNotificacionesPropio(encargadoId) {
  const notifCont = document.getElementById('notificaciones-propio');
  if (!notifCont) return;
  try {
    const notifs = await Repo.getNotificacionesNoLeidas(encargadoId);
    notifCont.innerHTML = notifs.map(notificacionHTML).join('');
  } catch (e) { /* silencioso a propósito */ }
}

async function renderEncargado() {
  const cont = document.getElementById('encargado-lista');
  const bannerCont = document.getElementById('identidad-banner-propio');
  const notifCont = document.getElementById('notificaciones-propio');
  cont.innerHTML = '<div class="empty-msg">Cargando...</div>';
  if (bannerCont) bannerCont.innerHTML = '';
  if (notifCont) notifCont.innerHTML = '';

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

  // Banner de identidad y notificaciones son independientes entre sí, van
  // en paralelo. Si alguno falla, no rompe el resto de la pantalla: el
  // progreso es lo importante y tiene que verse igual aunque no carguen.
  await Promise.all([
    (async () => {
      if (!bannerCont) return;
      try {
        const identidad = await Repo.getIdentidad();
        bannerCont.innerHTML = identidadBannerHTML(identidad, encargado);
      } catch (e) { /* silencioso a propósito */ }
    })(),
    renderNotificacionesPropio(encargado.id),
  ]);

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

  // Si el panel de tareas ya estaba abierto, lo actualiza para el
  // colaborador recién elegido. Si estaba cerrado, no pide nada de más
  // (se carga recién cuando se abre).
  const panelTareasDueno = document.getElementById('panel-tareas-dueno');
  if (panelTareasDueno && panelTareasDueno.style.display !== 'none') {
    await renderTareasSemana('tareas-dueno-lista', 'tareas-dueno-rango', encargado.id);
  }
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
  await renderInformeGastosPropio(encargado.id);
}

// ---- Tareas de la semana ----
// Se pide "perezoso": recién cuando se abre el panel (no en cada cambio
// de pestaña), para no sumarle otra consulta más al arranque de la app.

function tarjetaTareaHTML(t) {
  if (t.estado === 'cancelada') {
    return `
      <div class="card estado-gris" style="padding:10px 14px;">
        <div style="text-decoration:line-through;color:var(--texto-sec);">${t.texto}</div>
        <div class="hint" style="margin:2px 0 0;">Sacada por ${t.canceladaPor}${t.canceladaMotivo ? ': ' + t.canceladaMotivo : ''}</div>
      </div>
    `;
  }
  const hecha = t.estado === 'hecha';
  return `
    <div class="card ${hecha ? 'estado-verde' : 'estado-azul'}" style="padding:10px 14px;">
      <div class="encargado-row">
        <div style="flex:1;min-width:140px;${hecha ? 'text-decoration:line-through;color:var(--texto-sec);' : ''}">${t.texto}</div>
        <div class="row-actions" style="margin-top:0;">
          <button class="secondary" data-action="${hecha ? 'reabrir-tarea' : 'marcar-tarea-hecha'}" data-key="${t.id}">${hecha ? 'Reabrir' : 'Marcar hecha'}</button>
          <button class="secondary" data-action="cancelar-tarea" data-key="${t.id}">Sacar</button>
        </div>
      </div>
      <div class="hint" style="margin:4px 0 0;">Agregada por ${t.creadoPor}</div>
    </div>
  `;
}

async function renderTareasSemana(contenedorId, rangoId, encargadoId) {
  const cont = document.getElementById(contenedorId);
  const rangoEl = document.getElementById(rangoId);
  if (!cont) return;
  const semana = lunesDeLaSemana();
  if (rangoEl) rangoEl.textContent = `Semana del ${formatearRangoSemana(semana)}.`;
  try {
    const tareas = await Repo.getTareasSemana(encargadoId, semana);
    cont.innerHTML = tareas.length === 0
      ? '<div class="empty-msg">Todavía no hay tareas cargadas para esta semana.</div>'
      : tareas.map(tarjetaTareaHTML).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty-msg">No se pudieron cargar las tareas. Revisá tu conexión.</div>';
  }
}

document.getElementById('btn-toggle-tareas-propio').addEventListener('click', async () => {
  const panel = document.getElementById('panel-tareas-propio');
  const abrir = panel.style.display === 'none';
  panel.style.display = abrir ? 'block' : 'none';
  if (abrir) {
    const encargado = await Auth.miEncargado();
    if (encargado) await renderTareasSemana('tareas-propio-lista', 'tareas-propio-rango', encargado.id);
  }
});

document.getElementById('btn-toggle-tareas-dueno').addEventListener('click', async () => {
  const panel = document.getElementById('panel-tareas-dueno');
  const abrir = panel.style.display === 'none';
  panel.style.display = abrir ? 'block' : 'none';
  if (abrir) {
    const sel = document.getElementById('select-ver-encargado');
    if (sel && sel.value) await renderTareasSemana('tareas-dueno-lista', 'tareas-dueno-rango', sel.value);
  }
});

// ---- Temas de reunión (manual compartido) ----

function tarjetaTemaHTML(t) {
  const color = t.estado === 'tratado' ? 'verde' : 'amarillo';
  const label = t.estado === 'tratado' ? 'Tratado' : 'Pendiente de tratar en reunión';
  const historial = t.historial || [];
  const historialHTML = historial.length === 0
    ? '<div class="empty-msg">Sin cambios registrados todavía.</div>'
    : historial.slice().reverse().map(h => `
        <div class="historial-row">
          <span>${new Date(h.fecha).toLocaleDateString('es-AR')} — ${h.autor}</span>
        </div>
        ${h.comentario ? `<div class="historial-nota">${h.comentario}</div>` : ''}
      `).join('');

  return `
    <div class="card estado-${color}">
      <div class="card-top">
        <div class="card-title">${t.titulo}</div>
        <span class="estado-tag estado-${color}">${label}</span>
      </div>
      <div style="font-size:12px;color:var(--texto-sec);margin-bottom:8px;">Agregado por ${t.creadoPor}</div>
      ${t.descripcion ? `<div style="margin-bottom:10px;">${t.descripcion}</div>` : ''}
      <label class="label" for="tema-respuesta-${t.id}">Respuesta / solución</label>
      <textarea id="tema-respuesta-${t.id}" placeholder="Escribí acá la solución o respuesta...">${t.respuesta}</textarea>
      <label class="label" for="tema-estado-${t.id}">Estado</label>
      <select id="tema-estado-${t.id}">
        <option value="pendiente_reunion"${t.estado === 'pendiente_reunion' ? ' selected' : ''}>Pendiente de tratar en reunión</option>
        <option value="tratado"${t.estado === 'tratado' ? ' selected' : ''}>Tratado</option>
      </select>
      <label class="label" for="tema-comentario-${t.id}">Comentario breve de este cambio (opcional)</label>
      <input type="text" id="tema-comentario-${t.id}" placeholder="Ej: corregido el horario según el nuevo turno">
      <div class="row-actions">
        <button class="primary" data-action="guardar-tema-reunion" data-key="${t.id}" style="width:100%;">Guardar cambios</button>
      </div>
      <div class="row-actions">
        <button class="secondary" data-action="toggle-historial-tema" data-key="${t.id}" style="width:100%;">Historial de cambios (${historial.length})</button>
      </div>
      <div id="historial-tema-${t.id}" style="display:none;margin-top:8px;">${historialHTML}</div>
    </div>
  `;
}

async function renderTemasReunion() {
  const cont = document.getElementById('temas-reunion-lista');
  if (!cont) return;
  try {
    const temas = await Repo.getTemasReunion();
    cont.innerHTML = temas.length === 0
      ? '<div class="empty-msg">Todavía no hay temas cargados.</div>'
      : temas.map(tarjetaTemaHTML).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty-msg">No se pudieron cargar los temas. Revisá tu conexión.</div>';
  }
}

document.getElementById('btn-toggle-temas-reunion').addEventListener('click', async () => {
  const panel = document.getElementById('panel-temas-reunion');
  const abrir = panel.style.display === 'none';
  panel.style.display = abrir ? 'block' : 'none';
  if (abrir) await renderTemasReunion();
});
