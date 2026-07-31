-- ============================================================
-- ALISTA AHORRO - Control Diario - ampliación del módulo de GASTOS
-- Correr esto DESPUÉS de sql/gastos.sql (el que ya corriste). Agrega:
--   - tabla de proveedores/entidades (mismo patrón que categorias_gasto)
--   - columnas nuevas en "gastos": proveedor, forma de pago, datos del
--     cheque cuando corresponde, y estado de pago (separado del estado
--     de aprobación que ya existía)
-- Copiar y pegar TODO este archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- ---------- Tabla de proveedores/entidades ----------

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.proveedores enable row level security;

create policy "proveedores_select" on public.proveedores
  for select to authenticated
  using ( true );

create policy "proveedores_insert" on public.proveedores
  for insert to authenticated
  with check ( (select public.es_dueno()) );

create policy "proveedores_update" on public.proveedores
  for update to authenticated
  using ( (select public.es_dueno()) )
  with check ( (select public.es_dueno()) );

grant select, insert, update on public.proveedores to authenticated;

-- ---------- Columnas nuevas en "gastos" ----------
-- Todas quedan con un valor por defecto para no romper filas que ya
-- existan. proveedor_id queda nullable a propósito (no se puede exigir
-- "not null" sin antes completar el dato en las filas viejas), pero la
-- app sí lo pide como obligatorio al cargar un gasto nuevo.

alter table public.gastos
  add column proveedor_id uuid references public.proveedores (id),
  add column forma_pago text not null default 'efectivo'
    check (forma_pago in ('efectivo', 'transferencia', 'cheque')),
  add column cheque_numero text not null default '',
  add column cheque_firma text not null default '',
  add column estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'pagado'));

-- ---------- Reglas de seguridad actualizadas ----------
-- Se reemplaza la política de inserción de "gastos" para que, además de
-- no poder auto-aprobarse un gasto, un encargado tampoco pueda cargar uno
-- ya marcado como pagado (el pago lo confirma únicamente el dueño, una
-- vez que el gasto está aprobado).

drop policy if exists "gastos_insert" on public.gastos;

create policy "gastos_insert" on public.gastos
  for insert to authenticated
  with check (
    (select public.es_dueno())
    or (
      encargado_id = (select public.mi_encargado_id())
      and estado = 'pendiente'
      and estado_pago = 'pendiente'
    )
  );

-- La política de UPDATE ("gastos_update_dueno") ya cubre cualquier
-- columna, así que el dueño puede corregir proveedor/forma de pago/datos
-- del cheque y marcar el pago sin cambios adicionales acá.

-- ============================================================
-- Después de correr este script, en el panel del dueño vas a ver una
-- sección nueva "Proveedores" (igual que Categorías de gasto) para cargar
-- los que uses, y una sección "Pagos pendientes" para marcar como pagado
-- un gasto ya aprobado.
-- ============================================================
