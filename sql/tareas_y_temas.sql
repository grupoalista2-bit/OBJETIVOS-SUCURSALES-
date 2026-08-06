-- ============================================================
-- ALISTA AHORRO - Control Diario - Tareas de la semana + Temas de reunión
-- Correr esto DESPUÉS de los scripts anteriores. Copiar y pegar TODO este
-- archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- ---------- Tareas de la semana ----------
-- Le pertenecen a UN colaborador (encargado_id), pero tanto el dueño como
-- ese colaborador pueden agregar, marcar como hecha o "sacar" tareas de
-- esa lista. Sacar una tarea NUNCA la borra de verdad: queda en estado
-- 'cancelada' con quién la sacó y por qué, para que no se pierda el
-- registro. No hay política ni permiso de DELETE a propósito.

create table public.tareas_semana (
  id uuid primary key default gen_random_uuid(),
  encargado_id uuid not null references public.encargados (id) on delete cascade,
  semana date not null,               -- lunes de la semana a la que pertenece
  texto text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'cancelada')),
  creado_por text not null,           -- 'Dueño' o el nombre del colaborador
  creado_en timestamptz not null default now(),
  hecha_en timestamptz,
  cancelada_por text,
  cancelada_motivo text,
  cancelada_en timestamptz
);

alter table public.tareas_semana enable row level security;

create policy "tareas_semana_select" on public.tareas_semana
  for select to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

create policy "tareas_semana_insert" on public.tareas_semana
  for insert to authenticated
  with check (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

create policy "tareas_semana_update" on public.tareas_semana
  for update to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  )
  with check (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

grant select, insert, update on public.tareas_semana to authenticated;

-- ---------- Temas de reunión ----------
-- Funciona como un manual/diccionario COMPARTIDO: cualquier usuario
-- logueado (dueño o cualquier colaborador) puede ver, crear y editar
-- cualquier tema -- no está acotado al autor original. Lo que da
-- trazabilidad no es una restricción de permisos, sino que cada edición
-- se agrega al campo "historial" (fecha + autor + comentario breve) sin
-- pisar lo anterior.

create table public.temas_reunion (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null default '',
  respuesta text not null default '',
  estado text not null default 'pendiente_reunion' check (estado in ('pendiente_reunion', 'tratado')),
  creado_por text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  historial jsonb not null default '[]'::jsonb
);

alter table public.temas_reunion enable row level security;

create policy "temas_reunion_select" on public.temas_reunion
  for select to authenticated
  using ( true );

create policy "temas_reunion_insert" on public.temas_reunion
  for insert to authenticated
  with check ( true );

create policy "temas_reunion_update" on public.temas_reunion
  for update to authenticated
  using ( true )
  with check ( true );

grant select, insert, update on public.temas_reunion to authenticated;

-- ============================================================
-- Después de correr este script vas a ver, en la pestaña Encargado:
--   - "Tareas de la semana", tanto en tu propia vista como cuando el
--     dueño mira la de un colaborador.
--   - "Temas de reunión", un manual compartido al final de la pestaña,
--     visible para todos.
-- No hace falta tocar nada más en el código para eso.
-- ============================================================
