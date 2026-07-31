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
