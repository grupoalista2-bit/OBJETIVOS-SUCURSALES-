-- ============================================================
-- ALISTA AHORRO - Control Diario - Propósito / Misión / Visión
-- Correr esto DESPUÉS de sql/schema.sql, sql/gastos.sql y sql/gastos_v2.sql
-- (los que ya corriste). Agrega:
--   - una tabla de una sola fila con el texto de Propósito, Misión y
--     Visión que carga el dueño
--   - 3 columnas en "encargados" para que el dueño elija, encargado por
--     encargado, cuál de esos tres textos puede ver
-- Copiar y pegar TODO este archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- ---------- Tabla de identidad institucional (una sola fila) ----------
-- "id boolean primary key default true check (id)" es un truco simple
-- para que la tabla nunca pueda tener más de una fila: la única clave
-- primaria posible es "true".

create table public.identidad_empresa (
  id boolean primary key default true check (id),
  proposito text not null default '',
  mision text not null default '',
  vision text not null default '',
  actualizado_en timestamptz not null default now()
);

insert into public.identidad_empresa (id) values (true);

alter table public.identidad_empresa enable row level security;

-- Cualquier usuario logueado (dueño o encargado) puede leer el texto; qué
-- parte se le muestra a cada encargado lo decide la app según sus propias
-- columnas ve_proposito/ve_mision/ve_vision, no esta tabla.
create policy "identidad_select" on public.identidad_empresa
  for select to authenticated
  using ( true );

create policy "identidad_update" on public.identidad_empresa
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

grant select, update on public.identidad_empresa to authenticated;

-- ---------- Columnas de visibilidad en "encargados" ----------
-- La política "encargados_update" ya existente (solo el dueño puede
-- actualizar encargados) cubre estas columnas nuevas sin cambios.

alter table public.encargados
  add column ve_proposito boolean not null default false,
  add column ve_mision boolean not null default false,
  add column ve_vision boolean not null default false;

-- ============================================================
-- Después de correr este script vas a ver, en el panel del dueño, una
-- sección nueva "Propósito, misión y visión" donde cargás el texto de
-- cada una, y en la ficha de cada encargado (al editarlo) 3 casilleros
-- para elegir cuál de esos tres textos puede ver esa persona en su
-- pestaña Encargado.
-- ============================================================
