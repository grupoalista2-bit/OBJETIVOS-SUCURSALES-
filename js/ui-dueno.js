// Vista Dueño: administra encargados (con edición, pausa y vínculo a su
// usuario de Supabase), crea objetivos mensuales de tickets con calendario
// de días no laborales, carga los tickets día a día, ve el dashboard de
// progreso, y compara encargados entre sí. El acceso a esta vista ya está
// filtrado en app.js según el rol del usuario logueado, y reforzado por
// Row Level Security en la base: si alguien sin permiso de dueño llegara
// a esta pantalla, cada Repo.* que intente escribir va a fallar igual.

function nombreEncargado(encargados, encargadoId) {
  const enc = encargados.find(e => e.id === encargadoId);
  return enc ? `${enc.nombre} — ${enc.sucursal}` : '(encargado eliminado)';
}

// ---- Identidad institucional (Propósito / Misión / Visión) ----

async function renderIdentidad(identidad) {
  identidad = identidad || await Repo.getIdentidad();
  document.getElementById('identidad-proposito').value = identidad.proposito;
  document.getElementById('identidad-mision').value = identidad.mision;
  document.getElementById('identidad-vision').value = identidad.vision;
  document.getElementById('identidad-valores').value = identidad.valores;
  renderIdentidadPreview();
}

// Vista previa del "cartel" con lo que hay cargado en el formulario en
// este momento, sin filtrar por colaborador (el dueño ve siempre las
// cuatro secciones acá, aunque a tal o cual colaborador después no se le
// muestren todas). Se recalcula solo con lo que ya está en pantalla, sin
// pedirle nada a Supabase, así responde al instante mientras se escribe.
function renderIdentidadPreview() {
  const cont = document.getElementById('identidad-preview');
  if (!cont) return;
  const bloques = [];
  const proposito = document.getElementById('identidad-proposito').value.trim();
  const mision = document.getElementById('identidad-mision').value.trim();
  const vision = document.getElementById('identidad-vision').value.trim();
  const valores = document.getElementById('identidad-valores').value.trim();
  if (proposito) bloques.push({ titulo: 'Propósito', texto: proposito });
  if (mision) bloques.push({ titulo: 'Misión', texto: mision });
  if (vision) bloques.push({ titulo: 'Visión', texto: vision });
  if (valores) bloques.push({ titulo: 'Principios y valores', texto: valores });
  cont.innerHTML = bloques.length === 0
    ? '<div class="empty-msg">Todavía no cargaste nada. A medida que escribas acá arriba, vas a ver el cartel tomar forma.</div>'
    : identidadCartelHTML(bloques);
}

['identidad-proposito', 'identidad-mision', 'identidad-vision', 'identidad-valores'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', renderIdentidadPreview);
});

async function renderResumenDueno(encargados, objetivos) {
  encargados = encargados || await Repo.getEncargados();
  objetivos = objetivos || await Repo.getObjetivosProgreso();

  let sumAvance = 0, enRiesgo = 0;
  objetivos.forEach(obj => {
    const { avance, superado, r } = resumenObjetivoProgreso(obj);
    sumAvance += avance;
    if (!superado && !r.enRitmo) enRiesgo++;
  });
  const avancePromedio = objetivos.length > 0 ? Math.round(sumAvance / objetivos.length) : 0;
  const activos = encargados.filter(e => e.activo).length;

  document.getElementById('dueno-resumen').innerHTML = `
    <div class="summary-card"><div class="num">${activos}/${encargados.length}</div><div class="lbl">Encargados activos</div></div>
    <div class="summary-card"><div class="num">${objetivos.length}</div><div class="lbl">Objetivos activos</div></div>
    <div class="summary-card"><div class="num" style="color:${avancePromedio >= 70 ? 'var(--verde)' : 'var(--rojo)'}">${avancePromedio}%</div><div class="lbl">Avance promedio</div></div>
    <div class="summary-card"><div class="num" style="color:var(--rojo)">${enRiesgo}</div><div class="lbl">Atrasados</div></div>
  `;
}

