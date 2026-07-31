// Vista Encargado: solo lectura del propio progreso. El login ya pasó
// (pantalla global en app.js); acá solo se muestra lo que le corresponde
// al usuario logueado, según lo que permite Row Level Security.

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
    </div>
  `;
}

async function renderEncargado() {
  const cont = document.getElementById('encargado-lista');
  cont.innerHTML = '<div class="empty-msg">Cargando...</div>';

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

  let html = '';
  if (!encargado.activo) {
    html += '<div class="card estado-gris" style="font-size:13px;">Este perfil está pausado por el dueño. Podés seguir viendo el progreso, pero no se van a cargar tickets nuevos hasta que se reactive.</div>';
  }

  try {
    const objetivos = await Repo.getObjetivosDeEncargado(encargado.id);
    if (objetivos.length === 0) {
      html += '<div class="empty-msg">Todavía no tenés un objetivo de progreso asignado.</div>';
    } else {
      html += objetivos.map(tarjetaProgresoSoloLecturaHTML).join('');
    }
  } catch (e) {
    html += '<div class="empty-msg">No se pudieron cargar tus objetivos. Revisá tu conexión e intentá de nuevo.</div>';
  }

  cont.innerHTML = html;
}
