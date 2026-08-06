// Funciones puras: fechas, días hábiles y ritmo hacia la meta mensual.
// No tocan Supabase ni el DOM: reciben datos y devuelven datos.

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesActualISO(fecha) {
  const f = fecha || new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' en horario local, sin pasar por toISOString() (que usa UTC
// y puede correr el día según el huso horario del navegador).
function hoyISO(fecha) {
  const f = fecha || new Date();
  const yyyy = f.getFullYear();
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatearMes(anioMesISO) {
  const [anio, mes] = anioMesISO.split('-').map(Number);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY', sin construir un objeto Date (evita el
// corrimiento de un día que da new Date('YYYY-MM-DD') en husos horarios
// negativos como el de Argentina, porque esa forma se interpreta en UTC).
function formatearFechaCorta(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

// Lista de fechas 'YYYY-MM-DD' -> "05/07, 19/07" (sin año, para mostrar
// dentro del mismo mes objetivo sin ocupar tanto espacio).
function formatearListaFechasCorta(fechas) {
  if (!fechas || fechas.length === 0) return 'Ninguno';
  return fechas
    .slice()
    .sort()
    .map(f => { const [, mes, dia] = f.split('-'); return `${dia}/${mes}`; })
    .join(', ');
}

function ultimoDiaDelMes(anioMesISO) {
  const [anio, mes] = anioMesISO.split('-').map(Number);
  return new Date(anio, mes, 0).getDate();
}

// Días hábiles del mes = todos los días del mes menos los que el dueño
// marcó explícitamente como no laborales en el calendario (diasNoLaborales
// es un array de fechas exactas 'YYYY-MM-DD', no una cantidad).
function diasHabilesDelMes(anioMesISO, diasNoLaborales) {
  const total = ultimoDiaDelMes(anioMesISO);
  const libres = (diasNoLaborales || []).filter(f => f.startsWith(anioMesISO)).length;
  return total - libres;
}

// Días hábiles transcurridos desde el 1 del mes hasta "hoy" inclusive,
// descontando los días no laborales que ya pasaron. Si el mes objetivo ya
// terminó, devuelve el total del mes; si todavía no empezó, devuelve 0.
function diasHabilesTranscurridos(anioMesISO, diasNoLaborales, hoy) {
  const ref = hoy || new Date();
  const [anio, mes] = anioMesISO.split('-').map(Number);
  const anioRef = ref.getFullYear();
  const mesRef = ref.getMonth() + 1;

  if (anio < anioRef || (anio === anioRef && mes < mesRef)) {
    return diasHabilesDelMes(anioMesISO, diasNoLaborales);
  }
  if (anio > anioRef || (anio === anioRef && mes > mesRef)) {
    return 0;
  }

  const diaRef = ref.getDate();
  const libresTranscurridos = (diasNoLaborales || [])
    .filter(f => f.startsWith(anioMesISO) && Number(f.slice(8, 10)) <= diaRef)
    .length;
  return diaRef - libresTranscurridos;
}

// Toma un objetivo de progreso ({ meta, valorActual, mes, diasNoLaborales })
// y devuelve todo lo necesario para el dashboard.
function calcularRitmoObjetivo(obj, hoy) {
  const totalHabiles = diasHabilesDelMes(obj.mes, obj.diasNoLaborales);
  const habilesTranscurridos = diasHabilesTranscurridos(obj.mes, obj.diasNoLaborales, hoy);
  const habilesRestantes = Math.max(0, totalHabiles - habilesTranscurridos);
  const faltante = Math.max(0, obj.meta - obj.valorActual);
  const avanceEsperado = totalHabiles > 0 ? Math.round(obj.meta * (habilesTranscurridos / totalHabiles)) : 0;
  const ritmoDiarioNecesario = habilesRestantes > 0 ? Math.ceil(faltante / habilesRestantes) : faltante;
  const enRitmo = obj.valorActual >= avanceEsperado;
  return { totalHabiles, habilesTranscurridos, habilesRestantes, faltante, avanceEsperado, ritmoDiarioNecesario, enRitmo };
}

// Últimos n días (incluyendo hoy) como array de 'YYYY-MM-DD', del más
// viejo al más nuevo. Sirve para el gráfico comparativo de tickets por día.
function ultimosNDias(n, hoy) {
  const ref = hoy || new Date();
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i);
    dias.push(hoyISO(d));
  }
  return dias;
}

// Junta el cálculo de ritmo con el texto/color ya armados para mostrar en
// una tarjeta. La usan tanto la vista Encargado (solo lectura) como la
// vista Dueño (con acciones), para no duplicar el mensaje en los dos lados.
function resumenObjetivoProgreso(obj, hoy) {
  const avance = obj.meta > 0 ? Math.min(100, Math.round((obj.valorActual / obj.meta) * 100)) : 0;
  const superado = obj.meta > 0 && obj.valorActual >= obj.meta;
  const r = calcularRitmoObjetivo(obj, hoy);
  const unidad = obj.unidad || '';

  let mensajeEstado;
  if (r.faltante <= 0) {
    mensajeEstado = 'Meta alcanzada.';
  } else if (r.habilesRestantes <= 0) {
    mensajeEstado = `No quedan días hábiles en el mes y faltan <strong>${r.faltante} ${unidad}</strong> para la meta.`;
  } else {
    const esPlural = r.habilesRestantes !== 1;
    const diasTexto = esPlural
      ? `${r.habilesRestantes} días hábiles restantes`
      : `1 día hábil restante`;
    mensajeEstado = `Faltan <strong>${r.faltante} ${unidad}</strong> para la meta. Con ${diasTexto} en el mes, hace falta un promedio de <strong>${r.ritmoDiarioNecesario} ${unidad} por día hábil</strong>. ${r.enRitmo ? 'Va en ritmo respecto de lo esperado a hoy.' : 'Va atrasado respecto del ritmo esperado a hoy.'}`;
  }

  const colorCard = superado ? 'verde' : (r.enRitmo ? 'azul' : 'rojo');
  return { avance, superado, r, unidad, mensajeEstado, colorCard };
}

// ---- Gastos ----

// Número -> "15.000,00" (formato de pesos argentinos, sin el símbolo $).
function formatearMonto(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Suma los gastos EN ESTADO "aprobado" cuya fecha cae dentro de
// [desde, hasta] (fechas 'YYYY-MM-DD', ambos límites inclusive; cualquiera
// de los dos puede venir vacío para no acotar por ese lado), agrupados por
// el campo indicado (por ejemplo 'categoriaNombre' o 'sucursal'). Devuelve
// un array [{ clave, total }] ordenado de mayor a menor gasto. Los gastos
// pendientes o rechazados no entran en la suma: recién cuentan como gasto
// real una vez que el dueño los aprueba.
function agruparGastosAprobados(gastos, desde, hasta, campo) {
  const totales = {};
  (gastos || []).forEach(g => {
    if (g.estado !== 'aprobado') return;
    if (desde && g.fecha < desde) return;
    if (hasta && g.fecha > hasta) return;
    const clave = g[campo] || '(sin dato)';
    totales[clave] = (totales[clave] || 0) + g.monto;
  });
  return Object.entries(totales)
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total);
}

// Igual que agruparGastosAprobados, pero con un segundo nivel de
// agrupación adentro de cada grupo externo (por ejemplo, sucursal por
// afuera y categoría por adentro). Devuelve
// [{ clave, total, subgrupos: [{ clave, total }] }], todo ordenado de
// mayor a menor gasto.
function agruparGastosAprobadosAnidado(gastos, desde, hasta, campoExterno, campoInterno) {
  const externos = agruparGastosAprobados(gastos, desde, hasta, campoExterno);
  return externos.map(ext => {
    const delGrupo = (gastos || []).filter(g => (g[campoExterno] || '(sin dato)') === ext.clave);
    const subgrupos = agruparGastosAprobados(delGrupo, desde, hasta, campoInterno);
    return { clave: ext.clave, total: ext.total, subgrupos };
  });
}

// ---- Semana calendario (lunes a domingo), para tareas de la semana ----

// Fecha 'YYYY-MM-DD' del lunes de la semana que contiene "fecha" (hoy si
// no se pasa nada). Sirve como identificador de "a qué semana pertenece"
// una tarea, sin depender del mes.
function lunesDeLaSemana(fecha) {
  const f = fecha || new Date();
  const dow = (f.getDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(f.getFullYear(), f.getMonth(), f.getDate() - dow);
  return hoyISO(lunes);
}

// 'YYYY-MM-DD' (un lunes) -> "DD/MM – DD/MM" para mostrar el rango de esa
// semana completa.
function formatearRangoSemana(lunesISO) {
  const [anio, mes, dia] = lunesISO.split('-').map(Number);
  const domingo = new Date(anio, mes - 1, dia + 6);
  return `${formatearFechaCorta(lunesISO)} – ${formatearFechaCorta(hoyISO(domingo))}`;
}

// ---- Progreso semanal de un objetivo ----

// Parte el mes en semanas de lunes a domingo COMPLETAS: si el mes no
// arranca un lunes, la primera semana se extiende hacia atrás hasta el
// lunes anterior (aunque caiga en el mes previo); si no termina un
// domingo, la última se extiende hacia adelante hasta el domingo
// siguiente. Así ninguna semana queda "cortada" a dos o tres días — cada
// una es siempre una semana calendario real, lunes a domingo, sea o no
// laboral el domingo. progresoSemanalObjetivo() es quien después recorta,
// solo para el cálculo de la meta, la parte de cada semana que cae fuera
// del mes (esos días no son parte de este objetivo).
function semanasDelMes(mesISO) {
  const [anio, mes] = mesISO.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();

  const dowPrimero = (new Date(anio, mes - 1, 1).getDay() + 6) % 7; // 0 = lunes
  const inicioPrimeraSemana = new Date(anio, mes - 1, 1 - dowPrimero);

  const dowUltimo = (new Date(anio, mes - 1, ultimoDia).getDay() + 6) % 7;
  const finUltimaSemana = new Date(anio, mes - 1, ultimoDia + (6 - dowUltimo));

  const semanas = [];
  const cursor = new Date(inicioPrimeraSemana);
  while (cursor <= finUltimaSemana) {
    const finSemana = new Date(cursor);
    finSemana.setDate(finSemana.getDate() + 6);
    semanas.push({
      numero: semanas.length + 1,
      inicio: hoyISO(cursor),
      fin: hoyISO(finSemana),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

// Cuenta los días hábiles (no marcados como no laborales) entre dos
// fechas 'YYYY-MM-DD', ambos límites inclusive.
function contarDiasHabilesEnRango(desde, hasta, diasNoLaborales) {
  const [anioD, mesD, diaD] = desde.split('-').map(Number);
  const [anioH, mesH, diaH] = hasta.split('-').map(Number);
  const libres = new Set(diasNoLaborales || []);
  let total = 0;
  const cursor = new Date(anioD, mesD - 1, diaD);
  const fin = new Date(anioH, mesH - 1, diaH);
  while (cursor <= fin) {
    if (!libres.has(hoyISO(cursor))) total++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

// Reparte la meta mensual entre las semanas del mes, en proporción a los
// días hábiles que tiene cada una, y compara contra lo efectivamente
// cargado esa semana (según obj.historial). Sirve para mostrar el avance
// como una lista semana a semana ("¿cumplí lo que tenía que cumplir esta
// semana?"), en vez de solo el acumulado del mes.
function progresoSemanalObjetivo(obj, hoy) {
  const semanas = semanasDelMes(obj.mes);
  const diasHabilesTotales = diasHabilesDelMes(obj.mes, obj.diasNoLaborales);
  const ref = hoy || new Date();
  const hoyISOStr = hoyISO(ref);
  const primerDiaMes = `${obj.mes}-01`;
  const ultimoDiaMes = `${obj.mes}-${String(ultimoDiaDelMes(obj.mes)).padStart(2, '0')}`;

  return semanas.map(sem => {
    // La semana que se MUESTRA siempre es lunes a domingo completa, pero
    // los días hábiles (y por lo tanto la meta) solo se cuentan dentro de
    // este mes: los días de la semana que caen en el mes anterior o
    // siguiente no son parte de este objetivo.
    const desdeClip = sem.inicio < primerDiaMes ? primerDiaMes : sem.inicio;
    const hastaClip = sem.fin > ultimoDiaMes ? ultimoDiaMes : sem.fin;
    const diasHabilesSemana = desdeClip <= hastaClip
      ? contarDiasHabilesEnRango(desdeClip, hastaClip, obj.diasNoLaborales)
      : 0;
    const metaSemana = diasHabilesTotales > 0
      ? Math.round(obj.meta * (diasHabilesSemana / diasHabilesTotales))
      : 0;
    const logrado = (obj.historial || [])
      .filter(h => h.fecha >= sem.inicio && h.fecha <= sem.fin)
      .reduce((s, h) => s + h.valor, 0);
    const pct = metaSemana > 0 ? Math.round((logrado / metaSemana) * 100) : (logrado > 0 ? 100 : 0);
    const yaTermino = sem.fin < hoyISOStr;
    const cumplida = metaSemana > 0 && logrado >= metaSemana;
    return {
      numero: sem.numero, inicio: sem.inicio, fin: sem.fin,
      diasHabilesSemana, metaSemana, logrado, pct, yaTermino, cumplida,
    };
  });
}