async function renderEncargadosLista(encargados) {
  encargados = encargados || await Repo.getEncargados();
  const cont = document.getElementById('encargados-lista');

  cont.innerHTML = encargados.length === 0
    ? '<div class="empty-msg">Todavía no agregaste ningún encargado.</div>'
    : encargados.map(e => `
        <div class="card estado-${e.activo ? 'verde' : 'gris'}" style="padding:12px 16px;">
          <div class="encargado-row">
            <div class="datos">
              <strong>${e.nombre}</strong>
              <div style="font-size:12px;color:var(--texto-sec);">${e.sucursal}</div>
              <span class="estado-tag estado-${e.activo ? 'verde' : 'gris'}" style="margin-top:6px;display:inline-block;">${e.activo ? 'Activo' : 'Pausado'}</span>
              ${e.userId ? '<span class="estado-tag estado-azul" style="margin-top:6px;margin-left:6px;display:inline-block;">Cuenta vinculada</span>' : '<span class="estado-tag estado-gris" style="margin-top:6px;margin-left:6px;display:inline-block;">Sin vincular</span>'}
            </div>
            <div class="row-actions" style="margin-top:0;">
              <button class="secondary" data-action="toggle-editar-encargado" data-key="${e.id}">Editar</button>
              <button class="secondary" data-action="toggle-pausa-encargado" data-key="${e.id}">${e.activo ? 'Pausar' : 'Reactivar'}</button>
            </div>
          </div>
          <div id="editar-enc-${e.id}" style="display:none;margin-top:12px;">
            <label class="label" for="editar-enc-nombre-${e.id}">Nombre</label>
            <input type="text" id="editar-enc-nombre-${e.id}" value="${e.nombre}">
            <label class="label" for="editar-enc-sucursal-${e.id}">Sucursal</label>
            <input type="text" id="editar-enc-sucursal-${e.id}" value="${e.sucursal}">
            <label class="label" for="editar-enc-userid-${e.id}">ID de usuario (Supabase Auth)</label>
            <input type="text" id="editar-enc-userid-${e.id}" value="${e.userId}" placeholder="Pegá acá el UUID del usuario que creaste para esta persona">
            <p class="hint" style="margin-top:-4px;">Se copia desde Authentication &gt; Users en el dashboard de Supabase. Dejalo vacío si todavía no le creaste una cuenta.</p>
            <label class="label">Qué puede ver de la identidad institucional</label>
            <div class="row-actions" style="margin-top:0;margin-bottom:12px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:1 1 auto;">
                <input type="checkbox" id="editar-enc-veproposito-${e.id}"${e.veProposito ? ' checked' : ''}> Propósito
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:1 1 auto;">
                <input type="checkbox" id="editar-enc-vemision-${e.id}"${e.veMision ? ' checked' : ''}> Misión
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:1 1 auto;">
                <input type="checkbox" id="editar-enc-vevision-${e.id}"${e.veVision ? ' checked' : ''}> Visión
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:1 1 auto;">
                <input type="checkbox" id="editar-enc-vevalores-${e.id}"${e.veValores ? ' checked' : ''}> Valores
              </label>
            </div>
            <div class="row-actions">
              <button class="primary" data-action="guardar-edicion-encargado" data-key="${e.id}" style="width:100%;">Guardar cambios</button>
            </div>
          </div>
        </div>
      `).join('');

  const sel = document.getElementById('nuevo-obj-encargado');
  const prev = sel.value;
  sel.innerHTML = '';
  if (encargados.length === 0) {
    sel.innerHTML = '<option value="">Agregá un encargado primero</option>';
  } else {
    encargados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.nombre} — ${e.sucursal}${e.activo ? '' : ' (pausado)'}`;
      sel.appendChild(opt);
    });
    if (prev && encargados.some(e => e.id === prev)) sel.value = prev;
  }
}

// ---- Calendario de días no laborales (reutilizable: creación y edición) ----
// "contexto" es 'nuevo' para el formulario de alta, o el id del objetivo
// cuando se está editando uno ya creado. Cada contexto tiene su propio Set.

const calendarios = { nuevo: new Set() };

function construirCalendarioHTML(mesISO, seleccionados, contexto) {
  const [anio, mes] = mesISO.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const primerDiaSemana = new Date(anio, mes - 1, 1).getDay(); // 0 = domingo
  const offset = (primerDiaSemana + 6) % 7; // semana empieza en lunes

  const nombresDow = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let html = '<div class="calendario">';
  nombresDow.forEach(d => { html += `<div class="dow">${d}</div>`; });
  for (let i = 0; i < offset; i++) html += '<div class="dia vacio"></div>';
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = `${mesISO}-${String(dia).padStart(2, '0')}`;
    const libre = seleccionados.has(fecha);
    html += `<button type="button" class="dia${libre ? ' libre' : ''}" data-fecha="${fecha}" data-contexto="${contexto}">${dia}</button>`;
  }
  html += '</div>';
  return html;
}

// Por defecto vienen marcados los domingos del mes elegido, como punto de
// partida — el dueño destilda o marca otros días según haga falta.
function diasDomingoDelMes(mesISO) {
  const [anio, mes] = mesISO.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const domingos = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    if (new Date(anio, mes - 1, dia).getDay() === 0) domingos.push(`${mesISO}-${String(dia).padStart(2, '0')}`);
  }
  return domingos;
}

function renderCalendarioNuevoObjetivo() {
  const mesISO = document.getElementById('nuevo-mes').value || mesActualISO();
  document.getElementById('calendario-nuevo-objetivo').innerHTML = construirCalendarioHTML(mesISO, calendarios.nuevo, 'nuevo');
}

document.getElementById('nuevo-mes').addEventListener('change', (ev) => {
  calendarios.nuevo = new Set(diasDomingoDelMes(ev.target.value));
  renderCalendarioNuevoObjetivo();
});

// ---- Paneles colapsables (arrancan cerrados para no saturar el
// dashboard con formularios que se usan poco) ----

document.getElementById('btn-toggle-categorias-gasto').addEventListener('click', () => {
  const panel = document.getElementById('panel-categorias-gasto');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-toggle-proveedores').addEventListener('click', () => {
  const panel = document.getElementById('panel-proveedores');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-toggle-encargados-lista').addEventListener('click', () => {
  const panel = document.getElementById('panel-encargados-lista');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-toggle-nuevo-encargado').addEventListener('click', () => {
  const panel = document.getElementById('panel-nuevo-encargado');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-toggle-nuevo-objetivo').addEventListener('click', () => {
  const panel = document.getElementById('panel-nuevo-objetivo');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-toggle-carga-rapida').addEventListener('click', () => {
  const panel = document.getElementById('panel-carga-rapida');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('carga-rapida-fecha').addEventListener('change', () => {
  renderCargaRapida();
});

// ---- Carga rápida de tickets de hoy ----

async function renderCargaRapida(objetivos, encargados) {
  objetivos = objetivos || await Repo.getObjetivosProgreso();
  encargados = encargados || await Repo.getEncargados();
  const cont = document.getElementById('carga-rapida-lista');

  const fechaInput = document.getElementById('carga-rapida-fecha');
  if (!fechaInput.value) fechaInput.value = hoyISO();
  const fecha = fechaInput.value;
  const esHoy = fecha === hoyISO();

  const activos = objetivos.filter(obj => {
    const enc = encargados.find(e => e.id === obj.encargadoId);
    return enc && enc.activo;
  });

  if (activos.length === 0) {
    cont.innerHTML = '<div class="empty-msg">No hay objetivos de encargados activos para cargar.</div>';
    return;
  }

  cont.innerHTML = activos.map(obj => {
    const entrada = obj.historial.find(h => h.fecha === fecha);
    const enc = encargados.find(e => e.id === obj.encargadoId);
    return `
      <div class="card" style="padding:12px 16px;">
        <div style="font-weight:600;">${obj.titulo}</div>
        <div style="font-size:12px;color:var(--texto-sec);margin-bottom:8px;">${nombreEncargado(encargados, obj.encargadoId)}</div>
        <div class="field-row">
          <div>
            <input type="number" id="rapida-${obj.id}" placeholder="${esHoy ? 'Tickets de hoy' : 'Tickets de ese día'}" value="${entrada ? entrada.valor : ''}">
          </div>
          <div style="flex:0 0 auto;">
            <button class="primary" data-action="guardar-rapida" data-key="${obj.id}">Guardar</button>
          </div>
        </div>
        ${entrada ? `<div class="hint" style="margin:0;">Ya cargado ese día: ${entrada.valor} ${obj.unidad}. Guardar de nuevo lo reemplaza.</div>` : ''}
        ${enc ? `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-top:8px;">
          <input type="checkbox" id="rapida-avisar-${obj.id}" data-encargado-id="${enc.id}"> Avisarle a ${enc.nombre} en la app que revise su progreso
        </label>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ---- Dashboard de progreso ----

async function renderProgreso(objetivos, encargados) {
  objetivos = objetivos || await Repo.getObjetivosProgreso();
  encargados = encargados || await Repo.getEncargados();
  const cont = document.getElementById('progreso-lista');

  if (objetivos.length === 0) {
    cont.innerHTML = '<div class="empty-msg">Todavía no creaste ningún objetivo de progreso.</div>';
    return;
  }

  cont.innerHTML = '';
  objetivos.forEach(obj => {
    const { avance, superado, r, unidad, mensajeEstado, colorCard } = resumenObjetivoProgreso(obj);
    const enc = encargados.find(e => e.id === obj.encargadoId);
    const pausadoTag = enc && !enc.activo ? ' <span class="estado-tag estado-gris">Pausado</span>' : '';

    const historialHTML = obj.historial.length === 0
      ? '<div class="empty-msg">Sin cargas todavía.</div>'
      : obj.historial.map(h => `
          <div class="historial-row">
            <span>${formatearFechaCorta(h.fecha)}</span>
            <strong>${h.valor} ${unidad}</strong>
          </div>
          ${h.nota ? `<div class="historial-nota">${h.nota}</div>` : ''}
        `).join('');

    const card = document.createElement('div');
    card.className = `card estado-${colorCard}`;
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${obj.titulo}${pausadoTag}</div>
          <div style="font-size:12px;color:var(--texto-sec);">${nombreEncargado(encargados, obj.encargadoId)}</div>
        </div>
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
      <div class="row-actions">
        <button class="secondary" data-action="toggle-carga" data-key="${obj.id}">Cargar / corregir un día</button>
        <button class="secondary" data-action="toggle-historial" data-key="${obj.id}">Historial (${obj.historial.length})</button>
        <button class="secondary" data-action="toggle-semanal" data-key="${obj.id}">Progreso semanal</button>
        <button class="secondary" data-action="toggle-editar-objetivo" data-key="${obj.id}">Editar objetivo</button>
      </div>
      <div id="semanal-${obj.id}" style="display:none;margin-top:10px;">${progresoSemanalHTML(obj)}</div>
      <div id="carga-${obj.id}" style="display:none;margin-top:10px;">
        <label class="label" for="fecha-${obj.id}">Fecha</label>
        <input type="date" id="fecha-${obj.id}" value="${hoyISO()}">
        <label class="label" for="valor-${obj.id}">Tickets de ese día${unidad ? ' (' + unidad + ')' : ''}</label>
        <input type="number" id="valor-${obj.id}">
        <label class="label" for="nota-${obj.id}">Nota (opcional)</label>
        <textarea id="nota-${obj.id}" placeholder="Ej: se corrige el número cargado el viernes..."></textarea>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin:8px 0;">
          <input type="checkbox" id="avisar-${obj.id}" data-encargado-id="${obj.encargadoId}"> Avisarle a ${nombreEncargado(encargados, obj.encargadoId)} en la app que revise su progreso
        </label>
        <div class="row-actions">
          <button class="primary" data-action="guardar-avance" data-key="${obj.id}" style="width:100%;">Guardar</button>
        </div>
      </div>
      <div id="historial-${obj.id}" style="display:none;margin-top:10px;">${historialHTML}</div>
      <div id="editar-${obj.id}" style="display:none;margin-top:10px;">
        <label class="label" for="editar-titulo-${obj.id}">Título</label>
        <input type="text" id="editar-titulo-${obj.id}" value="${obj.titulo}">
        <div class="field-row">
          <div>
            <label class="label" for="editar-meta-${obj.id}">Meta</label>
            <input type="number" id="editar-meta-${obj.id}" value="${obj.meta}">
          </div>
          <div>
            <label class="label" for="editar-unidad-${obj.id}">Unidad</label>
            <input type="text" id="editar-unidad-${obj.id}" value="${obj.unidad}">
          </div>
        </div>
        <p class="hint" style="margin-top:-2px;">Mes objetivo: ${formatearMes(obj.mes)} (no se puede cambiar el mes de un objetivo con historial cargado; creá uno nuevo para otro mes).</p>
        <label class="label">Días no laborales</label>
        <div id="calendario-${obj.id}"></div>
        <div class="row-actions">
          <button class="primary" data-action="guardar-edicion-objetivo" data-key="${obj.id}" style="width:100%;">Guardar cambios</button>
        </div>
      </div>
    `;
    cont.appendChild(card);
  });
}

