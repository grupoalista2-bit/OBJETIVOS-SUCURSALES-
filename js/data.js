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
    veProposito: !!row.ve_proposito,
    veMision: !!row.ve_mision,
    veVision: !!row.ve_vision,
  };
}

function mapIdentidadDB(row) {
  return {
    proposito: (row && row.proposito) || '',
    mision: (row && row.mision) || '',
    vision: (row && row.vision) || '',
  };
}

function mapCategoriaGastoDB(row) {
  return { id: row.id, nombre: row.nombre, activa: row.activa };
}

function mapProveedorDB(row) {
  return { id: row.id, nombre: row.nombre, activo: row.activo };
}

function mapGastoDB(row, encargadosPorId, categoriasPorId, proveedoresPorId) {
  const enc = (encargadosPorId || {})[row.encargado_id];
  const cat = (categoriasPorId || {})[row.categoria_id];
  const prov = (proveedoresPorId || {})[row.proveedor_id];
  return {
    id: row.id,
    encargadoId: row.encargado_id,
    encargadoNombre: enc ? enc.nombre : '(encargado eliminado)',
    sucursal: enc ? enc.sucursal : '',
    categoriaId: row.categoria_id,
    categoriaNombre: cat ? cat.nombre : '(categoría eliminada)',
    proveedorId: row.proveedor_id || '',
    proveedorNombre: prov ? prov.nombre : (row.proveedor_id ? '(proveedor eliminado)' : ''),
    monto: Number(row.monto),
    fecha: row.fecha,
    nota: row.nota || '',
    formaPago: row.forma_pago || 'efectivo',
    chequeNumero: row.cheque_numero || '',
    chequeFirma: row.cheque_firma || '',
    estado: row.estado,
    estadoPago: row.estado_pago || 'pendiente',
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

  // Cambia la contraseña de la cuenta CON LA QUE YA SE ESTÁ LOGUEADO en
  // este dispositivo (no sirve para resetear la contraseña de otro
  // usuario sin conocerla primero — para eso hay que ir al dashboard de
  // Supabase, Authentication > Users, como se explica en el README).
  async cambiarPassword(nuevaPassword) {
    const { error } = await supabaseClient.auth.updateUser({ password: nuevaPassword });
    if (error) return { ok: false, mensaje: error.message || 'No se pudo cambiar la contraseña.' };
    return { ok: true };
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

  async editarEncargado(id, { nombre, sucursal, userId, veProposito, veMision, veVision }) {
    const cambios = { nombre: nombre.trim(), sucursal: (sucursal || '').trim() };
    if (userId !== undefined) cambios.user_id = userId ? userId.trim() : null;
    if (veProposito !== undefined) cambios.ve_proposito = !!veProposito;
    if (veMision !== undefined) cambios.ve_mision = !!veMision;
    if (veVision !== undefined) cambios.ve_vision = !!veVision;
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

  // ---- Identidad institucional (Propósito / Misión / Visión) ----
  // La tabla siempre tiene una única fila (id = true).

  async getIdentidad() {
    const { data, error } = await supabaseClient.from('identidad_empresa').select('*').eq('id', true).maybeSingle();
    if (error) throw error;
    return mapIdentidadDB(data);
  },

  async editarIdentidad({ proposito, mision, vision }) {
    const cambios = { actualizado_en: new Date().toISOString() };
    if (proposito !== undefined) cambios.proposito = proposito.trim();
    if (mision !== undefined) cambios.mision = mision.trim();
    if (vision !== undefined) cambios.vision = vision.trim();
    const { data, error } = await supabaseClient.from('identidad_empresa').update(cambios).eq('id', true).select().single();
    if (error) throw error;
    return mapIdentidadDB(data);
  },

  // ---- Categorías de gasto ----

  async getCategoriasGasto() {
    const { data, error } = await supabaseClient.from('categorias_gasto').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data.map(mapCategoriaGastoDB);
  },

  async crearCategoriaGasto(nombre) {
    const { data, error } = await supabaseClient.from('categorias_gasto').insert({ nombre: nombre.trim() }).select().single();
    if (error) throw error;
    return mapCategoriaGastoDB(data);
  },

  async editarCategoriaGasto(id, { nombre, activa }) {
    const cambios = {};
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (activa !== undefined) cambios.activa = activa;
    const { data, error } = await supabaseClient.from('categorias_gasto').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return mapCategoriaGastoDB(data);
  },

  // ---- Proveedores / entidades ----

  async getProveedores() {
    const { data, error } = await supabaseClient.from('proveedores').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return data.map(mapProveedorDB);
  },

  async crearProveedor(nombre) {
    const { data, error } = await supabaseClient.from('proveedores').insert({ nombre: nombre.trim() }).select().single();
    if (error) throw error;
    return mapProveedorDB(data);
  },

  async editarProveedor(id, { nombre, activo }) {
    const cambios = {};
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (activo !== undefined) cambios.activo = activo;
    const { data, error } = await supabaseClient.from('proveedores').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return mapProveedorDB(data);
  },

  // ---- Gastos ----
  // Para armar los objetos de gasto ya con nombre de encargado/sucursal,
  // categoría y proveedor (en vez de solo los ids), se resuelven las tres
  // listas una vez y se usan como diccionario.

  async _mapasGastos() {
    const [encargados, categorias, proveedores] = await Promise.all([
      this.getEncargados(),
      this.getCategoriasGasto(),
      this.getProveedores(),
    ]);
    const encargadosPorId = {};
    encargados.forEach(e => { encargadosPorId[e.id] = e; });
    const categoriasPorId = {};
    categorias.forEach(c => { categoriasPorId[c.id] = c; });
    const proveedoresPorId = {};
    proveedores.forEach(p => { proveedoresPorId[p.id] = p; });
    return { encargadosPorId, categoriasPorId, proveedoresPorId };
  },

  // Todos los gastos (el dueño ve todos; si lo llamara un encargado, por
  // RLS solo le vendrían los suyos igual, aunque esta app no lo usa así).
  // Si ya se resolvieron encargados/categorías/proveedores más arriba (por
  // ejemplo en renderGastosDueno), se pueden pasar en "mapasPrecalculadas"
  // para no volver a pedirlos: eso evita 3 consultas de más cada vez que
  // se piden los gastos.
  async getGastos(mapasPrecalculadas) {
    const { data, error } = await supabaseClient.from('gastos').select('*')
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false });
    if (error) throw error;
    const { encargadosPorId, categoriasPorId, proveedoresPorId } = mapasPrecalculadas || await this._mapasGastos();
    return data.map(g => mapGastoDB(g, encargadosPorId, categoriasPorId, proveedoresPorId));
  },

  async getMisGastos(encargadoId) {
    const { data, error } = await supabaseClient.from('gastos').select('*')
      .eq('encargado_id', encargadoId)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false });
    if (error) throw error;
    const { encargadosPorId, categoriasPorId, proveedoresPorId } = await this._mapasGastos();
    return data.map(g => mapGastoDB(g, encargadosPorId, categoriasPorId, proveedoresPorId));
  },

  // Lo carga el encargado. No se mandan "estado" ni "estado_pago": quedan
  // en "pendiente" por el valor por defecto de la tabla (y aunque se
  // mandara otra cosa, la política de RLS de inserción lo rechaza si
  // quien inserta no es el dueño).
  async crearGasto({ encargadoId, categoriaId, proveedorId, monto, fecha, nota, formaPago, chequeNumero, chequeFirma }) {
    const fila = {
      encargado_id: encargadoId,
      categoria_id: categoriaId,
      proveedor_id: proveedorId || null,
      monto: Number(monto) || 0,
      fecha: fecha || hoyISO(),
      nota: (nota || '').trim(),
      forma_pago: formaPago || 'efectivo',
      cheque_numero: (chequeNumero || '').trim(),
      cheque_firma: (chequeFirma || '').trim(),
    };
    const { data, error } = await supabaseClient.from('gastos').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  // Lo usa el dueño para aprobar o rechazar un gasto pendiente, pudiendo
  // corregir cualquiera de estos datos antes de decidir.
  async revisarGasto(id, { estado, categoriaId, proveedorId, monto, nota, formaPago, chequeNumero, chequeFirma }) {
    const cambios = { estado, revisado_en: new Date().toISOString() };
    if (categoriaId !== undefined) cambios.categoria_id = categoriaId;
    if (proveedorId !== undefined) cambios.proveedor_id = proveedorId || null;
    if (monto !== undefined) cambios.monto = Number(monto) || 0;
    if (nota !== undefined) cambios.nota = (nota || '').trim();
    if (formaPago !== undefined) cambios.forma_pago = formaPago;
    if (chequeNumero !== undefined) cambios.cheque_numero = (chequeNumero || '').trim();
    if (chequeFirma !== undefined) cambios.cheque_firma = (chequeFirma || '').trim();
    const { data, error } = await supabaseClient.from('gastos').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Lo usa el dueño para marcar un gasto ya aprobado como efectivamente
  // pagado, pudiendo corregir la forma de pago o los datos del cheque en
  // el mismo paso si hace falta.
  async marcarGastoPagado(id, { formaPago, chequeNumero, chequeFirma }) {
    const cambios = { estado_pago: 'pagado' };
    if (formaPago !== undefined) cambios.forma_pago = formaPago;
    if (chequeNumero !== undefined) cambios.cheque_numero = (chequeNumero || '').trim();
    if (chequeFirma !== undefined) cambios.cheque_firma = (chequeFirma || '').trim();
    const { data, error } = await supabaseClient.from('gastos').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
};

function manejarErrorRepo(e) {
  console.error(e);
  const detalle = e && e.message ? e.message : 'error desconocido';
  alert('No se pudo guardar. Revisá tu conexión a internet e intentá de nuevo.\n\nDetalle: ' + detalle);
}
