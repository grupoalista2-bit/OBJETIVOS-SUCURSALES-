// Capa de datos. Habla directamente con Supabase (Postgres + Auth) a través
// de supabaseClient (creado en config.js). Ningún archivo de vista
// (ui-*.js) sabe que existe Supabase: todos pasan por Repo (datos) y Auth
// (sesión/login).
//
// Seguridad real: cada tabla tiene Row Level Security activado (ver
// sql/schema.sql). El dueño ve y edita todo; cada encargado solo puede
// leer su propia fila y sus propios objetivos/historial. Esa restricción
// se aplica adentro de la base de datos, no solo en esta pantalla — no se
// puede saltear editando el HTML o abriendo las herramientas de
// desarrollador del navegador, a diferencia del PIN de versiones
// anteriores.

function mapEncargadoDB(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    sucursal: row.sucursal,
    activo: row.activo,
    userId: row.user_id || '',
  };
}

function mapObjetivoDB(row, historialRows) {
  const historial = (historialRows || [])
    .filter(h => h.objetivo_id === row.id)
    .map(h => ({ fecha: h.fecha, valor: Number(h.valor), nota: h.nota || '' }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    id: row.id,
    encargadoId: row.encargado_id,
    titulo: row.titulo,
    meta: Number(row.meta),
    unidad: row.unidad,
    mes: row.mes,
    diasNoLaborales: row.dias_no_laborales || [],
    historial,
    valorActual: historial.reduce((s, h) => s + h.valor, 0),
  };
}

// ---- Auth: login/logout y "quién soy" ----
const Auth = {
  async iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, mensaje: 'No se pudo iniciar sesión. Revisá el email y la contraseña.' };
    return { ok: true, session: data.session };
  },

  async cerrarSesion() {
    await supabaseClient.auth.signOut();
  },

  async sesionActual() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session || null;
  },

  async _miUserId() {
    const { data } = await supabaseClient.auth.getUser();
    return data && data.user ? data.user.id : null;
  },

  // true si el usuario logueado figura en la tabla "duenos".
  async esDueno() {
    const uid = await this._miUserId();
    if (!uid) return false;
    const { data, error } = await supabaseClient.from('duenos').select('user_id').eq('user_id', uid).maybeSingle();
    if (error) return false;
    return !!data;
  },

  // Fila de "encargados" vinculada al usuario logueado, o null si el
  // usuario no es dueño ni tiene un encargado vinculado todavía.
  async miEncargado() {
    const uid = await this._miUserId();
    if (!uid) return null;
    const { data, error } = await supabaseClient.from('encargados').select('*').eq('user_id', uid).maybeSingle();
    if (error || !data) return null;
    return mapEncargadoDB(data);
  },
};

// ---- Repo: acceso a los datos de negocio (encargados, objetivos, tickets) ----
const Repo = {

  async getEncargados() {
    const { data, error } = await supabaseClient.from('encargados').select('*').order('creado_en', { ascending: true });
    if (error) throw error;
    return data.map(mapEncargadoDB);
  },

  async crearEncargado({ nombre, sucursal, userId }) {
    const fila = { nombre: nombre.trim(), sucursal: (sucursal || '').trim() };
    if (userId) fila.user_id = userId.trim();
    const { data, error } = await supabaseClient.from('encargados').insert(fila).select().single();
    if (error) throw error;
    return mapEncargadoDB(data);
  },

  async editarEncargado(id, { nombre, sucursal, userId }) {
    const cambios = { nombre: nombre.trim(), sucursal: (sucursal || '').trim() };
    if (userId !== undefined) cambios.user_id = userId ? userId.trim() : null;
    const { data, error } = await supabaseClient.from('encargados').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return mapEncargadoDB(data);
  },

  async togglePausaEncargado(id) {
    const { data: actual, error: errActual } = await supabaseClient.from('encargados').select('activo').eq('id', id).single();
    if (errActual) throw errActual;
    const { data, error } = await supabaseClient.from('encargados').update({ activo: !actual.activo }).eq('id', id).select().single();
    if (error) throw error;
    return mapEncargadoDB(data);
  },

  async getObjetivosProgreso() {
    const { data: objetivos, error } = await supabaseClient.from('objetivos_progreso').select('*').order('creado_en', { ascending: false });
    if (error) throw error;
    if (objetivos.length === 0) return [];
    const ids = objetivos.map(o => o.id);
    const { data: cargas, error: errCargas } = await supabaseClient.from('cargas_tickets').select('*').in('objetivo_id', ids);
    if (errCargas) throw errCargas;
    return objetivos.map(o => mapObjetivoDB(o, cargas));
  },

  async getObjetivosDeEncargado(encargadoId) {
    const todos = await this.getObjetivosProgreso();
    return todos.filter(o => o.encargadoId === encargadoId);
  },

  async crearObjetivoProgreso({ encargadoId, titulo, meta, unidad, mes, diasNoLaborales }) {
    const fila = {
      encargado_id: encargadoId,
      titulo: titulo.trim(),
      meta: Number(meta) || 0,
      unidad: (unidad || 'tickets').trim(),
      mes: mes || mesActualISO(),
      dias_no_laborales: (diasNoLaborales || []).slice().sort(),
    };
    const { data, error } = await supabaseClient.from('objetivos_progreso').insert(fila).select().single();
    if (error) throw error;
    return mapObjetivoDB(data, []);
  },

  // El mes queda fijo a propósito, igual que en versiones anteriores:
  // cambiarlo con historial ya cargado generaría números que no cierran.
  async editarObjetivoProgreso(id, { titulo, meta, unidad, diasNoLaborales }) {
    const cambios = {
      titulo: titulo.trim(),
      meta: Number(meta) || 0,
      unidad: (unidad || 'tickets').trim(),
      dias_no_laborales: (diasNoLaborales || []).slice().sort(),
    };
    const { data, error } = await supabaseClient.from('objetivos_progreso').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    const { data: cargas } = await supabaseClient.from('cargas_tickets').select('*').eq('objetivo_id', id);
    return mapObjetivoDB(data, cargas || []);
  },

  // Carga (o corrige) los tickets de UN día puntual. Si ya existía una
  // carga para esa fecha, la reemplaza (upsert por objetivo_id + fecha) en
  // vez de sumarla de nuevo.
  async cargarTicketsDelDia(objId, fecha, valor, nota) {
    const fila = { objetivo_id: objId, fecha, valor: Number(valor) || 0, nota: (nota || '').trim() };
    const { error } = await supabaseClient.from('cargas_tickets').upsert(fila, { onConflict: 'objetivo_id,fecha' });
    if (error) throw error;
    const { data: obj, error: errObj } = await supabaseClient.from('objetivos_progreso').select('*').eq('id', objId).single();
    if (errObj) throw errObj;
    const { data: cargas } = await supabaseClient.from('cargas_tickets').select('*').eq('objetivo_id', objId);
    return mapObjetivoDB(obj, cargas || []);
  },
};

function manejarErrorRepo(e) {
  console.error(e);
  const detalle = e && e.message ? e.message : 'error desconocido';
  alert('No se pudo guardar. Revisá tu conexión a internet e intentá de nuevo.\n\nDetalle: ' + detalle);
}