// ---- Comparativo de encargados ----

const COLORES_SERIE = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#78350f'];

async function renderComparativo(todos, encargados) {
  todos = todos || await Repo.getObjetivosProgreso();
  encargados = encargados || await Repo.getEncargados();
  const mesHoy = mesActualISO();
  const activos = todos.filter(o => {
    if (o.mes !== mesHoy) return false;
    const enc = encargados.find(e => e.id === o.encargadoId);
    return enc && enc.activo;
  });

  const rankingCont = document.getElementById('ranking-lista');
  const chartCont = document.getElementById('chart-tickets-dia');

  if (activos.length === 0) {
    rankingCont.innerHTML = '<div class="empty-msg">No hay objetivos de encargados activos este mes para comparar.</div>';
    chartCont.innerHTML = '';
    return;
  }

  // Ranking por % de avance a la meta, de mejor a peor.
  const ordenados = activos
    .map(obj => ({ obj, resumen: resumenObjetivoProgreso(obj) }))
    .sort((a, b) => b.resumen.avance - a.resumen.avance);

  const colorVar = { verde: 'var(--verde)', azul: 'var(--azul)', rojo: 'var(--rojo)' };
  rankingCont.innerHTML = ordenados.map(({ obj, resumen }) => `
    <div class="ranking-item">
      <div class="ranking-nombre">${nombreEncargado(encargados, obj.encargadoId)}</div>
      <div class="ranking-barra-track"><div class="ranking-barra-fill" style="width:${resumen.avance}%;background:${colorVar[resumen.colorCard]}"></div></div>
      <div class="ranking-pct">${resumen.avance}%</div>
    </div>
  `).join('');

  // Tickets por día, últimos 7 días, un color por objetivo activo.
  const dias = ultimosNDias(7);
  const series = activos.map((obj, idx) => ({
    obj,
    color: COLORES_SERIE[idx % COLORES_SERIE.length],
    valores: dias.map(d => {
      const h = obj.historial.find(x => x.fecha === d);
      return h ? h.valor : 0;
    }),
  }));
  const maxValor = Math.max(1, ...series.flatMap(s => s.valores));

  const leyendaHTML = series.map(s => `
    <span class="leyenda-item"><span class="leyenda-dot" style="background:${s.color}"></span>${nombreEncargado(encargados, s.obj.encargadoId)}</span>
  `).join('');

  const columnasHTML = dias.map((dia, i) => {
    const barrasHTML = series.map(s => {
      const valor = s.valores[i];
      const alturaPct = Math.round((valor / maxValor) * 100);
      return `<div class="chart-barra" style="height:${alturaPct}%;background:${s.color};" title="${nombreEncargado(encargados, s.obj.encargadoId)} — ${formatearFechaCorta(dia)}: ${valor} ${s.obj.unidad}"></div>`;
    }).join('');
    return `
      <div class="chart-columna">
        <div class="chart-barras">${barrasHTML}</div>
        <div class="chart-fecha-label">${dia.slice(8, 10)}/${dia.slice(5, 7)}</div>
      </div>
    `;
  }).join('');

  chartCont.innerHTML = `
    <div class="chart-leyenda">${leyendaHTML}</div>
    <div class="chart-grid">${columnasHTML}</div>
  `;
}

