// Configuración de conexión a Supabase.
// Reemplazá los dos valores de abajo por los de TU proyecto:
// Supabase Dashboard > Settings > API Keys.
//   SUPABASE_URL  -> "Project URL"
//   SUPABASE_KEY  -> "Publishable key" (o "anon key" en proyectos viejos,
//                    dentro de la pestaña "Legacy API Keys")
// Este archivo NO tiene información secreta: la publishable/anon key está
// pensada para vivir en el navegador. Lo que de verdad protege los datos
// de cada encargado es Row Level Security (ver sql/schema.sql), no que
// esta clave quede oculta.

const SUPABASE_URL = 'https://hezaiueroktankbijecb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oFSJs8HL1oG7phkQRi7HnQ_yObN6MoS';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cuando alguien entra a la app desde el link del mail de "recuperar
// contraseña", supabase-js detecta el token en la URL y dispara este
// evento apenas carga la página — antes incluso de que la persona toque
// nada. Por eso se registra acá, en el primer archivo que corre, y no en
// app.js: para no perderlo por una carrera de tiempos. mostrarRecuperacionClave()
// se define más abajo (en app.js), pero como este callback recién se
// ejecuta cuando el evento realmente ocurre, para ese momento ya existe.
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY' && typeof mostrarRecuperacionClave === 'function') {
    mostrarRecuperacionClave();
  }
});
