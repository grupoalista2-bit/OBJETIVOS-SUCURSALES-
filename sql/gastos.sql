-- ============================================================
-- ALISTA AHORRO - Control Diario - módulo de GASTOS por sucursal
-- Correr esto DESPUÉS de sql/schema.sql (el que ya corriste). Agrega dos
-- tablas nuevas y sus reglas de seguridad, sin tocar nada de lo existente.
-- Copiar y pegar TODO este archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- ---------- Tablas ----------

create table public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  encargado_id uuid not null references public.encargados (id) on delete cascade,
  categoria_id uuid not null references public.categorias_gasto (id),
  monto numeric not null,
  fecha date not null default current_date,
  nota text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  creado_en timestamptz not null default now(),
  revisado_en timestamptz
);

-- ---------- Row Level Security ----------

alter table public.categorias_gasto enable row level security;
alter table public.gastos enable row level security;

-- categorias_gasto: cualquier usuario logueado puede leer la lista (el
-- encargado la necesita para el desplegable al cargar un gasto). Crearlas
-- o editarlas es solo del dueño.
create policy "categorias_gasto_select" on public.categorias_gasto
  for select to authenticated
  using ( true );

create policy "categorias_gasto_insert" on public.categorias_gasto
  for insert to authenticated
  with check ( (select public.es_dueno()) );

create policy "categorias_gasto_update" on public.categorias_gasto
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

-- gastos: el dueño ve y edita/aprueba todos. Un encargado solo ve los
-- suyos, y solo puede crear gastos a su propio nombre y siempre en estado
-- "pendiente" — no puede auto-aprobarse un gasto ni cargar uno a nombre
-- de otro encargado, ni editar uno ya cargado (eso es tarea del dueño).
create policy "gastos_select" on public.gastos
  for select to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

create policy "gastos_insert" on public.gastos
  for insert to authenticated
  with check (
    (select public.es_dueno())
    or (
      encargado_id = (select public.mi_encargado_id())
      and estado = 'pendiente'
    )
  );

create policy "gastos_update_dueno" on public.gastos
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

-- ---------- Permisos de la Data API ----------

grant select, insert, update on public.categorias_gasto to authenticated;
grant select, insert, update on public.gastos to authenticated;

-- ============================================================
-- Después de correr este script, entrá al panel del dueño en la app:
-- vas a ver una sección nueva "Categorías de gasto" donde cargás las que
-- necesites (Limpieza, Insumos, Servicios, etc.) — no hace falta tocar
-- SQL para eso.
-- ============================================================