// ---- Categorías de gasto ----

async function renderCategoriasGasto(categorias) {
  const cont = document.getElementById('categorias-gasto-lista');
  categorias = categorias || await Repo.getCategoriasGasto();
  cont.innerHTML = categorias.length === 0
    ? '<div class="empty-msg">Todavía no cargaste ninguna categoría de gasto.</div>'
    : categorias.map(c => `
        <div class="card estado-${c.activa ? 'verde' : 'gris'}" style="padding:12px 16px;">
          <div class="encargado-row">
            <strong>${c.nombre}</strong>
            <div class="row-actions" style="margin-top:0;">
              <span class="estado-tag estado-${c.activa ? 'verde' : 'gris'}">${c.activa ? 'Activa' : 'Inactiva'}</span>
              <button class="secondary" data-action="toggle-activa-categoria" data-key="${c.id}">${c.activa ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        </div>
      `).join('');
}

// ---- Proveedores / entidades ----

async function renderProveedores(proveedores) {
  const cont = document.getElementById('proveedores-lista');
  proveedores = proveedores || await Repo.getProveedores();
  cont.innerHTML = proveedores.length === 0
    ? '<div class="empty-msg">Todavía no cargaste ningún proveedor.</div>'
    : proveedores.map(p => `
        <div class="card estado-${p.activo ? 'verde' : 'gris'}" style="padding:12px 16px;">
          <div class="encargado-row">
            <strong>${p.nombre}</strong>
            <div class="row-actions" style="margin-top:0;">
              <span class="estado-tag estado-${p.activo ? 'verde' : 'gris'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
              <button class="secondary" data-action="toggle-activo-proveedor" data-key="${p.id}">${p.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
        </div>
      `).join('');
}

// ---- Forma de pago (reutilizable: cola de aprobación y cola de pago) ----

function opcionesFormaPago(seleccionada) {
  return ['efectivo', 'transferencia', 'cheque'].map(v =>
    `<option value="${v}"${v === seleccionada ? ' selected' : ''}>${FORMA_PAGO_LABEL[v]}</option>`
  ).join('');
}

// "prefix" separa los ids entre la cola de aprobación ("gp") y la cola de
// pago ("pp") para que no choquen cuando un mismo gasto aparece en las dos
// (algo que no pasa en la práctica, pero mantiene los ids únicos siempre).
function camposFormaPagoHTML(prefix, g) {
  const idCheque = `${prefix}-cheque-${g.id}`;
  return `
    <label class="label" for="${prefix}-forma-${g.id}">Forma de pago</label>
    <select id="${prefix}-forma-${g.id}" data-role="forma-pago-select" data-cheque-target="${idCheque}">${opcionesFormaPago(g.formaPago)}</select>
    <div id="${idCheque}" style="display:${g.formaPago === 'cheque' ? 'block' : 'none'};">
      <label class="label" for="${prefix}-cheque-num-${g.id}">Número de cheque</label>
      <input type="text" id="${prefix}-cheque-num-${g.id}" value="${g.chequeNumero}">
      <label class="label" for="${prefix}-cheque-firma-${g.id}">A nombre de quién es la firma</label>
      <input type="text" id="${prefix}-cheque-firma-${g.id}" value="${g.chequeFirma}">
    </div>
  `;
}

