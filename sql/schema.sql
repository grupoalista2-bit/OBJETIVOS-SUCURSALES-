-- ============================================================
-- ALISTA AHORRO - Control Diario - esquema de Supabase
-- Copiar y pegar TODO este archivo en el SQL Editor del proyecto
-- (Supabase Dashboard > SQL Editor > New query) y ejecutar una sola vez.
-- ============================================================

-- ---------- Tablas ----------

create table public.duenos (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.encargados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nombre text not null,
  sucursal text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.objetivos_progreso (
  id uuid primary key default gen_random_uuid(),
  encargado_id uuid not null references public.encargados (id) on delete cascade,
  titulo text not null,
  meta numeric not null default 0,
  unidad text not null default 'tickets',
  mes text not null,                          -- 'YYYY-MM'
  dias_no_laborales text[] not null default '{}',  -- array de 'YYYY-MM-DD'
  creado_en timestamptz not null default now()
);

create table public.cargas_tickets (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos_progreso (id) on delete cascade,
  fecha date not null,
  valor numeric not null default 0,
  nota text not null default '',
  unique (objetivo_id, fecha)
);

-- ---------- Funciones de apoyo para las políticas ----------
-- security definer: pueden leer las tablas de control sin que las políticas
-- de esas mismas tablas se disparen de nuevo (evita recursión).

create or replace function public.es_dueno()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.duenos where user_id = auth.uid());
$$;

create or replace function public.mi_encargado_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.encargados where user_id = auth.uid();
$$;

-- ---------- Row Level Security ----------

alter table public.duenos enable row level security;
alter table public.encargados enable row level security;
alter table public.objetivos_progreso enable row level security;
alter table public.cargas_tickets enable row level security;

-- duenos: cada usuario logueado solo puede consultar si SU PROPIO id
-- figura como dueño. No puede ver la lista de otros dueños.
create policy "duenos_ver_propia_fila" on public.duenos
  for select to authenticated
  using ( auth.uid() = user_id );

-- encargados: el dueño ve y crea/edita todas las filas; un encargado
-- solo puede ver su propia fila (la que tiene su user_id).
create policy "encargados_select" on public.encargados
  for select to authenticated
  using ( (select public.es_dueno()) or user_id = auth.uid() );

create policy "encargados_insert" on public.encargados
  for insert to authenticated
  with check ( (select public.es_dueno()) );

create policy "encargados_update" on public.encargados
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

-- objetivos_progreso: el dueño ve y crea/edita todos; un encargado solo ve
-- los objetivos que le corresponden a él.
create policy "objetivos_select" on public.objetivos_progreso
  for select to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

create policy "objetivos_insert" on public.objetivos_progreso
  for insert to authenticated
  with check ( (select public.es_dueno()) );

create policy "objetivos_update" on public.objetivos_progreso
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

-- cargas_tickets: el dueño ve y carga todo; un encargado solo puede ver
-- (nunca cargar) los tickets de sus propios objetivos. Cargar tickets
-- sigue siendo tarea exclusiva del dueño, como en las versiones anteriores.
create policy "cargas_select" on public.cargas_tickets
  for select to authenticated
  using (
    (select public.es_dueno())
    or objetivo_id in (
      select id from public.objetivos_progreso
      where encargado_id = (select public.mi_encargado_id())
    )
  );

create policy "cargas_insert" on public.cargas_tickets
  for insert to authenticated
  with check ( (select public.es_dueno()) );

create policy "cargas_update" on public.cargas_tickets
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

-- ---------- Permisos de la Data API ----------
-- RLS decide QUÉ filas se ven; estos GRANT habilitan que el rol
-- "authenticated" pueda siquiera intentar select/insert/update en la tabla.

grant select on public.duenos to authenticated;
grant select, insert, update on public.encargados to authenticated;
grant select, insert, update on public.objetivos_progreso to authenticated;
grant select, insert, update on public.cargas_tickets to authenticated;

-- ============================================================
-- Después de correr este script:
-- 1. Andá a Authentication > Users y creá un usuario para VOS (el dueño),
--    con "Auto Confirm User" tildado.
-- 2. Copiá tu User UID (columna de la tabla de usuarios) y ejecutá, en el
--    SQL Editor, reemplazando TU-UUID-AQUI por ese valor:
--
--    insert into public.duenos (user_id) values ('TU-UUID-AQUI');
--
-- 3. Repetí la creación de usuario en Authentication > Users por cada
--    encargado (podés usar un email inventado como laura@alista.local si
--    no tienen email real, siempre con "Auto Confirm User" tildado).
--    Esos UUID se pegan luego en la app, en el campo "ID de usuario" al
--    crear o editar cada encargado -- no hace falta tocar SQL para eso.
-- ============================================================
