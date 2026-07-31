// Configuración de conexión a Supabase.

const SUPABASE_URL = 'https://hezaiueroktankbijecb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oFSJs8HL1oG7phkQRi7HnQ_yObN6MoS';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);