document.addEventListener('change', (ev) => {
  const sel = ev.target.closest('[data-role="forma-pago-select"]');
  if (!sel) return;
  const cont = document.getElementById(sel.dataset.chequeTarget);
  if (cont) cont.style.display = sel.value === 'cheque' ? 'block' : 'none';
});

// ---- Cola de gastos pendientes de aprobación ----

async function renderGastosPendientes(gastos, categorias, proveedores) {
  const cont = document.getElementById('gastos-pendientes-lista');
  if (!gastos || !categorias || !proveedores) {
    [gastos, categorias, proveedores] = await Promise.all([Repo.getGastos(), Repo.getCategoriasGasto(), Repo.getProveedores()]);
  }
  const pendientes = gastos.filter(g => g.estado === 'pendiente');

  if (pendientes.length === 0) {
    cont.innerHTML = '<div class="empty-msg">No hay gastos pendientes de aprobación.</div>';
    return;
  }

  const opcionesCategoria = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  const opcionesProveedor = proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

  cont.innerHTML = pendientes.map(g => `
    <div class="card estado-amarillo" style="padding:14px 16px;">
      <div style="font-size:12px;color:var(--texto-sec);margin-bottom:8px;">${g.encargadoNombre} — ${g.sucursal} · ${formatearFechaCorta(g.fecha)}</div>
      <label class="label" for="gp-cat-${g.id}">Categoría</label>
      <select id="gp-cat-${g.id}">${opcionesCategoria}</select>
      <label class="label" for="gp-prov-${g.id}">Proveedor</label>
      <select id="gp-prov-${g.id}">${opcionesProveedor}</select>
      <label class="label" for="gp-monto-${g.id}">Monto</label>
      <input type="number" id="gp-monto-${g.id}" value="${g.monto}">
      <label class="label" for="gp-nota-${g.id}">Concepto</label>
      <textarea id="gp-nota-${g.id}">${g.nota}</textarea>
      ${camposFormaPagoHTML('gp', g)}
      <div class="row-actions">
        <button class="primary" data-action="aprobar-gasto" data-key="${g.id}">Aprobar</button>
        <button class="secondary" data-action="rechazar-gasto" data-key="${g.id}">Rechazar</button>
      </div>
    </div>
  `).join('');

  // Deja preseleccionada la categoría y el proveedor que eligió el encargado.
  pendientes.forEach(g => {
    const selCat = document.getElementById(`gp-cat-${g.id}`);
    if (selCat) selCat.value = g.categoriaId;
    const selProv = document.getElementById(`gp-prov-${g.id}`);
    if (selProv) selProv.value = g.proveedorId;
  });
}

// ---- Cola de gastos aprobados pendientes de pago ----

async function renderPagosPendientes(gastos) {
  const cont = document.getElementById('pagos-pendientes-lista');
  gastos = gastos || await Repo.getGastos();
  const pendientesPago = gastos.filter(g => g.estado === 'aprobado' && g.estadoPago === 'pendiente');

  if (pendientesPago.length === 0) {
    cont.innerHTML = '<div class="empty-msg">No hay gastos aprobados pendientes de pago.</div>';
    return;
  }

  const totalPendiente = pendientesPago.reduce((s, g) => s + g.monto, 0);

  cont.innerHTML = `
    <div class="card" style="padding:14px 16px;margin-bottom:10px;">
      <span class="label">Total pendiente de pago</span>
      <div style="font-size:20px;font-weight:800;">$ ${formatearMonto(totalPendiente)}</div>
    </div>
  ` + pendientesPago.map(g => `
    <div class="card estado-azul" style="padding:14px 16px;">
      <div style="font-size:12px;color:var(--texto-sec);margin-bottom:4px;">${g.encargadoNombre} — ${g.sucursal} · ${formatearFechaCorta(g.fecha)}</div>
      <div style="font-weight:600;">${g.categoriaNombre}${g.proveedorNombre ? ' — ' + g.proveedorNombre : ''}</div>
      <div style="font-size:17px;font-weight:800;margin:4px 0;">$ ${formatearMonto(g.monto)}</div>
      ${g.nota ? `<div class="historial-nota" style="margin-bottom:6px;">${g.nota}</div>` : ''}
      ${camposFormaPagoHTML('pp', g)}
      <div class="row-actions">
        <button class="primary" data-action="marcar-pagado" data-key="${g.id}" style="width:100%;">Marcar como pagado</button>
      </div>
    </div>
  `).join('');
}

// ---- Informe de gastos por categoría y por sucursal ----

async function renderInformeGastos(gastos) {
  const desde = document.getElementById('informe-desde').value;
  const hasta = document.getElementById('informe-hasta').value;
  gastos = gastos || await Repo.getGastos();

  const porCategoria = agruparGastosAprobados(gastos, desde, hasta, 'categoriaNombre');
  const porSucursalAnidado = agruparGastosAprobadosAnidado(gastos, desde, hasta, 'sucursal', 'categoriaNombre');
  const total = porCategoria.reduce((s, x) => s + x.total, 0);

  const contCat = document.getElementById('informe-gastos-categoria');
  const contSuc = document.getElementById('informe-gastos-sucursal');

  if (porCategoria.length === 0) {
    contCat.innerHTML = '<div class="empty-msg">No hay gastos aprobados en ese rango de fechas.</div>';
    contSuc.innerHTML = '';
    return;
  }

  contCat.innerHTML = tarjetaTotalInformeHTML(total)
    + `<div class="section-title" style="font-size:12px;margin:0 0 8px;">Por categoría</div>`
    + porCategoria.map((item, i) => filaInformeHTML(item, total, COLORES_INFORME[i % COLORES_INFORME.length])).join('');

  // Por sucursal, y dentro de cada una, desglosado por categoría. Cada
  // tarjeta de sucursal toma un color de la misma paleta (por su
  // posición en el ranking), y ese color tiñe tanto el borde como las
  // barras internas de esa sucursal.
  const bloqueSucursalHTML = porSucursalAnidado.map((suc, i) => {
    const colorSuc = COLORES_INFORME[i % COLORES_INFORME.length];
    return `
      <div class="card" style="padding:14px 16px;margin-bottom:10px;border-left-color:${colorSuc};">
        <div class="card-top">
          <strong>${suc.clave}</strong>
          <span style="font-weight:800;">$ ${formatearMonto(suc.total)}</span>
        </div>
        <div style="margin-top:8px;">
          ${suc.subgrupos.map((sub, j) => filaInformeHTML(sub, suc.total, COLORES_INFORME[j % COLORES_INFORME.length])).join('')}
        </div>
      </div>
    `;
  }).join('');
  contSuc.innerHTML = `
    <div class="section-title" style="font-size:12px;margin:16px 0 8px;">Por sucursal</div>
    ${bloqueSucursalHTML}
  `;
}

// Contenido de la pestaña "Gastos" cuando el usuario logueado es el
// dueño (la otra mitad de esa pestaña, para un encargado, vive en
// ui-encargado.js como renderGastosEncargado()).
// Pide encargados, categorías, proveedores y gastos UNA sola vez (en
// paralelo) y se los pasa a cada sub-render, en vez de que cada uno
// vuelva a pedirlos por su cuenta. Antes esta pestaña disparaba más de
// una decena de consultas encadenadas a Supabase; así queda en un puñado
// en paralelo, que es lo que más pesa en el tiempo de carga.
async function renderGastosDueno() {
  try {
    const [encargados, categorias, proveedores] = await Promise.all([
      Repo.getEncargados(),
      Repo.getCategoriasGasto(),
      Repo.getProveedores(),
    ]);
    const encargadosPorId = {}; encargados.forEach(e => { encargadosPorId[e.id] = e; });
    const categoriasPorId = {}; categorias.forEach(c => { categoriasPorId[c.id] = c; });
    const proveedoresPorId = {}; proveedores.forEach(p => { proveedoresPorId[p.id] = p; });
    const gastos = await Repo.getGastos({ encargadosPorId, categoriasPorId, proveedoresPorId });

    await renderCategoriasGasto(categorias);
    await renderProveedores(proveedores);
    await renderGastosPendientes(gastos, categorias, proveedores);
    await renderPagosPendientes(gastos);
    await renderInformeGastos(gastos);
  } catch (e) {
    console.error(e);
    alert('No se pudieron cargar los datos de gastos. Revisá tu conexión e intentá de nuevo.');
  }
}

// Mismo criterio que renderGastosDueno: encargados y objetivos se piden
// una vez en paralelo y se reparten entre las cinco secciones del panel.
async function renderDueno() {
  try {
    const [encargados, objetivos, identidad] = await Promise.all([
      Repo.getEncargados(),
      Repo.getObjetivosProgreso(),
      Repo.getIdentidad(),
    ]);
    await renderIdentidad(identidad);
    await renderResumenDueno(encargados, objetivos);
    await renderEncargadosLista(encargados);
    renderCalendarioNuevoObjetivo();
    await renderCargaRapida(objetivos, encargados);
    await renderProgreso(objetivos, encargados);
    await renderComparativo(objetivos, encargados);
  } catch (e) {
    console.error(e);
    alert('No se pudieron cargar los datos del panel. Revisá tu conexión e intentá de nuevo.');
  }
}

document.addEventListener('click', (ev) => {
  // --- Calendario (creación o edición) ---
  const diaBtn = ev.target.closest('.calendario .dia:not(.vacio)');
  if (diaBtn) {
    const fecha = diaBtn.dataset.fecha;
    const contexto = diaBtn.dataset.contexto;
    if (!calendarios[contexto]) calendarios[contexto] = new Set();
    const set = calendarios[contexto];
    if (set.has(fecha)) set.delete(fecha); else set.add(fecha);
    diaBtn.classList.toggle('libre');
    return;
  }

  // --- Encargados ---
  const crearEncBtn = ev.target.closest('[data-action="crear-encargado"]');
  if (crearEncBtn) {
    const nombre = document.getElementById('nuevo-enc-nombre').value.trim();
    const sucursal = document.getElementById('nuevo-enc-sucursal').value.trim();
    const userId = document.getElementById('nuevo-enc-userid').value.trim();
    if (!nombre) { alert('Ingresá el nombre del encargado.'); return; }
    Repo.crearEncargado({ nombre, sucursal, userId }).then(() => {
      document.getElementById('nuevo-enc-nombre').value = '';
      document.getElementById('nuevo-enc-sucursal').value = '';
      document.getElementById('nuevo-enc-userid').value = '';
      renderEncargadosLista();
    }).catch(manejarErrorRepo);
    return;
  }

  const toggleEditarEncBtn = ev.target.closest('[data-action="toggle-editar-encargado"]');
  if (toggleEditarEncBtn) {
    const el = document.getElementById('editar-enc-' + toggleEditarEncBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const guardarEdicionEncBtn = ev.target.closest('[data-action="guardar-edicion-encargado"]');
  if (guardarEdicionEncBtn) {
    const key = guardarEdicionEncBtn.dataset.key;
    const nombre = document.getElementById(`editar-enc-nombre-${key}`).value.trim();
    const sucursal = document.getElementById(`editar-enc-sucursal-${key}`).value.trim();
    const userId = document.getElementById(`editar-enc-userid-${key}`).value.trim();
    const veProposito = document.getElementById(`editar-enc-veproposito-${key}`).checked;
    const veMision = document.getElementById(`editar-enc-vemision-${key}`).checked;
    const veVision = document.getElementById(`editar-enc-vevision-${key}`).checked;
    const veValores = document.getElementById(`editar-enc-vevalores-${key}`).checked;
    if (!nombre) { alert('El nombre no puede quedar vacío.'); return; }
    Repo.editarEncargado(key, { nombre, sucursal, userId, veProposito, veMision, veVision, veValores }).then(() => {
      renderEncargadosLista();
      renderProgreso();
      renderCargaRapida();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  const togglePausaBtn = ev.target.closest('[data-action="toggle-pausa-encargado"]');
  if (togglePausaBtn) {
    Repo.togglePausaEncargado(togglePausaBtn.dataset.key).then(() => {
      renderEncargadosLista();
      renderResumenDueno();
      renderCargaRapida();
      renderProgreso();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Crear objetivo ---
  const crearObjBtn = ev.target.closest('[data-action="crear-objetivo-progreso"]');
  if (crearObjBtn) {
    const encargadoId = document.getElementById('nuevo-obj-encargado').value;
    const titulo = document.getElementById('nuevo-titulo').value.trim();
    const meta = document.getElementById('nuevo-meta').value;
    const unidad = document.getElementById('nuevo-unidad').value;
    const mes = document.getElementById('nuevo-mes').value;
    const diasNoLaborales = Array.from(calendarios.nuevo || []);
    if (!encargadoId) { alert('Agregá y elegí un encargado primero.'); return; }
    if (!titulo || !meta || Number(meta) <= 0) { alert('Completá un título y una meta mayor a cero.'); return; }
    Repo.crearObjetivoProgreso({ encargadoId, titulo, meta, unidad, mes, diasNoLaborales }).then(() => {
      document.getElementById('nuevo-titulo').value = '';
      document.getElementById('nuevo-meta').value = '';
      document.getElementById('nuevo-unidad').value = '';
      document.getElementById('nuevo-mes').value = mesActualISO();
      calendarios.nuevo = new Set(diasDomingoDelMes(mesActualISO()));
      renderCalendarioNuevoObjetivo();
      renderCargaRapida();
      renderProgreso();
      renderResumenDueno();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Editar objetivo ---
  const toggleEditarObjBtn = ev.target.closest('[data-action="toggle-editar-objetivo"]');
  if (toggleEditarObjBtn) {
    const key = toggleEditarObjBtn.dataset.key;
    const el = document.getElementById('editar-' + key);
    const abrir = el.style.display === 'none';
    el.style.display = abrir ? 'block' : 'none';
    if (abrir) {
      Repo.getObjetivosProgreso().then(lista => {
        const obj = lista.find(o => o.id === key);
        calendarios[key] = new Set(obj.diasNoLaborales);
        document.getElementById(`calendario-${key}`).innerHTML = construirCalendarioHTML(obj.mes, calendarios[key], key);
      }).catch(manejarErrorRepo);
    }
    return;
  }

  const guardarEdicionObjBtn = ev.target.closest('[data-action="guardar-edicion-objetivo"]');
  if (guardarEdicionObjBtn) {
    const key = guardarEdicionObjBtn.dataset.key;
    const titulo = document.getElementById(`editar-titulo-${key}`).value.trim();
    const meta = document.getElementById(`editar-meta-${key}`).value;
    const unidad = document.getElementById(`editar-unidad-${key}`).value;
    const diasNoLaborales = Array.from(calendarios[key] || []);
    if (!titulo || !meta || Number(meta) <= 0) { alert('Completá un título y una meta mayor a cero.'); return; }
    Repo.editarObjetivoProgreso(key, { titulo, meta, unidad, diasNoLaborales }).then(() => {
      renderProgreso();
      renderCargaRapida();
      renderResumenDueno();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Carga rápida ---
  const rapidaBtn = ev.target.closest('[data-action="guardar-rapida"]');
  if (rapidaBtn) {
    const key = rapidaBtn.dataset.key;
    const input = document.getElementById(`rapida-${key}`);
    const fecha = document.getElementById('carga-rapida-fecha').value || hoyISO();
    if (!input.value) { alert('Ingresá un número de tickets.'); return; }
    const avisarChk = document.getElementById(`rapida-avisar-${key}`);
    const avisar = avisarChk && avisarChk.checked;
    const encargadoIdAvisar = avisarChk ? avisarChk.dataset.encargadoId : null;
    Repo.cargarTicketsDelDia(key, fecha, input.value, '').then(() => {
      if (avisar && encargadoIdAvisar) {
        Repo.crearNotificacion({
          encargadoId: encargadoIdAvisar,
          mensaje: 'Se cargó tu ticket del día. Recordá entrar a la app todos los días para revisar tu progreso.',
        }).catch(() => {});
      }
      renderCargaRapida();
      renderProgreso();
      renderResumenDueno();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Toggles del dashboard ---
  const toggleCargaBtn = ev.target.closest('[data-action="toggle-carga"]');
  if (toggleCargaBtn) {
    const el = document.getElementById('carga-' + toggleCargaBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const toggleHistorialBtn = ev.target.closest('[data-action="toggle-historial"]');
  if (toggleHistorialBtn) {
    const el = document.getElementById('historial-' + toggleHistorialBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const toggleSemanalBtn = ev.target.closest('[data-action="toggle-semanal"]');
  if (toggleSemanalBtn) {
    const el = document.getElementById('semanal-' + toggleSemanalBtn.dataset.key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  // --- Identidad institucional ---
  const guardarIdentidadBtn = ev.target.closest('[data-action="guardar-identidad"]');
  if (guardarIdentidadBtn) {
    const proposito = document.getElementById('identidad-proposito').value;
    const mision = document.getElementById('identidad-mision').value;
    const vision = document.getElementById('identidad-vision').value;
    const valores = document.getElementById('identidad-valores').value;
    Repo.editarIdentidad({ proposito, mision, vision, valores }).catch(manejarErrorRepo);
    return;
  }

  const guardarAvanceBtn = ev.target.closest('[data-action="guardar-avance"]');
  if (guardarAvanceBtn) {
    const key = guardarAvanceBtn.dataset.key;
    const fechaInput = document.getElementById(`fecha-${key}`);
    const valorInput = document.getElementById(`valor-${key}`);
    const notaInput = document.getElementById(`nota-${key}`);
    const avisarChk = document.getElementById(`avisar-${key}`);
    if (!fechaInput.value || !valorInput.value) { alert('Completá la fecha y el valor.'); return; }
    const avisar = avisarChk && avisarChk.checked;
    const encargadoIdAvisar = avisarChk ? avisarChk.dataset.encargadoId : null;
    Repo.cargarTicketsDelDia(key, fechaInput.value, valorInput.value, notaInput.value).then(() => {
      if (avisar && encargadoIdAvisar) {
        Repo.crearNotificacion({
          encargadoId: encargadoIdAvisar,
          mensaje: 'Se cargó tu ticket del día. Recordá entrar a la app todos los días para revisar tu progreso.',
        }).catch(() => {});
      }
      renderCargaRapida();
      renderProgreso();
      renderResumenDueno();
      renderComparativo();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Categorías de gasto ---
  const crearCategoriaBtn = ev.target.closest('[data-action="crear-categoria-gasto"]');
  if (crearCategoriaBtn) {
    const input = document.getElementById('nueva-categoria-nombre');
    const nombre = input.value.trim();
    if (!nombre) { alert('Ingresá el nombre de la categoría.'); return; }
    Repo.crearCategoriaGasto(nombre).then(() => {
      input.value = '';
      renderCategoriasGasto();
      poblarSelectCategoriaGasto();
    }).catch(manejarErrorRepo);
    return;
  }

  const toggleActivaCatBtn = ev.target.closest('[data-action="toggle-activa-categoria"]');
  if (toggleActivaCatBtn) {
    const key = toggleActivaCatBtn.dataset.key;
    Repo.getCategoriasGasto().then(categorias => {
      const cat = categorias.find(c => c.id === key);
      return Repo.editarCategoriaGasto(key, { activa: !cat.activa });
    }).then(() => {
      renderCategoriasGasto();
      poblarSelectCategoriaGasto();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Proveedores ---
  const crearProveedorBtn = ev.target.closest('[data-action="crear-proveedor"]');
  if (crearProveedorBtn) {
    const input = document.getElementById('nuevo-proveedor-nombre');
    const nombre = input.value.trim();
    if (!nombre) { alert('Ingresá el nombre del proveedor.'); return; }
    Repo.crearProveedor(nombre).then(() => {
      input.value = '';
      renderProveedores();
      poblarSelectProveedor();
    }).catch(manejarErrorRepo);
    return;
  }

  const toggleActivoProvBtn = ev.target.closest('[data-action="toggle-activo-proveedor"]');
  if (toggleActivoProvBtn) {
    const key = toggleActivoProvBtn.dataset.key;
    Repo.getProveedores().then(proveedores => {
      const prov = proveedores.find(p => p.id === key);
      return Repo.editarProveedor(key, { activo: !prov.activo });
    }).then(() => {
      renderProveedores();
      poblarSelectProveedor();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Aprobar / rechazar gastos pendientes ---
  const aprobarGastoBtn = ev.target.closest('[data-action="aprobar-gasto"]');
  const rechazarGastoBtn = ev.target.closest('[data-action="rechazar-gasto"]');
  if (aprobarGastoBtn || rechazarGastoBtn) {
    const btn = aprobarGastoBtn || rechazarGastoBtn;
    const key = btn.dataset.key;
    const estado = aprobarGastoBtn ? 'aprobado' : 'rechazado';
    const categoriaId = document.getElementById(`gp-cat-${key}`).value;
    const proveedorId = document.getElementById(`gp-prov-${key}`).value;
    const monto = document.getElementById(`gp-monto-${key}`).value;
    const nota = document.getElementById(`gp-nota-${key}`).value;
    const formaPago = document.getElementById(`gp-forma-${key}`).value;
    const chequeNumero = document.getElementById(`gp-cheque-num-${key}`).value;
    const chequeFirma = document.getElementById(`gp-cheque-firma-${key}`).value;
    if (!monto || Number(monto) <= 0) { alert('El monto tiene que ser mayor a cero.'); return; }
    if (formaPago === 'cheque' && (!chequeNumero || !chequeFirma)) {
      alert('Completá el número de cheque y la firma antes de continuar.');
      return;
    }
    Repo.revisarGasto(key, { estado, categoriaId, proveedorId, monto, nota, formaPago, chequeNumero, chequeFirma }).then(() => {
      renderGastosPendientes();
      renderPagosPendientes();
      renderInformeGastos();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Marcar gasto como pagado ---
  const marcarPagadoBtn = ev.target.closest('[data-action="marcar-pagado"]');
  if (marcarPagadoBtn) {
    const key = marcarPagadoBtn.dataset.key;
    const formaPago = document.getElementById(`pp-forma-${key}`).value;
    const chequeNumero = document.getElementById(`pp-cheque-num-${key}`).value;
    const chequeFirma = document.getElementById(`pp-cheque-firma-${key}`).value;
    if (formaPago === 'cheque' && (!chequeNumero || !chequeFirma)) {
      alert('Completá el número de cheque y la firma antes de marcarlo como pagado.');
      return;
    }
    Repo.marcarGastoPagado(key, { formaPago, chequeNumero, chequeFirma }).then(() => {
      renderPagosPendientes();
      renderInformeGastos();
    }).catch(manejarErrorRepo);
    return;
  }

  // --- Informe de gastos ---
  const filtrarInformeBtn = ev.target.closest('[data-action="filtrar-informe-gastos"]');
  if (filtrarInformeBtn) {
    renderInformeGastos().catch(manejarErrorRepo);
  }
});
